/**
 * Dependency Status Checker
 * 
 * This service provides functionality for checking the status of dependencies,
 * including availability, version compatibility, and health checks.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as semver from 'semver';
import { NpmDependencyInstaller } from './npm-dependency-installer';
import { DependencyCacheManager } from './dependency-cache-manager';
import {
  DependencyInfo,
  SingleDependencyStatus,
  DependencyHealthCheck,
  TaskError,
  ErrorCode
} from '../../shared/types';

/**
 * Dependency status checker options
 */
export interface DependencyStatusCheckerOptions {
  /**
   * Whether to check for updates automatically
   */
  checkForUpdates?: boolean;
  
  /**
   * Whether to verify package integrity
   */
  verifyIntegrity?: boolean;
  
  /**
   * Whether to check for security vulnerabilities
   */
  checkSecurity?: boolean;
  
  /**
   * Update check interval in milliseconds
   */
  updateCheckInterval?: number;
}

/**
 * Dependency Status Checker - Service for checking dependency status
 */
export class DependencyStatusChecker {
  private installer: NpmDependencyInstaller;
  private cacheManager: DependencyCacheManager;
  private options: DependencyStatusCheckerOptions;
  private lastUpdateCheck: Map<string, Date> = new Map();
  
  /**
   * Create a new Dependency Status Checker
   */
  constructor(
    installer: NpmDependencyInstaller,
    cacheManager: DependencyCacheManager,
    options: DependencyStatusCheckerOptions = {}
  ) {
    this.installer = installer;
    this.cacheManager = cacheManager;
    this.options = {
      checkForUpdates: true,
      verifyIntegrity: true,
      checkSecurity: true,
      updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };
  }
  
  /**
   * Check the status of a dependency
   */
  async checkDependencyStatus(dependency: string, taskId: string): Promise<SingleDependencyStatus> {
    try {
      // First check if the dependency is installed
      const status = await this.installer.checkDependency(dependency, taskId);
      
      // If not installed, return the status
      if (!status.installed) {
        // Ensure lastChecked is not undefined
        return {
          ...status,
          lastChecked: status.lastChecked || new Date()
        };
      }
      
      // Parse the dependency string
      const { name, version } = this.parseDependencyString(dependency);
      
      // Check if the dependency is in the cache
      const cachedDependency = await this.cacheManager.getCachedDependency(name, version || '*');
      
      // Merge the status with cache information
      const mergedStatus: SingleDependencyStatus = {
        ...status,
        cached: !!cachedDependency,
        cachedPath: cachedDependency?.path,
        lastChecked: new Date()
      };
      
      // Check for updates if enabled
      if (this.options.checkForUpdates) {
        const shouldCheckForUpdates = this.shouldCheckForUpdates(name);
        if (shouldCheckForUpdates) {
          const updateInfo = await this.checkForUpdates(name, version || status.version);
          mergedStatus.updateAvailable = updateInfo.updateAvailable;
          mergedStatus.latestVersion = updateInfo.latestVersion;
          this.lastUpdateCheck.set(name, new Date());
        }
      }
      
      // Verify package integrity if enabled
      if (this.options.verifyIntegrity && status.path) {
        const integrityResult = await this.verifyPackageIntegrity(status.path);
        mergedStatus.integrityVerified = integrityResult.verified;
        if (!integrityResult.verified) {
          mergedStatus.integrityIssues = integrityResult.issues;
        }
      }
      
      // Check for security vulnerabilities if enabled
      if (this.options.checkSecurity) {
        const securityResult = await this.checkSecurityVulnerabilities(name, version || status.version);
        mergedStatus.securityChecked = true;
        mergedStatus.vulnerabilities = securityResult.vulnerabilities;
      }
      
      return mergedStatus;
    } catch (error) {
      console.error(`[DependencyStatusChecker] Failed to check dependency status for ${dependency}:`, error);
      throw new TaskError(
        ErrorCode.DEPENDENCY_NOT_FOUND,
        `Failed to check dependency status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Check the health of a dependency
   */
  async checkDependencyHealth(dependency: string, taskId: string): Promise<DependencyHealthCheck> {
    try {
      // Get the dependency status
      const status = await this.checkDependencyStatus(dependency, taskId);
      
      // Parse the dependency string
      const { name, version } = this.parseDependencyString(dependency);
      
      // Initialize health check result
      const healthCheck: DependencyHealthCheck = {
        name,
        version: version || status.version,
        installed: status.installed,
        healthy: true,
        issues: [],
        recommendations: [],
        lastChecked: new Date()
      };
      
      // Check if the dependency is installed
      if (!status.installed) {
        healthCheck.healthy = false;
        healthCheck.issues.push('Dependency is not installed');
        healthCheck.recommendations.push('Install the dependency using npm install');
        return healthCheck;
      }
      
      // Check for updates
      if (status.updateAvailable) {
        healthCheck.issues.push(`Update available: ${status.version} → ${status.latestVersion}`);
        healthCheck.recommendations.push(`Update to the latest version: npm install ${name}@${status.latestVersion}`);
      }
      
      // Check integrity
      if (status.integrityVerified === false) {
        healthCheck.healthy = false;
        healthCheck.issues.push('Package integrity verification failed');
        healthCheck.issues.push(...(status.integrityIssues || []));
        healthCheck.recommendations.push('Reinstall the package to fix integrity issues');
      }
      
      // Check security vulnerabilities
      if (status.vulnerabilities && status.vulnerabilities.length > 0) {
        healthCheck.healthy = false;
        
        // Group vulnerabilities by severity
        const criticalCount = status.vulnerabilities.filter(v => v.severity === 'critical').length;
        const highCount = status.vulnerabilities.filter(v => v.severity === 'high').length;
        const mediumCount = status.vulnerabilities.filter(v => v.severity === 'medium').length;
        const lowCount = status.vulnerabilities.filter(v => v.severity === 'low').length;
        
        if (criticalCount > 0) {
          healthCheck.issues.push(`${criticalCount} critical security vulnerabilities found`);
        }
        if (highCount > 0) {
          healthCheck.issues.push(`${highCount} high security vulnerabilities found`);
        }
        if (mediumCount > 0) {
          healthCheck.issues.push(`${mediumCount} medium security vulnerabilities found`);
        }
        if (lowCount > 0) {
          healthCheck.issues.push(`${lowCount} low security vulnerabilities found`);
        }
        
        // Add recommendations
        if (criticalCount > 0 || highCount > 0) {
          healthCheck.recommendations.push('Update to a patched version immediately');
        } else {
          healthCheck.recommendations.push('Consider updating to a patched version');
        }
      }
      
      // Check if the package is deprecated
      if (status.deprecated) {
        healthCheck.issues.push(`Package is deprecated: ${status.deprecated}`);
        healthCheck.recommendations.push('Consider finding an alternative package');
      }
      
      // Set overall health status
      healthCheck.healthy = healthCheck.issues.length === 0;
      
      return healthCheck;
    } catch (error) {
      console.error(`[DependencyStatusChecker] Failed to check dependency health for ${dependency}:`, error);
      return {
        name: dependency,
        version: 'unknown',
        installed: false,
        healthy: false,
        issues: [`Failed to check health: ${error instanceof Error ? error.message : String(error)}`],
        recommendations: ['Try reinstalling the dependency'],
        lastChecked: new Date()
      };
    }
  }
  
  /**
   * Check the status of all dependencies for a task
   */
  async checkTaskDependencies(taskId: string, dependencies: string[]): Promise<SingleDependencyStatus[]> {
    const results: SingleDependencyStatus[] = [];
    
    for (const dependency of dependencies) {
      try {
        const status = await this.checkDependencyStatus(dependency, taskId);
        results.push(status);
      } catch (error) {
        console.error(`[DependencyStatusChecker] Failed to check dependency ${dependency}:`, error);
        // Add a failed status
        const { name, version } = this.parseDependencyString(dependency);
        results.push({
          name,
          version: version || '*',
          installed: false,
          error: error instanceof Error ? error.message : String(error),
          lastChecked: new Date()
        });
      }
    }
    
    return results;
  }
  
  /**
   * Check for dependency conflicts in a task
   */
  async checkDependencyConflicts(taskId: string, dependencies: string[]): Promise<Array<{
    name: string;
    versions: string[];
    conflicting: boolean;
  }>> {
    // Group dependencies by name
    const dependencyGroups = new Map<string, string[]>();
    
    for (const dependency of dependencies) {
      const { name, version } = this.parseDependencyString(dependency);
      
      if (!dependencyGroups.has(name)) {
        dependencyGroups.set(name, []);
      }
      
      if (version) {
        dependencyGroups.get(name)!.push(version);
      }
    }
    
    // Check for conflicts
    const results: Array<{
      name: string;
      versions: string[];
      conflicting: boolean;
    }> = [];
    
    for (const [name, versions] of dependencyGroups.entries()) {
      // If there's only one version or no versions specified, there's no conflict
      if (versions.length <= 1) {
        results.push({
          name,
          versions,
          conflicting: false
        });
        continue;
      }
      
      // Check if versions are compatible
      let conflicting = false;
      
      // Try to find a version that satisfies all requirements
      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];
        
        for (let j = i + 1; j < versions.length; j++) {
          const otherVersion = versions[j];
          
          // Check if the versions are compatible
          if (!semver.satisfies(version, otherVersion) && !semver.satisfies(otherVersion, version)) {
            conflicting = true;
            break;
          }
        }
        
        if (conflicting) {
          break;
        }
      }
      
      results.push({
        name,
        versions,
        conflicting
      });
    }
    
    return results;
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
   * Check if we should check for updates for a dependency
   */
  private shouldCheckForUpdates(packageName: string): boolean {
    const lastCheck = this.lastUpdateCheck.get(packageName);
    
    if (!lastCheck) {
      return true;
    }
    
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - lastCheck.getTime();
    
    return timeSinceLastCheck >= this.options.updateCheckInterval!;
  }
  
  /**
   * Check for updates for a dependency
   */
  private async checkForUpdates(packageName: string, currentVersion: string): Promise<{
    updateAvailable: boolean;
    latestVersion?: string;
  }> {
    try {
      // This is a simplified implementation
      // In a real implementation, you would use npm registry API
      // to check for the latest version
      
      // For now, just return no updates available
      return {
        updateAvailable: false
      };
      
      // Example implementation using npm registry API:
      /*
      const response = await fetch(`https://registry.npmjs.org/${packageName}`);
      const data = await response.json();
      
      if (data['dist-tags'] && data['dist-tags'].latest) {
        const latestVersion = data['dist-tags'].latest;
        const updateAvailable = semver.gt(latestVersion, currentVersion);
        
        return {
          updateAvailable,
          latestVersion
        };
      }
      
      return {
        updateAvailable: false
      };
      */
    } catch (error) {
      console.error(`[DependencyStatusChecker] Failed to check for updates for ${packageName}:`, error);
      return {
        updateAvailable: false
      };
    }
  }
  
  /**
   * Verify package integrity
   */
  private async verifyPackageIntegrity(packagePath: string): Promise<{
    verified: boolean;
    issues?: string[];
  }> {
    try {
      // This is a simplified implementation
      // In a real implementation, you would check package-lock.json
      // and verify file integrity
      
      // Check if package.json exists
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      try {
        await fs.access(packageJsonPath);
      } catch (error) {
        return {
          verified: false,
          issues: ['package.json not found']
        };
      }
      
      // For now, just return verified
      return {
        verified: true
      };
    } catch (error) {
      console.error(`[DependencyStatusChecker] Failed to verify package integrity for ${packagePath}:`, error);
      return {
        verified: false,
        issues: [`Failed to verify integrity: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * Check for security vulnerabilities
   */
  private async checkSecurityVulnerabilities(packageName: string, version: string): Promise<{
    vulnerabilities: Array<{
      id: string;
      title: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      fixedIn?: string;
    }>;
  }> {
    try {
      // This is a simplified implementation
      // In a real implementation, you would use a vulnerability database
      // like npm audit or Snyk
      
      // For now, just return no vulnerabilities
      return {
        vulnerabilities: []
      };
      
      // Example implementation using npm audit:
      /*
      const { execFile } = require('child_process');
      const util = require('util');
      const execFilePromise = util.promisify(execFile);
      
      const { stdout } = await execFilePromise('npm', ['audit', '--json', `${packageName}@${version}`]);
      const auditResult = JSON.parse(stdout);
      
      const vulnerabilities = Object.values(auditResult.advisories).map((advisory: any) => ({
        id: advisory.id,
        title: advisory.title,
        severity: advisory.severity,
        description: advisory.overview,
        fixedIn: advisory.patched_versions
      }));
      
      return {
        vulnerabilities
      };
      */
    } catch (error) {
      console.error(`[DependencyStatusChecker] Failed to check security vulnerabilities for ${packageName}@${version}:`, error);
      return {
        vulnerabilities: []
      };
    }
  }
}

/**
 * Create a new Dependency Status Checker
 */
export function createDependencyStatusChecker(
  installer: NpmDependencyInstaller,
  cacheManager: DependencyCacheManager,
  options: DependencyStatusCheckerOptions = {}
): DependencyStatusChecker {
  return new DependencyStatusChecker(installer, cacheManager, options);
}