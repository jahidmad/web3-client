/**
 * NPM Dependency Installer
 * 
 * This service handles the installation of npm dependencies for plugin tasks.
 * It provides a secure and isolated environment for installing and managing
 * npm packages required by tasks.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { app } from 'electron';
import * as semver from 'semver';
import { v4 as uuidv4 } from 'uuid';
import { 
  DependencyInfo, 
  DependencyInstallRequest, 
  DependencyInstallResult,
  DependencyStatus,
  TaskError,
  ErrorCode
} from '../../shared/types';

/**
 * NPM Dependency Installer options
 */
export interface NpmDependencyInstallerOptions {
  /**
   * Base directory for storing dependencies
   */
  baseDir?: string;
  
  /**
   * Maximum installation timeout in milliseconds
   */
  installTimeout?: number;
  
  /**
   * Whether to use a global cache for dependencies
   */
  useGlobalCache?: boolean;
  
  /**
   * Whether to allow network access during installation
   */
  allowNetwork?: boolean;
  
  /**
   * Maximum number of concurrent installations
   */
  maxConcurrentInstalls?: number;
}

/**
 * NPM Dependency Installer - Service for installing and managing npm dependencies
 */
export class NpmDependencyInstaller {
  private baseDir: string;
  private installTimeout: number;
  private useGlobalCache: boolean;
  private allowNetwork: boolean;
  private maxConcurrentInstalls: number;
  private activeInstallations: number = 0;
  private installQueue: Array<() => Promise<void>> = [];
  
  /**
   * Create a new NPM Dependency Installer
   */
  constructor(options: NpmDependencyInstallerOptions = {}) {
    this.baseDir = options.baseDir || path.join(app.getPath('userData'), 'plugin-task-dependencies');
    this.installTimeout = options.installTimeout || 120000; // 2 minutes
    this.useGlobalCache = options.useGlobalCache !== false;
    this.allowNetwork = options.allowNetwork !== false;
    this.maxConcurrentInstalls = options.maxConcurrentInstalls || 2;
  }
  
  /**
   * Initialize the installer
   */
  async initialize(): Promise<void> {
    try {
      // Create the base directory if it doesn't exist
      await fs.mkdir(this.baseDir, { recursive: true });
      
      // Create the global cache directory if using global cache
      if (this.useGlobalCache) {
        await fs.mkdir(path.join(this.baseDir, 'cache'), { recursive: true });
      }
      
      // Create the package directory
      await fs.mkdir(path.join(this.baseDir, 'packages'), { recursive: true });
      
      console.log(`[NpmDependencyInstaller] Initialized at ${this.baseDir}`);
    } catch (error) {
      console.error('[NpmDependencyInstaller] Failed to initialize:', error);
      throw new TaskError(
        ErrorCode.FILE_SYSTEM_ERROR,
        `Failed to initialize dependency installer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Install dependencies for a task
   */
  async installDependencies(request: DependencyInstallRequest): Promise<DependencyInstallResult> {
    console.log(`[NpmDependencyInstaller] Installing dependencies for task: ${request.taskId}`);
    
    const installed: DependencyInfo[] = [];
    const failed: Array<{ dependency: string; error: string }> = [];
    const warnings: string[] = [];
    
    // Filter npm dependencies
    const npmDependencies = request.dependencies.filter(dep => {
      // Simple check - if it doesn't contain a protocol or path separator, assume it's an npm package
      return !dep.includes('://') && !dep.includes('\\') && !dep.includes('/');
    });
    
    if (npmDependencies.length === 0) {
      return {
        success: true,
        installed,
        failed,
        warnings: ['No npm dependencies to install']
      };
    }
    
    // Process each dependency
    for (const dependency of npmDependencies) {
      try {
        // Queue the installation
        const dependencyInfo = await this.queueInstallation(dependency, request.taskId, request.force);
        installed.push(dependencyInfo);
      } catch (error) {
        console.error(`[NpmDependencyInstaller] Failed to install ${dependency}:`, error);
        failed.push({
          dependency,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const success = failed.length === 0;
    
    return {
      success,
      installed,
      failed,
      warnings
    };
  }
  
  /**
   * Check if a dependency is installed
   */
  async checkDependency(dependency: string, taskId: string): Promise<DependencyInfo> {
    try {
      // Parse the dependency string
      const { name, version } = this.parseDependencyString(dependency);
      
      // Get the package directory
      const packageDir = this.getPackageDir(name, taskId);
      
      // Check if the package.json exists
      const packageJsonPath = path.join(packageDir, 'package.json');
      
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        const installedVersion = packageJson.version;
        
        // Check if the installed version satisfies the requested version
        const compatible = version ? semver.satisfies(installedVersion, version) : true;
        
        return {
          name,
          version: version || '*',
          installed: true,
          path: packageDir,
          size: await this.getDirectorySize(packageDir),
          lastChecked: new Date()
        };
      } catch (error) {
        // Package.json doesn't exist or can't be read
        return {
          name,
          version: version || '*',
          installed: false,
          lastChecked: new Date()
        };
      }
    } catch (error) {
      console.error(`[NpmDependencyInstaller] Failed to check dependency ${dependency}:`, error);
      throw new TaskError(
        ErrorCode.DEPENDENCY_NOT_FOUND,
        `Failed to check dependency ${dependency}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Clean up dependencies for a task
   */
  async cleanupTaskDependencies(taskId: string): Promise<void> {
    try {
      const taskDir = path.join(this.baseDir, 'packages', taskId);
      await fs.rm(taskDir, { recursive: true, force: true });
      console.log(`[NpmDependencyInstaller] Cleaned up dependencies for task: ${taskId}`);
    } catch (error) {
      console.error(`[NpmDependencyInstaller] Failed to clean up dependencies for task ${taskId}:`, error);
      // Don't throw an error here, just log it
    }
  }
  
  /**
   * Clean up all dependencies
   */
  async cleanupAllDependencies(): Promise<void> {
    try {
      // Only remove the packages directory, keep the cache
      const packagesDir = path.join(this.baseDir, 'packages');
      await fs.rm(packagesDir, { recursive: true, force: true });
      await fs.mkdir(packagesDir, { recursive: true });
      console.log('[NpmDependencyInstaller] Cleaned up all dependencies');
    } catch (error) {
      console.error('[NpmDependencyInstaller] Failed to clean up all dependencies:', error);
      throw new TaskError(
        ErrorCode.FILE_SYSTEM_ERROR,
        `Failed to clean up all dependencies: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Get the base directory for dependencies
   */
  getBaseDir(): string {
    return this.baseDir;
  }
  
  /**
   * Queue a dependency installation
   */
  private async queueInstallation(
    dependency: string, 
    taskId: string, 
    force: boolean = false
  ): Promise<DependencyInfo> {
    return new Promise((resolve, reject) => {
      // Add to the queue
      this.installQueue.push(async () => {
        try {
          const result = await this.installDependency(dependency, taskId, force);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeInstallations--;
          this.processQueue();
        }
      });
      
      // Process the queue
      this.processQueue();
    });
  }
  
  /**
   * Process the installation queue
   */
  private processQueue(): void {
    // Process as many items as we can
    while (this.activeInstallations < this.maxConcurrentInstalls && this.installQueue.length > 0) {
      const nextInstall = this.installQueue.shift();
      if (nextInstall) {
        this.activeInstallations++;
        nextInstall().catch(error => {
          console.error('[NpmDependencyInstaller] Queue processing error:', error);
        });
      }
    }
  }
  
  /**
   * Install a dependency
   */
  private async installDependency(
    dependency: string, 
    taskId: string, 
    force: boolean = false
  ): Promise<DependencyInfo> {
    // Parse the dependency string
    const { name, version } = this.parseDependencyString(dependency);
    
    // Check if already installed
    if (!force) {
      const status = await this.checkDependency(dependency, taskId);
      if (status.installed) {
        console.log(`[NpmDependencyInstaller] Dependency ${name} already installed for task ${taskId}`);
        return status;
      }
    }
    
    // Get the package directory
    const packageDir = this.getPackageDir(name, taskId);
    
    // Create the package directory
    await fs.mkdir(packageDir, { recursive: true });
    
    // Create a temporary package.json
    const packageJson = {
      name: `task-${taskId}-${name.replace(/[@/]/g, '-')}`,
      version: '1.0.0',
      private: true,
      dependencies: {
        [name]: version || 'latest'
      }
    };
    
    const packageJsonPath = path.join(packageDir, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    
    // Install the dependency
    console.log(`[NpmDependencyInstaller] Installing ${name}${version ? `@${version}` : ''} for task ${taskId}`);
    
    try {
      // Build the npm install command
      let npmCommand = 'npm install';
      
      // Add cache option if using global cache
      if (this.useGlobalCache) {
        npmCommand += ` --cache=${path.join(this.baseDir, 'cache')}`;
      }
      
      // Add offline mode if network access is not allowed
      if (!this.allowNetwork) {
        npmCommand += ' --offline';
      }
      
      // Add production flag to avoid dev dependencies
      npmCommand += ' --production';
      
      // Add no-fund flag to avoid funding messages
      npmCommand += ' --no-fund';
      
      // Add no-audit flag to avoid audit messages
      npmCommand += ' --no-audit';
      
      // Execute the command
      await this.executeCommand(npmCommand, packageDir, this.installTimeout);
      
      // Verify the installation
      const status = await this.checkDependency(dependency, taskId);
      if (!status.installed) {
        throw new Error('Package installation verification failed');
      }
      
      console.log(`[NpmDependencyInstaller] Successfully installed ${name} for task ${taskId}`);
      return status;
    } catch (error) {
      console.error(`[NpmDependencyInstaller] Failed to install ${name}:`, error);
      throw new TaskError(
        ErrorCode.DEPENDENCY_INSTALL_FAILED,
        `Failed to install dependency ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Parse a dependency string into name and version
   */
  private parseDependencyString(dependency: string): { name: string; version?: string } {
    // Handle scoped packages
    if (dependency.startsWith('@')) {
      const scopedMatch = dependency.match(/^(@[^@/]+\/[^@/]+)(?:@(.+))?$/);
      if (scopedMatch) {
        return {
          name: scopedMatch[1],
          version: scopedMatch[2]
        };
      }
    }
    
    // Handle regular packages
    const match = dependency.match(/^([^@/]+)(?:@(.+))?$/);
    if (match) {
      return {
        name: match[1],
        version: match[2]
      };
    }
    
    // If no match, just return the dependency as the name
    return {
      name: dependency
    };
  }
  
  /**
   * Get the package directory for a dependency
   */
  private getPackageDir(packageName: string, taskId: string): string {
    // Sanitize the package name for use in a directory name
    const sanitizedName = packageName.replace(/[@/]/g, '-');
    return path.join(this.baseDir, 'packages', taskId, sanitizedName);
  }
  
  /**
   * Execute a command
   */
  private async executeCommand(
    command: string, 
    cwd: string, 
    timeout: number = 60000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      
      console.log(`[NpmDependencyInstaller] Executing command: ${command} in ${cwd}`);
      
      const child = spawn(cmd, args, { 
        shell: true, 
        cwd,
        env: {
          ...process.env,
          // Add any environment variables needed for npm
          NPM_CONFIG_LOGLEVEL: 'error'
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[npm] ${output.trim()}`);
      });
      
      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[npm] ${output.trim()}`);
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
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);
      
      // Clear timeout when process exits
      child.on('exit', () => {
        clearTimeout(timeoutId);
      });
    });
  }
  
  /**
   * Get the size of a directory in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      const sizes = await Promise.all(files.map(async (file) => {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          return await this.getDirectorySize(filePath);
        }
        
        if (file.isFile()) {
          const stats = await fs.stat(filePath);
          return stats.size;
        }
        
        return 0;
      }));
      
      return sizes.reduce((acc, size) => acc + size, 0);
    } catch (error) {
      console.error(`[NpmDependencyInstaller] Failed to get directory size for ${dirPath}:`, error);
      return 0;
    }
  }
}

/**
 * Create a new NPM Dependency Installer
 */
export function createNpmDependencyInstaller(
  options: NpmDependencyInstallerOptions = {}
): NpmDependencyInstaller {
  return new NpmDependencyInstaller(options);
}