import { v4 as uuidv4 } from 'uuid';
import {
  SecurityProfile,
  Permission,
  SecurityRestriction,
  VirtualIdentity,
  EmulatorError,
  AndroidApp
} from '../types/android-emulator';
import { ADBController } from './adbController';

export class AndroidSecurityManager {
  private static instance: AndroidSecurityManager;
  private adbController: ADBController;
  private securityProfiles: Map<string, SecurityProfile> = new Map();
  private activeProfiles: Map<string, string> = new Map(); // deviceSerial -> profileId
  private permissionHistory: Map<string, Permission[]> = new Map();
  private securityEvents: Array<{
    timestamp: Date;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    device: string;
    details: any;
  }> = [];

  // 预定义的安全配置
  private readonly defaultProfiles: SecurityProfile[] = [
    {
      id: 'default',
      name: '默认安全配置',
      permissions: [],
      restrictions: [
        {
          type: 'network_access',
          allowed: true,
          whitelist: [],
          blacklist: []
        }
      ],
      dataIsolation: false,
      networkIsolation: false
    },
    {
      id: 'strict',
      name: '严格安全配置',
      permissions: [],
      restrictions: [
        {
          type: 'network_access',
          allowed: true,
          whitelist: ['127.0.0.1', 'localhost'],
          blacklist: []
        },
        {
          type: 'file_access',
          allowed: false,
          whitelist: ['/sdcard/Android/data/'],
          blacklist: ['/system/', '/data/']
        },
        {
          type: 'contact_access',
          allowed: false,
          whitelist: [],
          blacklist: []
        },
        {
          type: 'location_access',
          allowed: false,
          whitelist: [],
          blacklist: []
        }
      ],
      dataIsolation: true,
      networkIsolation: true
    },
    {
      id: 'testing',
      name: '测试环境配置',
      permissions: [],
      restrictions: [
        {
          type: 'network_access',
          allowed: true,
          whitelist: [],
          blacklist: ['facebook.com', 'google-analytics.com']
        }
      ],
      virtualIdentity: {
        name: '测试用户',
        email: 'test@example.com',
        phone: '13800138000',
        address: '测试地址',
        deviceId: 'TEST_DEVICE_001',
        imei: '000000000000000'
      },
      dataIsolation: true,
      networkIsolation: false
    }
  ];

  // 危险权限列表
  private readonly dangerousPermissions = [
    'android.permission.READ_CONTACTS',
    'android.permission.WRITE_CONTACTS',
    'android.permission.READ_SMS',
    'android.permission.SEND_SMS',
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.READ_PHONE_STATE',
    'android.permission.CALL_PHONE',
    'android.permission.READ_CALL_LOG',
    'android.permission.WRITE_CALL_LOG',
    'android.permission.READ_CALENDAR',
    'android.permission.WRITE_CALENDAR',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE'
  ];

  // 敏感API列表
  private readonly sensitiveApis = [
    'TelephonyManager.getDeviceId',
    'TelephonyManager.getSubscriberId',
    'LocationManager.getLastKnownLocation',
    'ContactsContract.CommonDataKinds',
    'SmsManager.sendTextMessage',
    'MediaRecorder.start',
    'Camera.open'
  ];

  private constructor() {
    this.adbController = ADBController.getInstance();
    this.initializeDefaultProfiles();
  }

  public static getInstance(): AndroidSecurityManager {
    if (!AndroidSecurityManager.instance) {
      AndroidSecurityManager.instance = new AndroidSecurityManager();
    }
    return AndroidSecurityManager.instance;
  }

  private initializeDefaultProfiles(): void {
    for (const profile of this.defaultProfiles) {
      this.securityProfiles.set(profile.id, profile);
    }
  }

  // 安全配置管理
  public createSecurityProfile(
    name: string,
    restrictions: SecurityRestriction[],
    virtualIdentity?: VirtualIdentity,
    dataIsolation: boolean = false,
    networkIsolation: boolean = false
  ): SecurityProfile {
    const profile: SecurityProfile = {
      id: uuidv4(),
      name,
      permissions: [],
      restrictions,
      virtualIdentity,
      dataIsolation,
      networkIsolation
    };

    this.securityProfiles.set(profile.id, profile);
    return profile;
  }

  public updateSecurityProfile(profileId: string, updates: Partial<SecurityProfile>): boolean {
    const profile = this.securityProfiles.get(profileId);
    if (!profile) {
      return false;
    }

    Object.assign(profile, updates);
    this.securityProfiles.set(profileId, profile);
    
    // 如果有设备正在使用此配置，重新应用
    for (const [deviceSerial, activeProfileId] of this.activeProfiles.entries()) {
      if (activeProfileId === profileId) {
        this.applySecurityProfile(deviceSerial, profileId);
      }
    }

    return true;
  }

  public deleteSecurityProfile(profileId: string): boolean {
    if (profileId === 'default' || profileId === 'strict') {
      return false; // 不能删除默认配置
    }

    return this.securityProfiles.delete(profileId);
  }

  public getSecurityProfile(profileId: string): SecurityProfile | null {
    return this.securityProfiles.get(profileId) || null;
  }

  public getAllSecurityProfiles(): SecurityProfile[] {
    return Array.from(this.securityProfiles.values());
  }

  // 安全配置应用
  public async applySecurityProfile(deviceSerial: string, profileId: string): Promise<boolean> {
    const profile = this.securityProfiles.get(profileId);
    if (!profile) {
      this.logSecurityEvent('error', 'medium', deviceSerial, {
        action: 'apply_profile',
        error: `Profile ${profileId} not found`
      });
      return false;
    }

    try {
      this.logSecurityEvent('profile_apply_start', 'low', deviceSerial, {
        profileId,
        profileName: profile.name
      });

      // 应用网络限制
      await this.applyNetworkRestrictions(deviceSerial, profile);

      // 应用文件访问限制
      await this.applyFileRestrictions(deviceSerial, profile);

      // 应用权限管理
      await this.applyPermissionRestrictions(deviceSerial, profile);

      // 设置虚拟身份
      if (profile.virtualIdentity) {
        await this.applyVirtualIdentity(deviceSerial, profile.virtualIdentity);
      }

      // 启用数据隔离
      if (profile.dataIsolation) {
        await this.enableDataIsolation(deviceSerial);
      }

      // 启用网络隔离
      if (profile.networkIsolation) {
        await this.enableNetworkIsolation(deviceSerial);
      }

      this.activeProfiles.set(deviceSerial, profileId);
      
      this.logSecurityEvent('profile_applied', 'low', deviceSerial, {
        profileId,
        profileName: profile.name
      });

      return true;

    } catch (error) {
      this.logSecurityEvent('profile_apply_error', 'high', deviceSerial, {
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // 网络限制
  private async applyNetworkRestrictions(
    deviceSerial: string,
    profile: SecurityProfile
  ): Promise<void> {
    const networkRestriction = profile.restrictions.find(r => r.type === 'network_access');
    if (!networkRestriction) {
      return;
    }

    if (!networkRestriction.allowed) {
      // 完全禁用网络访问
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'svc', 'wifi', 'disable']
      });
      
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'svc', 'data', 'disable']
      });
    } else {
      // 应用网络白名单/黑名单
      if (networkRestriction.blacklist && networkRestriction.blacklist.length > 0) {
        await this.setupNetworkBlacklist(deviceSerial, networkRestriction.blacklist);
      }
      
      if (networkRestriction.whitelist && networkRestriction.whitelist.length > 0) {
        await this.setupNetworkWhitelist(deviceSerial, networkRestriction.whitelist);
      }
    }
  }

  private async setupNetworkBlacklist(deviceSerial: string, blacklist: string[]): Promise<void> {
    // 使用iptables设置网络黑名单
    for (const domain of blacklist) {
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', `iptables -A OUTPUT -d ${domain} -j DROP`]
      });
    }
  }

  private async setupNetworkWhitelist(deviceSerial: string, whitelist: string[]): Promise<void> {
    // 首先阻止所有外部连接
    await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'su', '-c', 'iptables -P OUTPUT DROP']
    });

    // 允许白名单中的连接
    for (const domain of whitelist) {
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', `iptables -A OUTPUT -d ${domain} -j ACCEPT`]
      });
    }
  }

  // 文件访问限制
  private async applyFileRestrictions(
    deviceSerial: string,
    profile: SecurityProfile
  ): Promise<void> {
    const fileRestriction = profile.restrictions.find(r => r.type === 'file_access');
    if (!fileRestriction) {
      return;
    }

    if (!fileRestriction.allowed) {
      // 设置严格的文件权限
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 'chmod 700 /sdcard']
      });
    }

    // 应用黑名单目录限制
    if (fileRestriction.blacklist) {
      for (const path of fileRestriction.blacklist) {
        await this.adbController.executeCommand({
          command: '-s',
          args: [deviceSerial, 'shell', 'su', '-c', `chmod 000 ${path}`]
        });
      }
    }
  }

  // 权限管理
  private async applyPermissionRestrictions(
    deviceSerial: string,
    profile: SecurityProfile
  ): Promise<void> {
    // 获取已安装应用列表
    const appsResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'pm', 'list', 'packages']
    });

    if (!appsResponse.success) {
      return;
    }

    const packages = appsResponse.output
      .split('\n')
      .filter(line => line.startsWith('package:'))
      .map(line => line.replace('package:', ''));

    // 对每个应用应用权限限制
    for (const packageName of packages) {
      await this.reviewAndRestrictAppPermissions(deviceSerial, packageName, profile);
    }
  }

  private async reviewAndRestrictAppPermissions(
    deviceSerial: string,
    packageName: string,
    profile: SecurityProfile
  ): Promise<void> {
    // 获取应用权限
    const permissionsResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'dumpsys', 'package', packageName]
    });

    if (!permissionsResponse.success) {
      return;
    }

    // 解析权限信息
    const permissions = this.parseAppPermissions(permissionsResponse.output);

    // 检查并撤销危险权限
    for (const permission of permissions) {
      if (this.dangerousPermissions.includes(permission.name)) {
        const shouldRevoke = this.shouldRevokePermission(permission, profile);
        
        if (shouldRevoke) {
          await this.revokePermission(deviceSerial, packageName, permission.name);
          
          this.logSecurityEvent('permission_revoked', 'medium', deviceSerial, {
            packageName,
            permission: permission.name,
            reason: 'Security policy'
          });
        }
      }
    }
  }

  private parseAppPermissions(dumpsysOutput: string): Permission[] {
    const permissions: Permission[] = [];
    const lines = dumpsysOutput.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\s+([^:]+):\s*(granted|denied)=(\w+)/);
      if (match) {
        permissions.push({
          name: match[1].trim(),
          granted: match[3] === 'true',
          source: 'system'
        });
      }
    }
    
    return permissions;
  }

  private shouldRevokePermission(permission: Permission, profile: SecurityProfile): boolean {
    // 检查权限是否在配置中被明确允许
    const allowedPermission = profile.permissions.find(p => 
      p.name === permission.name && p.granted
    );
    
    return !allowedPermission;
  }

  private async revokePermission(
    deviceSerial: string,
    packageName: string,
    permissionName: string
  ): Promise<boolean> {
    const response = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'pm', 'revoke', packageName, permissionName]
    });

    return response.success;
  }

  // 虚拟身份设置
  private async applyVirtualIdentity(
    deviceSerial: string,
    identity: VirtualIdentity
  ): Promise<void> {
    try {
      // 设置虚拟设备ID
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 
               `setprop ro.serialno ${identity.deviceId}`]
      });

      // 设置虚拟IMEI（需要root权限）
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c',
               `setprop ro.telephony.device_id ${identity.imei}`]
      });

      // 创建虚拟用户配置文件
      const virtualProfileData = JSON.stringify(identity);
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c',
               `echo '${virtualProfileData}' > /data/local/tmp/virtual_identity.json`]
      });

      this.logSecurityEvent('virtual_identity_applied', 'low', deviceSerial, {
        identityName: identity.name
      });

    } catch (error) {
      this.logSecurityEvent('virtual_identity_error', 'medium', deviceSerial, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // 数据隔离
  private async enableDataIsolation(deviceSerial: string): Promise<void> {
    try {
      // 创建隔离的数据目录
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 'mkdir -p /data/isolated']
      });

      // 设置严格的权限
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 'chmod 700 /data/isolated']
      });

      // 重定向应用数据到隔离目录
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 
               'mount --bind /data/isolated /data/data']
      });

      this.logSecurityEvent('data_isolation_enabled', 'low', deviceSerial, {});

    } catch (error) {
      this.logSecurityEvent('data_isolation_error', 'medium', deviceSerial, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // 网络隔离
  private async enableNetworkIsolation(deviceSerial: string): Promise<void> {
    try {
      // 创建独立的网络命名空间
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c', 'ip netns add isolated']
      });

      // 配置隔离网络
      await this.adbController.executeCommand({
        command: '-s',
        args: [deviceSerial, 'shell', 'su', '-c',
               'ip netns exec isolated ip link set lo up']
      });

      this.logSecurityEvent('network_isolation_enabled', 'low', deviceSerial, {});

    } catch (error) {
      this.logSecurityEvent('network_isolation_error', 'medium', deviceSerial, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // 安全监控
  public async startSecurityMonitoring(deviceSerial: string): Promise<string> {
    const monitorId = uuidv4();

    // 监控应用安装
    this.monitorAppInstallation(deviceSerial, monitorId);

    // 监控权限请求
    this.monitorPermissionRequests(deviceSerial, monitorId);

    // 监控网络活动
    this.monitorNetworkActivity(deviceSerial, monitorId);

    // 监控敏感API调用
    this.monitorSensitiveApiCalls(deviceSerial, monitorId);

    this.logSecurityEvent('monitoring_started', 'low', deviceSerial, {
      monitorId
    });

    return monitorId;
  }

  private async monitorAppInstallation(deviceSerial: string, monitorId: string): Promise<void> {
    // 定期检查新安装的应用
    const checkInterval = setInterval(async () => {
      try {
        const appsResponse = await this.adbController.executeCommand({
          command: '-s',
          args: [deviceSerial, 'shell', 'pm', 'list', 'packages', '-i']
        });

        if (appsResponse.success) {
          // 解析新安装的应用并进行安全评估
          // 实现逻辑...
        }
      } catch (error) {
        console.error('App monitoring error:', error);
      }
    }, 30000); // 每30秒检查一次

    // 存储监控任务（在实际项目中应该有更好的管理方式）
  }

  private async monitorPermissionRequests(deviceSerial: string, monitorId: string): Promise<void> {
    // 监控权限请求日志
    const logResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'logcat', '-s', 'PackageManager:V', '-T', '1']
    });

    // 解析权限相关的日志
    // 实现逻辑...
  }

  private async monitorNetworkActivity(deviceSerial: string, monitorId: string): Promise<void> {
    // 监控网络连接
    const netstatResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'netstat', '-an']
    });

    if (netstatResponse.success) {
      const connections = this.parseNetworkConnections(netstatResponse.output);
      
      for (const connection of connections) {
        if (this.isSuspiciousConnection(connection)) {
          this.logSecurityEvent('suspicious_network_activity', 'medium', deviceSerial, {
            connection,
            monitorId
          });
        }
      }
    }
  }

  private parseNetworkConnections(netstatOutput: string): any[] {
    const connections: any[] = [];
    const lines = netstatOutput.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        connections.push({
          protocol: parts[0],
          localAddress: parts[3],
          remoteAddress: parts[4],
          state: parts[5]
        });
      }
    }
    
    return connections;
  }

  private isSuspiciousConnection(connection: any): boolean {
    // 检查是否连接到可疑地址
    const suspiciousDomains = [
      'malware.com',
      'phishing.net',
      // 添加更多可疑域名
    ];
    
    return suspiciousDomains.some(domain => 
      connection.remoteAddress.includes(domain)
    );
  }

  private async monitorSensitiveApiCalls(deviceSerial: string, monitorId: string): Promise<void> {
    // 使用frida或其他工具监控敏感API调用
    // 这里提供一个简化的实现
    
    for (const api of this.sensitiveApis) {
      // 检查API调用频率和模式
      // 实现逻辑...
    }
  }

  // 风险评估
  public async assessSecurityRisk(deviceSerial: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: Array<{
      category: string;
      risk: string;
      impact: number;
      description: string;
    }>;
    recommendations: string[];
  }> {
    const riskFactors: any[] = [];
    let totalScore = 0;

    // 检查已安装应用的风险
    const appRisk = await this.assessAppRisk(deviceSerial);
    riskFactors.push(...appRisk.factors);
    totalScore += appRisk.score;

    // 检查权限配置风险
    const permissionRisk = await this.assessPermissionRisk(deviceSerial);
    riskFactors.push(...permissionRisk.factors);
    totalScore += permissionRisk.score;

    // 检查网络配置风险
    const networkRisk = await this.assessNetworkRisk(deviceSerial);
    riskFactors.push(...networkRisk.factors);
    totalScore += networkRisk.score;

    // 检查系统配置风险
    const systemRisk = await this.assessSystemRisk(deviceSerial);
    riskFactors.push(...systemRisk.factors);
    totalScore += systemRisk.score;

    // 计算风险等级
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (totalScore < 20) {
      riskLevel = 'low';
    } else if (totalScore < 50) {
      riskLevel = 'medium';
    } else if (totalScore < 80) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    // 生成建议
    const recommendations = this.generateSecurityRecommendations(riskFactors, riskLevel);

    return {
      riskLevel,
      score: totalScore,
      factors: riskFactors,
      recommendations
    };
  }

  private async assessAppRisk(deviceSerial: string): Promise<{
    score: number;
    factors: any[];
  }> {
    const factors: any[] = [];
    let score = 0;

    // 获取已安装应用
    const appsResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'pm', 'list', 'packages']
    });

    if (appsResponse.success) {
      const packages = appsResponse.output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', ''));

      // 检查已知恶意应用
      const maliciousApps = packages.filter(pkg => this.isMaliciousApp(pkg));
      if (maliciousApps.length > 0) {
        factors.push({
          category: 'applications',
          risk: '恶意应用',
          impact: 50,
          description: `检测到${maliciousApps.length}个恶意应用`
        });
        score += 50;
      }

      // 检查未知来源应用
      const unknownApps = packages.filter(pkg => this.isUnknownSourceApp(pkg));
      if (unknownApps.length > 5) {
        factors.push({
          category: 'applications',
          risk: '未知来源应用过多',
          impact: 20,
          description: `安装了${unknownApps.length}个来源不明的应用`
        });
        score += 20;
      }
    }

    return { score, factors };
  }

  private async assessPermissionRisk(deviceSerial: string): Promise<{
    score: number;
    factors: any[];
  }> {
    const factors: any[] = [];
    let score = 0;

    // 检查危险权限的授予情况
    const dangerousPermCount = await this.countDangerousPermissions(deviceSerial);
    
    if (dangerousPermCount > 20) {
      factors.push({
        category: 'permissions',
        risk: '危险权限过多',
        impact: 30,
        description: `授予了${dangerousPermCount}个危险权限`
      });
      score += 30;
    }

    return { score, factors };
  }

  private async assessNetworkRisk(deviceSerial: string): Promise<{
    score: number;
    factors: any[];
  }> {
    const factors: any[] = [];
    let score = 0;

    // 检查网络配置
    const networkInfo = await this.adbController.getNetworkInfo(deviceSerial);
    
    // 这里可以添加更多网络风险检查
    // 例如：开放端口、不安全协议等

    return { score, factors };
  }

  private async assessSystemRisk(deviceSerial: string): Promise<{
    score: number;
    factors: any[];
  }> {
    const factors: any[] = [];
    let score = 0;

    // 检查root状态
    const rootResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'su', '-c', 'id']
    });

    if (rootResponse.success && rootResponse.output.includes('uid=0')) {
      factors.push({
        category: 'system',
        risk: '设备已root',
        impact: 25,
        description: '设备具有root权限，增加了安全风险'
      });
      score += 25;
    }

    // 检查调试模式
    const debugResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'getprop', 'ro.debuggable']
    });

    if (debugResponse.success && debugResponse.output.trim() === '1') {
      factors.push({
        category: 'system',
        risk: '调试模式开启',
        impact: 15,
        description: '系统处于调试模式，可能存在安全隐患'
      });
      score += 15;
    }

    return { score, factors };
  }

  private isMaliciousApp(packageName: string): boolean {
    // 检查已知恶意应用列表
    const maliciousApps = [
      'com.malware.app',
      'com.virus.scanner',
      // 添加更多已知恶意应用包名
    ];
    
    return maliciousApps.includes(packageName);
  }

  private isUnknownSourceApp(packageName: string): boolean {
    // 检查是否来自已知应用商店
    const knownSources = [
      'com.android.',
      'com.google.',
      'com.samsung.',
      'com.huawei.',
      'com.xiaomi.',
      'com.tencent.',
      'com.alibaba.',
      'com.baidu.'
    ];
    
    return !knownSources.some(source => packageName.startsWith(source));
  }

  private async countDangerousPermissions(deviceSerial: string): Promise<number> {
    let count = 0;
    
    const appsResponse = await this.adbController.executeCommand({
      command: '-s',
      args: [deviceSerial, 'shell', 'pm', 'list', 'packages']
    });

    if (appsResponse.success) {
      const packages = appsResponse.output
        .split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', ''));

      for (const packageName of packages.slice(0, 10)) { // 限制检查数量
        const permissionsResponse = await this.adbController.executeCommand({
          command: '-s',
          args: [deviceSerial, 'shell', 'dumpsys', 'package', packageName]
        });

        if (permissionsResponse.success) {
          const permissions = this.parseAppPermissions(permissionsResponse.output);
          count += permissions.filter(p => 
            p.granted && this.dangerousPermissions.includes(p.name)
          ).length;
        }
      }
    }
    
    return count;
  }

  private generateSecurityRecommendations(
    factors: any[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    // 基于风险等级的通用建议
    switch (riskLevel) {
      case 'critical':
        recommendations.push('立即停止使用设备，执行完整的安全审计');
        recommendations.push('重置设备到出厂设置');
        break;
      case 'high':
        recommendations.push('限制设备的网络访问');
        recommendations.push('卸载所有非必要应用');
        break;
      case 'medium':
        recommendations.push('审查已安装应用的权限');
        recommendations.push('启用严格安全配置');
        break;
      case 'low':
        recommendations.push('定期进行安全检查');
        break;
    }

    // 基于具体风险因素的建议
    for (const factor of factors) {
      switch (factor.category) {
        case 'applications':
          if (factor.risk.includes('恶意')) {
            recommendations.push('立即卸载所有恶意应用');
          }
          if (factor.risk.includes('未知来源')) {
            recommendations.push('限制未知来源应用的安装');
          }
          break;
        case 'permissions':
          recommendations.push('撤销不必要的危险权限');
          break;
        case 'system':
          if (factor.risk.includes('root')) {
            recommendations.push('考虑取消root权限');
          }
          if (factor.risk.includes('调试')) {
            recommendations.push('关闭开发者选项和USB调试');
          }
          break;
      }
    }

    return [...new Set(recommendations)]; // 去重
  }

  // 安全事件记录
  private logSecurityEvent(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    device: string,
    details: any
  ): void {
    const event = {
      timestamp: new Date(),
      type,
      severity,
      device,
      details
    };

    this.securityEvents.push(event);

    // 保持事件日志在合理范围内
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }

    // 如果是高风险事件，可以触发警报
    if (severity === 'high' || severity === 'critical') {
      this.triggerSecurityAlert(event);
    }
  }

  private triggerSecurityAlert(event: any): void {
    console.warn('安全警报:', event);
    // 在实际项目中，这里可以发送通知、邮件等
  }

  // 公共方法
  public getActiveProfile(deviceSerial: string): string | null {
    return this.activeProfiles.get(deviceSerial) || null;
  }

  public getSecurityEvents(
    deviceSerial?: string,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): any[] {
    let events = this.securityEvents;

    if (deviceSerial) {
      events = events.filter(e => e.device === deviceSerial);
    }

    if (severity) {
      events = events.filter(e => e.severity === severity);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public exportSecurityReport(deviceSerial: string): any {
    return {
      device: deviceSerial,
      activeProfile: this.getActiveProfile(deviceSerial),
      events: this.getSecurityEvents(deviceSerial),
      timestamp: new Date()
    };
  }

  // 清理资源
  public cleanup(): void {
    this.securityProfiles.clear();
    this.activeProfiles.clear();
    this.permissionHistory.clear();
    this.securityEvents.length = 0;
  }
}

export default AndroidSecurityManager;