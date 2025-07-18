/**
 * Cleanup Helper
 * 
 * This module provides utilities for cleaning up resources and recovering from errors.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './logger';

/**
 * 清理助手类
 */
export class CleanupHelper {
  private logger: Logger;
  private tempFiles: string[] = [];
  private tempDirs: string[] = [];
  
  constructor() {
    this.logger = new Logger('CleanupHelper');
  }
  
  /**
   * 注册临时文件
   */
  registerTempFile(filePath: string): void {
    this.tempFiles.push(filePath);
    this.logger.debug(`Registered temp file: ${filePath}`);
  }
  
  /**
   * 注册临时目录
   */
  registerTempDir(dirPath: string): void {
    this.tempDirs.push(dirPath);
    this.logger.debug(`Registered temp directory: ${dirPath}`);
  }
  
  /**
   * 清理所有临时资源
   */
  async cleanup(): Promise<void> {
    this.logger.info('Starting cleanup of temporary resources');
    
    // 清理临时文件
    for (const filePath of this.tempFiles) {
      try {
        await fs.unlink(filePath);
        this.logger.debug(`Removed temp file: ${filePath}`);
      } catch (error) {
        this.logger.warn(`Failed to remove temp file ${filePath}:`, error);
      }
    }
    
    // 清理临时目录
    for (const dirPath of this.tempDirs) {
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        this.logger.debug(`Removed temp directory: ${dirPath}`);
      } catch (error) {
        this.logger.warn(`Failed to remove temp directory ${dirPath}:`, error);
      }
    }
    
    // 重置列表
    this.tempFiles = [];
    this.tempDirs = [];
    
    this.logger.info('Cleanup completed');
  }
  
  /**
   * 创建临时文件
   */
  async createTempFile(content: string | Buffer, extension: string = '.tmp'): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // 确保临时目录存在
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create temp directory:', error);
    }
    
    // 创建临时文件
    const tempFilePath = path.join(tempDir, `temp_${Date.now()}${extension}`);
    await fs.writeFile(tempFilePath, content);
    
    // 注册临时文件
    this.registerTempFile(tempFilePath);
    
    this.logger.debug(`Created temp file: ${tempFilePath}`);
    return tempFilePath;
  }
  
  /**
   * 创建临时目录
   */
  async createTempDir(prefix: string = 'temp_'): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    
    // 确保临时目录存在
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create temp directory:', error);
    }
    
    // 创建临时子目录
    const tempSubDir = path.join(tempDir, `${prefix}${Date.now()}`);
    await fs.mkdir(tempSubDir, { recursive: true });
    
    // 注册临时目录
    this.registerTempDir(tempSubDir);
    
    this.logger.debug(`Created temp directory: ${tempSubDir}`);
    return tempSubDir;
  }
}