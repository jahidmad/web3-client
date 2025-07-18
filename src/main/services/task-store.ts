import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface TaskStoreItem {
  id: string;
  taskId: string;
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  version: string;
  repository?: string;
  homepage?: string;
  keywords: string[];
  categories: string[];
  license?: string;
  downloadCount: number;
  rating?: number;
  reviewCount: number;
  publishedAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  isVerified: boolean;
  isInstalled: boolean;
}

export interface TaskStoreSearchRequest {
  query?: string;
  category?: string;
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TaskInstallRequest {
  taskId: string;
  version?: string;
}

export interface TaskStoreStats {
  totalTasks: number;
  totalDownloads: number;
  categories: Array<{ name: string; count: number }>;
  publishers: Array<{ name: string; count: number }>;
}

/**
 * 任务商店服务 - 类似VSCode插件市场
 */
export class TaskStoreService extends EventEmitter {
  private logger: Logger;
  private databaseService: DatabaseService;
  private storeApiUrl: string;
  private cacheDirectory: string;

  constructor(databaseService: DatabaseService, storeApiUrl?: string) {
    super();
    this.logger = new Logger('TaskStoreService');
    this.databaseService = databaseService;
    this.storeApiUrl = storeApiUrl || 'https://api.web3-automation.com'; // 假设的API地址
    this.cacheDirectory = path.join(process.cwd(), 'data', 'store-cache');
    this.initializeCacheDirectory();
  }

  private async initializeCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create cache directory:', error);
    }
  }

  /**
   * 搜索任务商店
   */
  async searchTasks(request: TaskStoreSearchRequest): Promise<{
    tasks: TaskStoreItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = request.page || 1;
      const limit = request.limit || 20;
      const offset = (page - 1) * limit;

      // 模拟商店API调用
      const mockTasks = await this.getMockStoreTasks();
      
      // 过滤和搜索
      let filteredTasks = mockTasks;
      
      if (request.query) {
        const query = request.query.toLowerCase();
        filteredTasks = filteredTasks.filter(task =>
          task.name.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query) ||
          task.keywords.some(keyword => keyword.toLowerCase().includes(query))
        );
      }

      if (request.category) {
        filteredTasks = filteredTasks.filter(task =>
          task.categories.includes(request.category!)
        );
      }

      // 排序
      if (request.sortBy) {
        filteredTasks.sort((a, b) => {
          let aVal: any, bVal: any;
          switch (request.sortBy) {
            case 'downloads':
              aVal = a.downloadCount;
              bVal = b.downloadCount;
              break;
            case 'rating':
              aVal = a.rating || 0;
              bVal = b.rating || 0;
              break;
            case 'updated':
              aVal = a.updatedAt.getTime();
              bVal = b.updatedAt.getTime();
              break;
            case 'name':
              aVal = a.name;
              bVal = b.name;
              break;
            default:
              return 0;
          }
          
          const order = request.sortOrder === 'asc' ? 1 : -1;
          return aVal > bVal ? order : aVal < bVal ? -order : 0;
        });
      }

      const total = filteredTasks.length;
      const paginatedTasks = filteredTasks.slice(offset, offset + limit);
      
      // 检查哪些任务已安装
      const installedTasks = await this.databaseService.getTasks();
      const installedTaskIds = new Set(installedTasks.map(t => t.metadata.id));
      
      paginatedTasks.forEach(task => {
        task.isInstalled = installedTaskIds.has(task.taskId);
      });

      return {
        tasks: paginatedTasks,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Failed to search tasks:', error);
      throw error;
    }
  }

  /**
   * 安装任务
   */
  async installTask(request: TaskInstallRequest): Promise<void> {
    try {
      this.logger.info(`Installing task: ${request.taskId}`);
      
      // 从商店下载任务文件
      const taskFile = await this.downloadTaskFile(request.taskId, request.version);
      
      // 验证文件完整性
      await this.validateTaskFile(taskFile);
      
      // 保存到本地数据库
      await this.databaseService.saveTask(taskFile);
      
      // 更新下载统计
      await this.updateDownloadCount(request.taskId);
      
      this.logger.info(`Task installed successfully: ${request.taskId}`);
      this.emit('task:installed', request.taskId);
    } catch (error) {
      this.logger.error(`Failed to install task ${request.taskId}:`, error);
      throw error;
    }
  }

  /**
   * 卸载任务
   */
  async uninstallTask(taskId: string): Promise<void> {
    try {
      await this.databaseService.deleteTask(taskId);
      this.logger.info(`Task uninstalled: ${taskId}`);
      this.emit('task:uninstalled', taskId);
    } catch (error) {
      this.logger.error(`Failed to uninstall task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * 获取商店统计信息
   */
  async getStoreStats(): Promise<TaskStoreStats> {
    try {
      const mockTasks = await this.getMockStoreTasks();
      
      const totalTasks = mockTasks.length;
      const totalDownloads = mockTasks.reduce((sum, task) => sum + task.downloadCount, 0);
      
      // 统计分类
      const categoryMap = new Map<string, number>();
      mockTasks.forEach(task => {
        task.categories.forEach(cat => {
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        });
      });
      
      const categories = Array.from(categoryMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // 统计发布者
      const publisherMap = new Map<string, number>();
      mockTasks.forEach(task => {
        publisherMap.set(task.publisher, (publisherMap.get(task.publisher) || 0) + 1);
      });
      
      const publishers = Array.from(publisherMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 前10名发布者

      return {
        totalTasks,
        totalDownloads,
        categories,
        publishers
      };
    } catch (error) {
      this.logger.error('Failed to get store stats:', error);
      throw error;
    }
  }

  /**
   * 检查任务更新
   */
  async checkForUpdates(): Promise<Array<{ taskId: string; currentVersion: string; latestVersion: string }>> {
    try {
      const installedTasks = await this.databaseService.getTasks();
      const updates: Array<{ taskId: string; currentVersion: string; latestVersion: string }> = [];
      
      for (const task of installedTasks) {
        const storeTask = await this.getTaskFromStore(task.metadata.id);
        if (storeTask && this.isNewerVersion(storeTask.version, task.metadata.version)) {
          updates.push({
            taskId: task.metadata.id,
            currentVersion: task.metadata.version,
            latestVersion: storeTask.version
          });
        }
      }
      
      return updates;
    } catch (error) {
      this.logger.error('Failed to check for updates:', error);
      throw error;
    }
  }

  // 私有方法

  private async getMockStoreTasks(): Promise<TaskStoreItem[]> {
    // 模拟商店数据，实际应该从API获取
    return [
      {
        id: '1',
        taskId: 'web-scraper-pro',
        name: 'web-scraper-pro',
        displayName: '高级网页数据抓取器',
        description: '功能强大的网页数据抓取工具，支持动态内容、反爬虫、多格式导出',
        publisher: 'WebAutomation Team',
        version: '2.1.0',
        repository: 'https://github.com/web-automation/web-scraper-pro',
        homepage: 'https://web-automation.com/scraper-pro',
        keywords: ['scraping', 'data', 'automation', 'web'],
        categories: ['数据抓取', '自动化'],
        license: 'MIT',
        downloadCount: 15420,
        rating: 4.8,
        reviewCount: 156,
        publishedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-12-01'),
        isPublic: true,
        isVerified: true,
        isInstalled: false
      },
      {
        id: '2',
        taskId: 'social-media-poster',
        name: 'social-media-poster',
        displayName: '社交媒体自动发布',
        description: '自动化社交媒体内容发布，支持Twitter、微博、LinkedIn等平台',
        publisher: 'SocialBot Studio',
        version: '1.5.2',
        keywords: ['social', 'posting', 'automation', 'marketing'],
        categories: ['社交媒体', '营销'],
        license: 'Apache-2.0',
        downloadCount: 8930,
        rating: 4.5,
        reviewCount: 89,
        publishedAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-11-20'),
        isPublic: true,
        isVerified: true,
        isInstalled: false
      },
      {
        id: '3',
        taskId: 'form-filler-ai',
        name: 'form-filler-ai',
        displayName: 'AI智能表单填写',
        description: '使用AI技术智能识别和填写网页表单，提高效率',
        publisher: 'AI Tools Inc',
        version: '3.0.1',
        keywords: ['ai', 'form', 'automation', 'smart'],
        categories: ['AI工具', '表单处理'],
        license: 'Commercial',
        downloadCount: 12350,
        rating: 4.9,
        reviewCount: 203,
        publishedAt: new Date('2024-02-20'),
        updatedAt: new Date('2024-12-10'),
        isPublic: true,
        isVerified: true,
        isInstalled: false
      }
    ];
  }

  private async downloadTaskFile(taskId: string, version?: string): Promise<any> {
    // 模拟下载任务文件
    // 实际实现应该从远程API下载
    this.logger.info(`Downloading task file: ${taskId}@${version || 'latest'}`);
    
    // 返回模拟的任务文件
    return {
      metadata: {
        id: taskId,
        name: taskId,
        description: 'Downloaded from store',
        version: version || '1.0.0',
        author: 'Store',
        category: 'automation',
        tags: ['store'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      parameters: [],
      code: `
        async function execute() {
          log('info', 'Task downloaded from store executed');
          return { success: true, message: 'Store task completed' };
        }
      `,
      examples: []
    };
  }

  private async validateTaskFile(taskFile: any): Promise<void> {
    // 验证任务文件的完整性和安全性
    if (!taskFile.metadata || !taskFile.code) {
      throw new Error('Invalid task file format');
    }
  }

  private async updateDownloadCount(taskId: string): Promise<void> {
    // 更新下载统计，实际应该调用商店API
    this.logger.debug(`Updated download count for task: ${taskId}`);
  }

  private async getTaskFromStore(taskId: string): Promise<TaskStoreItem | null> {
    const mockTasks = await this.getMockStoreTasks();
    return mockTasks.find(task => task.taskId === taskId) || null;
  }

  private isNewerVersion(version1: string, version2: string): boolean {
    // 简单的版本比较，实际应该使用semver
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }
    
    return false;
  }
}