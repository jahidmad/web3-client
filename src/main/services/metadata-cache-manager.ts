/**
 * Metadata Cache Manager
 * 
 * This service manages the caching of task metadata to improve performance
 * when listing and filtering tasks.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger';
import { LocalTask } from '../types/task';

/**
 * Metadata cache statistics
 */
export interface MetadataCacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageAccessCount: number;
}

/**
 * Metadata Cache Manager - Service for caching task metadata
 */
export class MetadataCacheManager {
  private logger: Logger;
  private cacheDir: string;
  private cache: Map<string, any> = new Map();
  
  /**
   * Create a new Metadata Cache Manager
   */
  constructor() {
    this.logger = new Logger('MetadataCacheManager');
    this.cacheDir = path.join(process.cwd(), 'data', 'metadata-cache');
  }
  
  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    try {
      // Create the cache directory if it doesn't exist
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.logger.info('Metadata cache manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize metadata cache manager:', error);
    }
  }
  
  /**
   * Get cached task metadata
   */
  getCachedMetadata(taskId: string): any | null {
    return this.cache.get(taskId) || null;
  }
  
  /**
   * Cache task metadata
   */
  cacheTaskMetadata(task: LocalTask): void {
    try {
      if (!task || !task.id) return;
      
      // Create a simplified metadata object
      const metadata = {
        id: task.id,
        name: task.metadata.name,
        description: task.metadata.description,
        category: task.metadata.category,
        tags: task.metadata.tags,
        cachedAt: new Date()
      };
      
      this.cache.set(task.id, metadata);
      this.logger.info(`Cached metadata for task ${task.id}`);
    } catch (error) {
      this.logger.error(`Failed to cache task metadata:`, error);
    }
  }
  
  /**
   * Remove cached metadata
   */
  removeCachedMetadata(taskId: string): void {
    this.cache.delete(taskId);
  }
  
  /**
   * Clean up the cache
   */
  async cleanupCache(): Promise<void> {
    this.cache.clear();
    this.logger.info('Metadata cache cleaned up');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): MetadataCacheStats {
    return {
      totalEntries: this.cache.size,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      averageAccessCount: 0
    };
  }
}