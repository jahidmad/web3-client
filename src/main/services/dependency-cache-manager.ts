/**
 * Dependency Cache Manager
 * 
 * This service manages the caching of npm dependencies for plugin tasks.
 * It provides functionality for storing, retrieving, and sharing dependencies
 * across multiple tasks to improve installation speed and reduce disk usage.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import * as semver from 'semver';
import { v4 as uuidv4 } from 'uuid';
import { 
  DependencyInfo, 
  TaskError,
  ErrorCode
} from '../../shared/types';

/**
 * Cache entry for a dependency
 */
export interface CacheEntry {
  /**
   * Package name
   */
  name: string;
  
  /**
   * Package version
   */
  version: string;
  
  /**
   * Path to the cached package
   */
  path: string;
  
  /**
   * Size of the cached package in bytes
   */
  size: number;
  
  /**
   * When the package was cached
   */
  cachedAt: Date;
  
  /**
   * When the package was last used
   */
  lastUsedAt: Date;
  
  /**
   * Number of times the package has been used
   */
  usageCount: number;
  
  /**
   * Tasks that use this package
   */
  usedByTasks: string[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total number of cached packages
   */
  totalPackages: number;
  
  /**
   * Total size of all cached packages in bytes
   */
  totalSize: number;
  
  /**
   * Number of shared packages (used by multiple tasks)
   */
  sharedPackages: number;
  
  /**
   * Space saved by sharing packages in bytes
   */
  spaceSaved: number;
  
  /**
   * Cache hit rate (0-1)
   */
  hitRate: number;
  
  /**
   * Cache miss rate (0-1)
   */
  missRate: number;
}

/**
 * Dependency cache manager options
 */
export interface DependencyCacheManagerOptions {
  /**
   * Base directory for the cache
   */
  cacheDir?: string;
  
  /**
   * Maximum cache size in bytes
   */
  maxCacheSize?: number;
  
  /**
   * Maximum number of cached packages
   */
  maxPackages?: number;
  
  /**
   * Cache cleanup interval in milliseconds
   */
  cleanupInterval?: number;
  
  /**
   * Whether to enable cache sharing between tasks
   */
  enableSharing?: boolean;
}

/**
 * Dependency Cache Manager - Service for caching and sharing npm dependencies
 */
export class DependencyCacheManager {
  private cacheDir: string;
  private maxCacheSize: number;
  private maxPackages: number;
  private cleanupInterval: number;
  private enableSharing: boolean;
  private cache: Map<string, CacheEntry> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private cleanupTimer?: NodeJS.Timeout;
  
  /**
   * Create a new Dependency Cache Manager
   */
  constructor(options: DependencyCacheManagerOptions = {}) {
    this.cacheDir = options.cacheDir || path.join(app.getPath('userData'), 'plugin-task-dependencies', 'cache');
    this.maxCacheSize = options.maxCacheSize || 1024 * 1024 * 1024; // 1GB
    this.maxPackages = options.maxPackages || 1000;
    this.cleanupInterval = options.cleanupInterval || 24 * 60 * 60 * 1000; // 24 hours
    this.enableSharing = options.enableSharing !== false;
  }
  
  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    try {
      // Create the cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // Load the cache index
      await this.loadCacheIndex();
      
      // Start the cleanup timer
      this.startCleanupTimer();
      
      console.log(`[DependencyCacheManager] Initialized at ${this.cacheDir}`);
    } catch (error) {
      console.error('[DependencyCacheManager] Failed to initialize:', error);
      throw new TaskError(
        ErrorCode.FILE_SYSTEM_ERROR,
        `Failed to initialize dependency cache manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Get a cached dependency
   */
  async getCachedDependency(name: string, version: string): Promise<DependencyInfo | null> {
    const cacheKey = this.getCacheKey(name, version);
    const cacheEntry = this.cache.get(cacheKey);
    
    if (cacheEntry) {
      // Update usage statistics
      cacheEntry.lastUsedAt = new Date();
      cacheEntry.usageCount++;
      
      // Save the updated cache index
      await this.saveCacheIndex();
      
      this.hits++;
      
      return {
        name: cacheEntry.name,
        version: cacheEntry.version,
        installed: true,
        path: cacheEntry.path,
        size: cacheEntry.size,
        lastChecked: cacheEntry.lastUsedAt
      };
    }
    
    this.misses++;
    return null;
  }
  
  /**
   * Add a dependency to the cache
   */
  async addToCache(dependency: DependencyInfo, taskId: string): Promise<void> {
    if (!dependency.name || !dependency.version || !dependency.path) {
      throw new TaskError(
        ErrorCode.INVALID_PARAMETERS,
        'Invalid dependency info'
      );
    }
    
    const cacheKey = this.getCacheKey(dependency.name, dependency.version);
    
    // Check if already in cache
    const existingEntry = this.cache.get(cacheKey);
    if (existingEntry) {
      // Update existing entry
      if (!existingEntry.usedByTasks.includes(taskId)) {
        existingEntry.usedByTasks.push(taskId);
      }
      existingEntry.lastUsedAt = new Date();
      existingEntry.usageCount++;
      
      // Save the updated cache index
      await this.saveCacheIndex();
      return;
    }
    
    // Check if we need to clean up the cache
    await this.ensureCacheSpace();
    
    // Copy the dependency to the cache
    const cachePath = path.join(this.cacheDir, cacheKey);
    await this.copyDependencyToCache(dependency.path, cachePath);
    
    // Get the size of the cached dependency
    const size = await this.getDirectorySize(cachePath);
    
    // Add to cache
    const cacheEntry: CacheEntry = {
      name: dependency.name,
      version: dependency.version,
      path: cachePath,
      size,
      cachedAt: new Date(),
      lastUsedAt: new Date(),
      usageCount: 1,
      usedByTasks: [taskId]
    };
    
    this.cache.set(cacheKey, cacheEntry);
    
    // Save the updated cache index
    await this.saveCacheIndex();
    
    console.log(`[DependencyCacheManager] Added ${dependency.name}@${dependency.version} to cache`);
  }
  
  /**
   * Remove a dependency from the cache
   */
  async removeFromCache(name: string, version: string): Promise<void> {
    const cacheKey = this.getCacheKey(name, version);
    const cacheEntry = this.cache.get(cacheKey);
    
    if (!cacheEntry) {
      return;
    }
    
    // Remove from cache
    this.cache.delete(cacheKey);
    
    // Remove from disk
    try {
      await fs.rm(cacheEntry.path, { recursive: true, force: true });
    } catch (error) {
      console.error(`[DependencyCacheManager] Failed to remove ${name}@${version} from cache:`, error);
    }
    
    // Save the updated cache index
    await this.saveCacheIndex();
    
    console.log(`[DependencyCacheManager] Removed ${name}@${version} from cache`);
  }
  
  /**
   * Remove task dependencies from the cache
   */
  async removeTaskDependencies(taskId: string): Promise<void> {
    // Find all dependencies used by this task
    for (const [cacheKey, cacheEntry] of this.cache.entries()) {
      const index = cacheEntry.usedByTasks.indexOf(taskId);
      if (index !== -1) {
        // Remove task from the list
        cacheEntry.usedByTasks.splice(index, 1);
        
        // If no more tasks use this dependency and it's not shared, remove it
        if (cacheEntry.usedByTasks.length === 0 && !this.enableSharing) {
          await this.removeFromCache(cacheEntry.name, cacheEntry.version);
        }
      }
    }
    
    // Save the updated cache index
    await this.saveCacheIndex();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let totalSize = 0;
    let sharedPackages = 0;
    let spaceSaved = 0;
    
    for (const cacheEntry of this.cache.values()) {
      totalSize += cacheEntry.size;
      
      if (cacheEntry.usedByTasks.length > 1) {
        sharedPackages++;
        spaceSaved += cacheEntry.size * (cacheEntry.usedByTasks.length - 1);
      }
    }
    
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0;
    
    return {
      totalPackages: this.cache.size,
      totalSize,
      sharedPackages,
      spaceSaved,
      hitRate,
      missRate
    };
  }
  
  /**
   * Clean up the cache
   */
  async cleanupCache(): Promise<void> {
    console.log('[DependencyCacheManager] Starting cache cleanup');
    
    // Check if we need to clean up
    const stats = this.getCacheStats();
    if (stats.totalPackages <= this.maxPackages && stats.totalSize <= this.maxCacheSize) {
      console.log('[DependencyCacheManager] Cache is within limits, no cleanup needed');
      return;
    }
    
    // Sort cache entries by last used date (oldest first)
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastUsedAt.getTime() - b.entry.lastUsedAt.getTime());
    
    // Remove entries until we're under the limits
    let removedCount = 0;
    let removedSize = 0;
    
    for (const { key, entry } of entries) {
      // Skip entries that are still in use
      if (entry.usedByTasks.length > 0) {
        continue;
      }
      
      // Remove from cache
      this.cache.delete(key);
      removedSize += entry.size;
      removedCount++;
      
      // Remove from disk
      try {
        await fs.rm(entry.path, { recursive: true, force: true });
      } catch (error) {
        console.error(`[DependencyCacheManager] Failed to remove ${entry.name}@${entry.version} from cache:`, error);
      }
      
      // Check if we're under the limits
      if (
        this.cache.size <= this.maxPackages &&
        stats.totalSize - removedSize <= this.maxCacheSize
      ) {
        break;
      }
    }
    
    // Save the updated cache index
    await this.saveCacheIndex();
    
    console.log(`[DependencyCacheManager] Cleaned up ${removedCount} packages (${this.formatSize(removedSize)})`);
  }
  
  /**
   * Get the cache directory
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
  
  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupCache().catch(error => {
        console.error('[DependencyCacheManager] Cleanup error:', error);
      });
    }, this.cleanupInterval);
  }
  
  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
  
  /**
   * Load the cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    const indexPath = path.join(this.cacheDir, 'cache-index.json');
    
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(indexData);
      
      // Clear the current cache
      this.cache.clear();
      
      // Load cache entries
      for (const entry of index.entries) {
        // Convert date strings to Date objects
        entry.cachedAt = new Date(entry.cachedAt);
        entry.lastUsedAt = new Date(entry.lastUsedAt);
        
        this.cache.set(this.getCacheKey(entry.name, entry.version), entry);
      }
      
      // Load statistics
      this.hits = index.hits || 0;
      this.misses = index.misses || 0;
      
      console.log(`[DependencyCacheManager] Loaded ${this.cache.size} cache entries`);
    } catch (error) {
      // If the file doesn't exist, that's fine
      if ((error as any).code !== 'ENOENT') {
        console.error('[DependencyCacheManager] Failed to load cache index:', error);
      }
    }
  }
  
  /**
   * Save the cache index to disk
   */
  private async saveCacheIndex(): Promise<void> {
    const indexPath = path.join(this.cacheDir, 'cache-index.json');
    
    try {
      const index = {
        entries: Array.from(this.cache.values()),
        hits: this.hits,
        misses: this.misses,
        updatedAt: new Date()
      };
      
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('[DependencyCacheManager] Failed to save cache index:', error);
    }
  }
  
  /**
   * Ensure there's enough space in the cache
   */
  private async ensureCacheSpace(): Promise<void> {
    const stats = this.getCacheStats();
    
    // Check if we need to clean up
    if (stats.totalPackages >= this.maxPackages || stats.totalSize >= this.maxCacheSize) {
      await this.cleanupCache();
    }
  }
  
  /**
   * Copy a dependency to the cache
   */
  private async copyDependencyToCache(sourcePath: string, destPath: string): Promise<void> {
    try {
      // Create the destination directory
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy the directory recursively
      await this.copyDirectory(sourcePath, destPath);
    } catch (error) {
      throw new TaskError(
        ErrorCode.FILE_SYSTEM_ERROR,
        `Failed to copy dependency to cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Copy a directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    // Create the destination directory
    await fs.mkdir(destination, { recursive: true });
    
    // Get all files in the source directory
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    // Copy each file/directory
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively copy directory
        await this.copyDirectory(sourcePath, destPath);
      } else {
        // Copy file
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }
  
  /**
   * Get the size of a directory in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      const sizes = await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          return await this.getDirectorySize(fullPath);
        }
        
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          return stats.size;
        }
        
        return 0;
      }));
      
      return sizes.reduce((total, size) => total + size, 0);
    } catch (error) {
      console.error(`[DependencyCacheManager] Failed to get directory size for ${dirPath}:`, error);
      return 0;
    }
  }
  
  /**
   * Get the cache key for a dependency
   */
  private getCacheKey(name: string, version: string): string {
    return `${name}@${version}`;
  }
  
  /**
   * Format a size in bytes to a human-readable string
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * Create a new Dependency Cache Manager
 */
export function createDependencyCacheManager(
  options: DependencyCacheManagerOptions = {}
): DependencyCacheManager {
  return new DependencyCacheManager(options);
}