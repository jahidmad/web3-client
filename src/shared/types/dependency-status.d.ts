/**
 * Dependency Status Types
 *
 * This file defines the types for dependency status checking and health monitoring.
 */
/**
 * Dependency status information
 */
export interface DependencyStatus {
    /**
     * Package name
     */
    name: string;
    /**
     * Package version
     */
    version: string;
    /**
     * Whether the dependency is installed
     */
    installed: boolean;
    /**
     * Path to the installed package
     */
    path?: string;
    /**
     * Size of the installed package in bytes
     */
    size?: number;
    /**
     * When the dependency was last checked
     */
    lastChecked: Date;
    /**
     * Whether the dependency is cached
     */
    cached?: boolean;
    /**
     * Path to the cached package
     */
    cachedPath?: string;
    /**
     * Whether an update is available
     */
    updateAvailable?: boolean;
    /**
     * Latest available version
     */
    latestVersion?: string;
    /**
     * Whether the package integrity was verified
     */
    integrityVerified?: boolean;
    /**
     * Integrity issues if any
     */
    integrityIssues?: string[];
    /**
     * Whether security was checked
     */
    securityChecked?: boolean;
    /**
     * Security vulnerabilities if any
     */
    vulnerabilities?: Array<{
        id: string;
        title: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        description: string;
        fixedIn?: string;
    }>;
    /**
     * Deprecation notice if any
     */
    deprecated?: string;
    /**
     * Error message if any
     */
    error?: string;
}
/**
 * Dependency health check result
 */
export interface DependencyHealthCheck {
    /**
     * Package name
     */
    name: string;
    /**
     * Package version
     */
    version: string;
    /**
     * Whether the dependency is installed
     */
    installed: boolean;
    /**
     * Whether the dependency is healthy
     */
    healthy: boolean;
    /**
     * Health issues if any
     */
    issues: string[];
    /**
     * Recommendations to fix issues
     */
    recommendations: string[];
    /**
     * When the health check was performed
     */
    lastChecked: Date;
}
/**
 * Dependency install request
 */
export interface DependencyInstallRequest {
    /**
     * Task ID
     */
    taskId: string;
    /**
     * Dependencies to install
     */
    dependencies: string[];
    /**
     * Whether to force reinstallation
     */
    force?: boolean;
    /**
     * Whether to allow network access
     */
    allowNetwork?: boolean;
}
/**
 * Dependency install result
 */
export interface DependencyInstallResult {
    /**
     * Whether the installation was successful
     */
    success: boolean;
    /**
     * Installed dependencies
     */
    installed: DependencyInfo[];
    /**
     * Failed dependencies
     */
    failed: Array<{
        dependency: string;
        error: string;
    }>;
    /**
     * Warnings if any
     */
    warnings: string[];
}
/**
 * Dependency information
 */
export interface DependencyInfo {
    /**
     * Package name
     */
    name: string;
    /**
     * Package version
     */
    version: string;
    /**
     * Whether the dependency is installed
     */
    installed: boolean;
    /**
     * Path to the installed package
     */
    path?: string;
    /**
     * Size of the installed package in bytes
     */
    size?: number;
    /**
     * When the dependency was last checked
     */
    lastChecked: Date;
}
//# sourceMappingURL=dependency-status.d.ts.map