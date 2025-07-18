import { Logger } from '../utils/logger';
import { 
  TaskDependency, 
  DependencyStatus, 
  TaskDependencyCheck, 
  InstallDependencyRequest,
  InstallDependencyResult,
  TaskSandboxConfig
} from '../types/task';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import * as semver from 'semver';

export class DependencyManager {
  private logger: Logger;
  private dependenciesPath: string;
  private packageJsonCache: Map<string, any> = new Map();

  constructor() {
    this.logger = new Logger('DependencyManager');
    this.dependenciesPath = path.join(app.getPath('userData'), 'task-dependencies');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dependenciesPath, { recursive: true });
      this.logger.info('Dependency manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize dependency manager:', error);
      throw error;
    }
  }

  /**
   * 检查任务依赖状态
   */
  async checkDependencies(taskId: string, dependencies: TaskDependency[]): Promise<TaskDependencyCheck> {
    this.logger.info(`Checking dependencies for task: ${taskId}`);
    
    const dependencyStatuses: DependencyStatus[] = [];
    const missingDependencies: TaskDependency[] = [];
    const incompatibleDependencies: TaskDependency[] = [];

    for (const dependency of dependencies) {
      try {
        const status = await this.checkSingleDependency(dependency);
        dependencyStatuses.push(status);

        if (!status.installed && !dependency.optional) {
          missingDependencies.push(dependency);
        } else if (status.installed && !status.compatible) {
          incompatibleDependencies.push(dependency);
        }
      } catch (error) {
        this.logger.error(`Error checking dependency ${dependency.name}:`, error);
        dependencyStatuses.push({
          name: dependency.name,
          version: dependency.version,
          type: dependency.type,
          installed: false,
          compatible: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        if (!dependency.optional) {
          missingDependencies.push(dependency);
        }
      }
    }

    const satisfied = missingDependencies.length === 0 && incompatibleDependencies.length === 0;
    const installRequired = missingDependencies.length > 0 || incompatibleDependencies.length > 0;

    return {
      taskId,
      satisfied,
      dependencies: dependencyStatuses,
      missingDependencies,
      incompatibleDependencies,
      installRequired
    };
  }

  /**
   * 检查单个依赖状态
   */
  private async checkSingleDependency(dependency: TaskDependency): Promise<DependencyStatus> {
    switch (dependency.type) {
      case 'npm':
        return await this.checkNpmDependency(dependency);
      case 'browser-api':
        return await this.checkBrowserApiDependency(dependency);
      case 'system':
        return await this.checkSystemDependency(dependency);
      case 'builtin':
        return await this.checkBuiltinDependency(dependency);
      default:
        throw new Error(`Unknown dependency type: ${dependency.type}`);
    }
  }

  /**
   * 检查NPM依赖
   */
  private async checkNpmDependency(dependency: TaskDependency): Promise<DependencyStatus> {
    const taskNodeModulesPath = path.join(this.dependenciesPath, 'node_modules');
    const packagePath = path.join(taskNodeModulesPath, dependency.name, 'package.json');

    try {
      const packageData = await this.readPackageJson(packagePath);
      const installedVersion = packageData.version;
      const compatible = semver.satisfies(installedVersion, dependency.version);

      return {
        name: dependency.name,
        version: dependency.version,
        type: dependency.type,
        installed: true,
        installedVersion,
        compatible,
        installPath: path.dirname(packagePath)
      };
    } catch (error) {
      return {
        name: dependency.name,
        version: dependency.version,
        type: dependency.type,
        installed: false,
        compatible: false,
        error: 'Package not found'
      };
    }
  }

  /**
   * 检查浏览器API依赖
   */
  private async checkBrowserApiDependency(dependency: TaskDependency): Promise<DependencyStatus> {
    // 这里可以检查Puppeteer支持的API
    const supportedApis = [
      'puppeteer',
      'playwright', 
      'selenium-webdriver',
      'chrome-devtools-protocol'
    ];

    const installed = supportedApis.includes(dependency.name);
    
    return {
      name: dependency.name,
      version: dependency.version,
      type: dependency.type,
      installed,
      compatible: installed,
      installedVersion: installed ? '1.0.0' : undefined
    };
  }

  /**
   * 检查系统依赖
   */
  private async checkSystemDependency(dependency: TaskDependency): Promise<DependencyStatus> {
    try {
      // 检查系统命令是否存在
      await this.executeCommand(`which ${dependency.name}`, { timeout: 5000 });
      
      return {
        name: dependency.name,
        version: dependency.version,
        type: dependency.type,
        installed: true,
        compatible: true,
        installedVersion: 'system'
      };
    } catch (error) {
      return {
        name: dependency.name,
        version: dependency.version,
        type: dependency.type,
        installed: false,
        compatible: false,
        error: 'System command not found'
      };
    }
  }

  /**
   * 检查内置依赖
   */
  private async checkBuiltinDependency(dependency: TaskDependency): Promise<DependencyStatus> {
    // 内置依赖总是可用的
    const builtinModules = [
      'fs', 'path', 'crypto', 'util', 'url', 'querystring',
      'puppeteer-utils', 'task-utils', 'logger'
    ];

    const installed = builtinModules.includes(dependency.name);
    
    return {
      name: dependency.name,
      version: dependency.version,
      type: dependency.type,
      installed,
      compatible: installed,
      installedVersion: installed ? '1.0.0' : undefined
    };
  }

  /**
   * 安装依赖
   */
  async installDependencies(request: InstallDependencyRequest): Promise<InstallDependencyResult> {
    this.logger.info(`Installing dependencies for task: ${request.taskId}`);
    
    const installed: DependencyStatus[] = [];
    const failed: Array<{ dependency: TaskDependency; error: string }> = [];
    const warnings: string[] = [];

    for (const dependency of request.dependencies) {
      try {
        if (dependency.type === 'npm') {
          const result = await this.installNpmDependency(dependency, request.force);
          installed.push(result);
        } else if (dependency.type === 'system') {
          warnings.push(`System dependency '${dependency.name}' cannot be automatically installed`);
        } else if (dependency.type === 'browser-api' || dependency.type === 'builtin') {
          // 这些依赖不需要安装
          const status = await this.checkSingleDependency(dependency);
          installed.push(status);
        }
      } catch (error) {
        this.logger.error(`Failed to install dependency ${dependency.name}:`, error);
        failed.push({
          dependency,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const success = failed.length === 0;
    
    this.logger.info(`Dependency installation completed. Success: ${success}, Installed: ${installed.length}, Failed: ${failed.length}`);
    
    return {
      success,
      installed,
      failed,
      warnings
    };
  }

  /**
   * 安装NPM依赖
   */
  private async installNpmDependency(dependency: TaskDependency, force = false): Promise<DependencyStatus> {
    const packageSpec = `${dependency.name}@${dependency.version}`;
    
    // 检查是否已安装且版本兼容
    if (!force) {
      const existingStatus = await this.checkNpmDependency(dependency);
      if (existingStatus.installed && existingStatus.compatible) {
        this.logger.info(`Dependency ${dependency.name} already installed and compatible`);
        return existingStatus;
      }
    }

    this.logger.info(`Installing NPM package: ${packageSpec}`);
    
    try {
      const command = `npm install ${packageSpec} --prefix "${this.dependenciesPath}" --save --no-package-lock`;
      await this.executeCommand(command, { timeout: 120000 }); // 2分钟超时
      
      // 验证安装结果
      const status = await this.checkNpmDependency(dependency);
      if (!status.installed) {
        throw new Error('Package installation verification failed');
      }
      
      this.logger.info(`Successfully installed: ${packageSpec}`);
      return status;
    } catch (error) {
      this.logger.error(`Failed to install NPM package ${packageSpec}:`, error);
      throw error;
    }
  }

  /**
   * 创建任务沙箱环境
   */
  async createSandbox(taskId: string, config: TaskSandboxConfig): Promise<string> {
    const sandboxPath = path.join(this.dependenciesPath, 'sandboxes', taskId);
    
    try {
      await fs.mkdir(sandboxPath, { recursive: true });
      
      // 创建沙箱package.json
      const packageJson = {
        name: `task-${taskId}`,
        version: '1.0.0',
        private: true,
        dependencies: {}
      };
      
      await fs.writeFile(
        path.join(sandboxPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      // 复制必要的依赖到沙箱
      if (config.allowFileSystem) {
        const nodeModulesSource = path.join(this.dependenciesPath, 'node_modules');
        const nodeModulesTarget = path.join(sandboxPath, 'node_modules');
        
        try {
          await this.copyDirectory(nodeModulesSource, nodeModulesTarget);
        } catch (error) {
          this.logger.warn('Failed to copy node_modules to sandbox:', error);
        }
      }
      
      this.logger.info(`Created sandbox for task ${taskId}: ${sandboxPath}`);
      return sandboxPath;
    } catch (error) {
      this.logger.error(`Failed to create sandbox for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * 清理任务沙箱
   */
  async cleanupSandbox(taskId: string): Promise<void> {
    const sandboxPath = path.join(this.dependenciesPath, 'sandboxes', taskId);
    
    try {
      await fs.rm(sandboxPath, { recursive: true, force: true });
      this.logger.info(`Cleaned up sandbox for task: ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup sandbox for task ${taskId}:`, error);
    }
  }

  /**
   * 获取依赖存储路径
   */
  getDependenciesPath(): string {
    return this.dependenciesPath;
  }

  /**
   * 清理所有依赖
   */
  async cleanupAllDependencies(): Promise<void> {
    try {
      await fs.rm(this.dependenciesPath, { recursive: true, force: true });
      await fs.mkdir(this.dependenciesPath, { recursive: true });
      this.logger.info('Cleaned up all task dependencies');
    } catch (error) {
      this.logger.error('Failed to cleanup dependencies:', error);
      throw error;
    }
  }

  // 辅助方法

  private async readPackageJson(packagePath: string): Promise<any> {
    if (this.packageJsonCache.has(packagePath)) {
      return this.packageJsonCache.get(packagePath);
    }

    const content = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(content);
    this.packageJsonCache.set(packagePath, packageData);
    return packageData;
  }

  private async executeCommand(command: string, options: { timeout?: number } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { shell: true });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  }

  private async copyDirectory(source: string, target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  /**
   * 检查依赖包的安全性
   */
  async checkDependencySecurity(dependencies: TaskDependency[]): Promise<{
    safe: boolean;
    vulnerabilities: Array<{
      dependency: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }>;
    warnings: string[];
  }> {
    this.logger.info('Performing security check on dependencies');
    
    const vulnerabilities: Array<{
      dependency: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
      description: string;
      recommendation: string;
    }> = [];
    
    const warnings: string[] = [];
    
    // 已知的危险包列表（示例）
    const knownVulnerablePackages = new Map([
      ['event-stream', {
        severity: 'critical' as const,
        description: 'Known malicious package that steals cryptocurrency',
        recommendation: 'Do not use this package under any circumstances'
      }],
      ['flatmap-stream', {
        severity: 'critical' as const,
        description: 'Malicious package used in supply chain attack',
        recommendation: 'Use alternative packages for stream processing'
      }],
      ['eslint-scope', {
        severity: 'high' as const,
        description: 'Compromised package that harvests npm credentials',
        recommendation: 'Update to latest version or use alternative'
      }]
    ]);
    
    // 可疑的包名模式
    const suspiciousPatterns = [
      /^[a-z]{1,3}$/,           // 过短的包名
      /[0-9]{8,}/,              // 包含长数字序列
      /^(test|temp|tmp)/,       // 测试或临时包
      /[A-Z]{3,}/,              // 包含多个大写字母
    ];
    
    for (const dependency of dependencies) {
      try {
        // 检查已知漏洞
        const knownVuln = knownVulnerablePackages.get(dependency.name);
        if (knownVuln) {
          vulnerabilities.push({
            dependency: dependency.name,
            severity: knownVuln.severity,
            description: knownVuln.description,
            recommendation: knownVuln.recommendation
          });
          continue;
        }
        
        // 检查可疑的包名模式
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(dependency.name)) {
            warnings.push(`Suspicious package name pattern: ${dependency.name}`);
            break;
          }
        }
        
        // 检查版本号的合理性
        if (dependency.version && dependency.version !== 'latest') {
          try {
            if (!semver.valid(dependency.version)) {
              warnings.push(`Invalid version format for ${dependency.name}: ${dependency.version}`);
            }
          } catch (versionError) {
            warnings.push(`Could not validate version for ${dependency.name}: ${dependency.version}`);
          }
        }
        
        // 检查包的来源和完整性（模拟）
        await this.checkPackageIntegrity(dependency, warnings);
        
      } catch (error) {
        this.logger.warn(`Security check failed for ${dependency.name}:`, error);
        warnings.push(`Could not perform security check for ${dependency.name}`);
      }
    }
    
    const safe = vulnerabilities.length === 0;
    
    this.logger.info(`Security check completed. Safe: ${safe}, Vulnerabilities: ${vulnerabilities.length}, Warnings: ${warnings.length}`);
    
    return {
      safe,
      vulnerabilities,
      warnings
    };
  }
  
  /**
   * 检查包的完整性（模拟实现）
   */
  private async checkPackageIntegrity(dependency: TaskDependency, warnings: string[]): Promise<void> {
    try {
      // 这里可以实现真实的包完整性检查
      // 例如：检查包的签名、下载量、维护状态等
      
      // 模拟检查包的基本信息
      if (dependency.type === 'npm') {
        // 检查包名长度
        if (dependency.name.length < 2) {
          warnings.push(`Package name too short: ${dependency.name}`);
        }
        
        // 检查是否包含常见的恶意关键词
        const maliciousKeywords = ['bitcoin', 'wallet', 'crypto', 'password', 'credential'];
        const lowerName = dependency.name.toLowerCase();
        
        for (const keyword of maliciousKeywords) {
          if (lowerName.includes(keyword)) {
            warnings.push(`Package name contains potentially sensitive keyword: ${dependency.name}`);
            break;
          }
        }
        
        // 检查版本是否过于新或过于旧
        if (dependency.version && dependency.version !== 'latest') {
          try {
            const version = semver.parse(dependency.version);
            if (version) {
              if (version.major > 50) {
                warnings.push(`Unusually high major version for ${dependency.name}: ${dependency.version}`);
              }
            }
          } catch (versionError) {
            // 版本解析错误已在上层处理
          }
        }
      }
      
    } catch (error) {
      this.logger.warn(`Package integrity check failed for ${dependency.name}:`, error);
      warnings.push(`Could not verify integrity of ${dependency.name}`);
    }
  }
  
  /**
   * 获取依赖安全报告
   */
  async generateSecurityReport(taskId: string, dependencies: TaskDependency[]): Promise<string> {
    const securityCheck = await this.checkDependencySecurity(dependencies);
    
    let report = `Dependency Security Report for Task: ${taskId}\n`;
    report += `${'='.repeat(60)}\n\n`;
    
    report += `Overall Status: ${securityCheck.safe ? '✅ SAFE' : '⚠️ ISSUES FOUND'}\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    if (securityCheck.vulnerabilities.length > 0) {
      report += `🚨 VULNERABILITIES (${securityCheck.vulnerabilities.length}):\n`;
      report += `-`.repeat(40) + '\n';
      
      securityCheck.vulnerabilities.forEach((vuln, index) => {
        report += `${index + 1}. ${vuln.dependency}\n`;
        report += `   Severity: ${vuln.severity.toUpperCase()}\n`;
        report += `   Description: ${vuln.description}\n`;
        report += `   Recommendation: ${vuln.recommendation}\n\n`;
      });
    }
    
    if (securityCheck.warnings.length > 0) {
      report += `⚠️ WARNINGS (${securityCheck.warnings.length}):\n`;
      report += `-`.repeat(40) + '\n';
      
      securityCheck.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning}\n`;
      });
      report += '\n';
    }
    
    if (securityCheck.safe && securityCheck.warnings.length === 0) {
      report += `✅ All dependencies passed security checks.\n`;
    }
    
    report += `\nDependencies Checked (${dependencies.length}):\n`;
    report += `-`.repeat(40) + '\n';
    dependencies.forEach((dep, index) => {
      report += `${index + 1}. ${dep.name}@${dep.version} (${dep.type})\n`;
    });
    
    report += `\nReport generated by Web3 Client Dependency Security Scanner\n`;
    
    return report;
  }
}