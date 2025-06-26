import * as THREE from 'three';

// 性能监控器
export class PerformanceMonitor {
  private stats: {
    fps: number;
    frameTime: number;
    memoryUsage: number;
    triangleCount: number;
    drawCalls: number;
  } = {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    triangleCount: 0,
    drawCalls: 0
  };

  private lastTime = 0;
  private frameCount = 0;
  private fpsUpdateInterval = 1000; // 1秒更新一次FPS

  constructor() {
    this.lastTime = performance.now();
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    
    this.frameCount++;
    this.stats.frameTime = deltaTime;

    // 更新FPS
    if (deltaTime >= this.fpsUpdateInterval) {
      this.stats.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = now;
    }

    // 更新渲染统计
    this.stats.triangleCount = renderer.info.render.triangles;
    this.stats.drawCalls = renderer.info.render.calls;

    // 更新内存使用 (如果可用)
    if ((performance as any).memory) {
      this.stats.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getAverageFrameTime(): number {
    return this.stats.frameTime;
  }

  getFPS(): number {
    return this.stats.fps;
  }

  getMemoryUsage(): number {
    return this.stats.memoryUsage;
  }
}

// 几何体优化器
export class GeometryOptimizer {
  static optimizeMesh(mesh: THREE.Mesh): THREE.Mesh {
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      // 简化几何体
      const geometry = mesh.geometry.clone();
      
      // 移除不必要的属性
      this.removeUnusedAttributes(geometry);
      
      // 优化索引
      this.optimizeIndices(geometry);
      
      // 压缩顶点数据
      this.compressVertexData(geometry);

      const optimizedMesh = mesh.clone();
      optimizedMesh.geometry = geometry;
      
      return optimizedMesh;
    }
    
    return mesh;
  }

  static removeUnusedAttributes(geometry: THREE.BufferGeometry): void {
    // 移除未使用的UV坐标、颜色等属性
    const attributes = geometry.attributes;
    const usedAttributes: string[] = ['position', 'normal'];

    Object.keys(attributes).forEach(key => {
      if (!usedAttributes.includes(key)) {
        geometry.deleteAttribute(key);
      }
    });
  }

  static optimizeIndices(geometry: THREE.BufferGeometry): void {
    // 如果没有索引，创建索引
    if (!geometry.index) {
      const positions = geometry.attributes.position;
      const indices = [];
      
      for (let i = 0; i < positions.count; i++) {
        indices.push(i);
      }
      
      geometry.setIndex(indices);
    }
  }

  static compressVertexData(geometry: THREE.BufferGeometry): void {
    // 使用较低精度的数据类型
    const positions = geometry.attributes.position;
    if (positions.array instanceof Float32Array) {
      // 已经是Float32，无需进一步压缩
      return;
    }
    
    // 将双精度转换为单精度
    const compressedPositions = new Float32Array(positions.array);
    geometry.setAttribute('position', new THREE.BufferAttribute(compressedPositions, positions.itemSize));
  }
}

// 材质优化器
export class MaterialOptimizer {
  static optimizeMaterial(material: THREE.Material): THREE.Material {
    if (material instanceof THREE.MeshStandardMaterial) {
      return this.optimizeStandardMaterial(material);
    } else if (material instanceof THREE.MeshBasicMaterial) {
      return this.optimizeBasicMaterial(material);
    }
    
    return material;
  }

  static optimizeStandardMaterial(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const optimized = material.clone();
    
    // 降低材质复杂度
    optimized.roughness = Math.max(0.3, material.roughness); // 避免过于光滑的表面
    optimized.metalness = Math.min(0.1, material.metalness); // 减少金属反射
    
    // 简化贴图
    if (optimized.map) {
      optimized.map = this.optimizeTexture(optimized.map);
    }
    
    if (optimized.normalMap) {
      optimized.normalMap = this.optimizeTexture(optimized.normalMap);
    }
    
    return optimized;
  }

  static optimizeBasicMaterial(material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
    const optimized = material.clone();
    
    if (optimized.map) {
      optimized.map = this.optimizeTexture(optimized.map);
    }
    
    return optimized;
  }

  static optimizeTexture(texture: THREE.Texture): THREE.Texture {
    const optimized = texture.clone();
    
    // 设置合适的过滤方式
    optimized.minFilter = THREE.LinearMipmapLinearFilter;
    optimized.magFilter = THREE.LinearFilter;
    
    // 生成mipmap
    optimized.generateMipmaps = true;
    
    return optimized;
  }
}

// 渲染优化器
export class RenderOptimizer {
  private renderer: THREE.WebGLRenderer;
  private performanceMonitor: PerformanceMonitor;
  private targetFPS = 60;
  private minFPS = 30;
  private qualityLevel = 1.0; // 0.1 - 1.0

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.performanceMonitor = new PerformanceMonitor();
  }

  optimize(scene: THREE.Scene, camera: THREE.Camera): void {
    this.performanceMonitor.update(this.renderer, scene);
    
    const currentFPS = this.performanceMonitor.getFPS();
    
    // 自动调整质量
    if (currentFPS < this.minFPS) {
      this.decreaseQuality();
    } else if (currentFPS > this.targetFPS && this.qualityLevel < 1.0) {
      this.increaseQuality();
    }
    
    // 应用优化设置
    this.applyQualitySettings();
    
    // 进行视锥剔除
    this.performFrustumCulling(scene, camera);
    
    // LOD管理
    this.manageLOD(scene, camera);
  }

  private decreaseQuality(): void {
    this.qualityLevel = Math.max(0.1, this.qualityLevel - 0.1);
    console.log(`Decreasing quality to ${this.qualityLevel}`);
  }

  private increaseQuality(): void {
    this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.05);
    console.log(`Increasing quality to ${this.qualityLevel}`);
  }

  private applyQualitySettings(): void {
    // 调整像素比率
    const pixelRatio = Math.min(window.devicePixelRatio, this.qualityLevel * 2);
    this.renderer.setPixelRatio(pixelRatio);
    
    // 调整阴影质量
    if (this.qualityLevel < 0.5) {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = this.qualityLevel > 0.8 
        ? THREE.PCFSoftShadowMap 
        : THREE.BasicShadowMap;
    }
    
    // 注意：抗锯齿需要在渲染器创建时设置
    // this.renderer.antialias = this.qualityLevel > 0.6;
  }

  private performFrustumCulling(scene: THREE.Scene, camera: THREE.Camera): void {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = frustum.intersectsObject(object);
      }
    });
  }

  private manageLOD(scene: THREE.Scene, camera: THREE.Camera): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.originalGeometry) {
        const distance = camera.position.distanceTo(object.position);
        
        // 基于距离调整几何体细节
        if (distance > 20 && this.qualityLevel < 0.7) {
          // 使用低细节模型
          object.geometry = object.userData.lowDetailGeometry || object.userData.originalGeometry;
        } else {
          // 使用原始模型
          object.geometry = object.userData.originalGeometry;
        }
      }
    });
  }

  getPerformanceStats() {
    return this.performanceMonitor.getStats();
  }

  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
  }

  getQualityLevel(): number {
    return this.qualityLevel;
  }

  setQualityLevel(level: number): void {
    this.qualityLevel = Math.max(0.1, Math.min(1.0, level));
  }
}

// 内存管理器
export class MemoryManager {
  private disposableObjects: Set<THREE.Object3D> = new Set();
  private maxMemoryUsage = 500; // MB

  trackObject(object: THREE.Object3D): void {
    this.disposableObjects.add(object);
  }

  untrackObject(object: THREE.Object3D): void {
    this.disposableObjects.delete(object);
  }

  checkMemoryUsage(): boolean {
    if ((performance as any).memory) {
      const memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
      return memoryUsage > this.maxMemoryUsage;
    }
    return false;
  }

  cleanup(): void {
    if (this.checkMemoryUsage()) {
      console.log('High memory usage detected, performing cleanup...');
      
      this.disposableObjects.forEach(object => {
        this.disposeObject(object);
      });
      
      this.disposableObjects.clear();
      
      // 强制垃圾回收 (如果可用)
      if ((window as any).gc) {
        (window as any).gc();
      }
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  setMaxMemoryUsage(mb: number): void {
    this.maxMemoryUsage = mb;
  }
}

// 自适应质量控制器
export class AdaptiveQualityController {
  private renderOptimizer: RenderOptimizer;
  private memoryManager: MemoryManager;
  private isEnabled = true;
  private updateInterval = 1000; // 1秒
  private lastUpdate = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderOptimizer = new RenderOptimizer(renderer);
    this.memoryManager = new MemoryManager();
  }

  update(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.isEnabled) return;

    const now = performance.now();
    if (now - this.lastUpdate < this.updateInterval) return;

    this.lastUpdate = now;
    
    // 优化渲染
    this.renderOptimizer.optimize(scene, camera);
    
    // 管理内存
    this.memoryManager.cleanup();
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  getStats() {
    return {
      performance: this.renderOptimizer.getPerformanceStats(),
      qualityLevel: this.renderOptimizer.getQualityLevel(),
      memoryPressure: this.memoryManager.checkMemoryUsage()
    };
  }

  setTargetFPS(fps: number): void {
    this.renderOptimizer.setTargetFPS(fps);
  }

  trackObject(object: THREE.Object3D): void {
    this.memoryManager.trackObject(object);
  }

  untrackObject(object: THREE.Object3D): void {
    this.memoryManager.untrackObject(object);
  }
}