use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use serde_json::Value;
use tauri::Manager;

// 全局状态管理
#[derive(Default)]
pub struct AppState {
    pub python_process: Arc<Mutex<Option<std::process::Child>>>,
    pub is_jarvis_running: Arc<Mutex<bool>>,
}

// JARVIS状态检查命令
#[tauri::command]
async fn check_jarvis_status() -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    match client
        .get("http://127.0.0.1:8000/status")
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Value>().await {
                    Ok(json) => Ok(json),
                    Err(e) => Err(format!("解析响应失败: {}", e)),
                }
            } else {
                Err(format!("JARVIS服务响应错误: {}", response.status()))
            }
        }
        Err(e) => Err(format!("连接JARVIS服务失败: {}", e)),
    }
}

// 启动Python JARVIS核心服务
#[tauri::command]
async fn start_jarvis_service(app_state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut process_guard = app_state.python_process.lock().unwrap();
    
    // 检查是否已经在运行
    if process_guard.is_some() {
        return Ok("JARVIS服务已在运行".to_string());
    }
    
    // 启动Python服务
    let python_executable = if cfg!(windows) {
        "python"
    } else {
        "python3"
    };
    
    // 尝试启动JARVIS核心服务
    let jarvis_core_path = std::env::current_dir()
        .map_err(|e| format!("获取当前目录失败: {}", e))?
        .parent()
        .ok_or("无法找到父目录")?
        .join("jarvis-core")
        .join("main.py");
    
    if !jarvis_core_path.exists() {
        return Err("JARVIS核心服务文件不存在".to_string());
    }
    
    match Command::new(python_executable)
        .arg(jarvis_core_path)
        .current_dir(
            std::env::current_dir()
                .unwrap()
                .parent()
                .unwrap()
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => {
            *process_guard = Some(child);
            
            // 更新运行状态
            let is_running = app_state.is_jarvis_running.clone();
            *is_running.lock().unwrap() = true;
            
            // 启动状态监控线程
            let is_running_clone = is_running.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(3)); // 给服务启动时间
                
                // 检查服务是否成功启动
                let runtime = tokio::runtime::Runtime::new().unwrap();
                let is_available = runtime.block_on(async {
                    reqwest::Client::new()
                        .get("http://127.0.0.1:8000/")
                        .timeout(Duration::from_secs(5))
                        .send()
                        .await
                        .is_ok()
                });
                
                if !is_available {
                    *is_running_clone.lock().unwrap() = false;
                }
            });
            
            Ok("JARVIS服务启动成功".to_string())
        }
        Err(e) => {
            *process_guard = None;
            Err(format!("启动JARVIS服务失败: {}", e))
        }
    }
}

// 停止Python JARVIS核心服务
#[tauri::command]
async fn stop_jarvis_service(app_state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut process_guard = app_state.python_process.lock().unwrap();
    
    match process_guard.as_mut() {
        Some(child) => {
            match child.kill() {
                Ok(_) => {
                    let _ = child.wait(); // 等待进程完全终止
                    *process_guard = None;
                    *app_state.is_jarvis_running.lock().unwrap() = false;
                    Ok("JARVIS服务已停止".to_string())
                }
                Err(e) => Err(format!("停止JARVIS服务失败: {}", e)),
            }
        }
        None => Ok("JARVIS服务未在运行".to_string()),
    }
}

// 获取JARVIS服务运行状态
#[tauri::command]
async fn get_jarvis_running_status(app_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let is_running = *app_state.is_jarvis_running.lock().unwrap();
    Ok(is_running)
}

// 安装Python依赖
#[tauri::command]
async fn install_python_dependencies() -> Result<String, String> {
    let python_executable = if cfg!(windows) {
        "python"
    } else {
        "python3"
    };
    
    let requirements_path = std::env::current_dir()
        .map_err(|e| format!("获取当前目录失败: {}", e))?
        .parent()
        .ok_or("无法找到父目录")?
        .join("requirements.txt");
    
    if !requirements_path.exists() {
        return Err("requirements.txt文件不存在".to_string());
    }
    
    let output = Command::new(python_executable)
        .args(&["-m", "pip", "install", "-r"])
        .arg(&requirements_path)
        .current_dir(
            std::env::current_dir()
                .unwrap()
                .parent()
                .unwrap()
        )
        .output()
        .map_err(|e| format!("执行pip install失败: {}", e))?;
    
    if output.status.success() {
        Ok("Python依赖安装成功".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Python依赖安装失败: {}", stderr))
    }
}

// 原有的greet命令保留用于测试
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! JARVIS is ready to serve you!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::default();
    
    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_jarvis_status,
            start_jarvis_service,
            stop_jarvis_service,
            get_jarvis_running_status,
            install_python_dependencies
        ])
        .setup(|app| {
            // 应用启动时自动尝试启动JARVIS服务
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // 延迟2秒启动，确保窗口已加载
                tokio::time::sleep(Duration::from_secs(2)).await;
                
                // 尝试启动JARVIS服务
                let app_state = app_handle.state::<AppState>();
                let _ = start_jarvis_service(app_state).await;
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
