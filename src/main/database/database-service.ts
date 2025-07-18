import { PrismaClient } from '@prisma/client';
import { Browser, BrowserGroup, Task, Account, SystemConfig } from '../types';
import type { LocalTask, TaskFile, TaskExecution as TaskExec } from '../types/task';
import { Logger } from '../utils/logger';
import { join } from 'path';

export class DatabaseService {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DatabaseService');
    
    // 确保数据目录存在
    const dataDir = join(process.cwd(), 'data');
    if (!require('fs').existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }
    
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${join(dataDir, 'web3-client.db')}`
        }
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('Database connected successfully');
      
      // 检查并确保表存在
      await this.ensureTablesExist();
      
      await this.initializeDefaultConfig();
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }
  
  /**
   * 确保必要的数据库表存在
   */
  async ensureTablesExist(): Promise<void> {
    try {
      // 尝试查询SystemConfig表，如果不存在会抛出错误
      await this.prisma.$queryRaw`SELECT 1 FROM SystemConfig LIMIT 1`;
      this.logger.info('Database tables exist');
    } catch (error) {
      const err = error as Error;
      if (err.message && err.message.includes('no such table')) {
        this.logger.warn('Required database tables do not exist, creating schema');
        await this.createDatabaseSchema();
      } else {
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.info('Database disconnected');
  }

  async saveBrowser(browser: Browser): Promise<void> {
    try {
      await this.prisma.browser.create({
        data: {
          id: browser.id,
          name: browser.name,
          platform: browser.platform,
          status: browser.status,
          config: JSON.stringify(browser.config),
          createdAt: browser.createdAt,
          updatedAt: browser.updatedAt,
          lastUsedAt: browser.lastUsedAt,
          groupId: browser.groupId
        }
      });
      
      this.logger.info(`Browser saved: ${browser.name} (${browser.id})`);
    } catch (error) {
      this.logger.error(`Failed to save browser ${browser.id}:`, error);
      throw error;
    }
  }

  async updateBrowser(browser: Browser): Promise<void> {
    try {
      await this.prisma.browser.update({
        where: { id: browser.id },
        data: {
          name: browser.name,
          platform: browser.platform,
          status: browser.status,
          config: JSON.stringify(browser.config),
          updatedAt: browser.updatedAt,
          lastUsedAt: browser.lastUsedAt,
          groupId: browser.groupId
        }
      });
      
      this.logger.debug(`Browser updated: ${browser.id}`);
    } catch (error: any) {
      // 如果记录不存在（可能已被删除），忽略此错误
      if (error.code === 'P2025' || error.message?.includes('Record to update not found')) {
        this.logger.debug(`Browser ${browser.id} not found in database, ignoring update`);
        return;
      }
      
      this.logger.error(`Failed to update browser ${browser.id}:`, error);
      throw error;
    }
  }

  async deleteBrowser(browserId: string): Promise<void> {
    try {
      await this.prisma.browser.delete({
        where: { id: browserId }
      });
      
      this.logger.info(`Browser deleted: ${browserId}`);
    } catch (error) {
      this.logger.error(`Failed to delete browser ${browserId}:`, error);
      throw error;
    }
  }

  async getBrowsers(): Promise<Browser[]> {
    try {
      const browsers = await this.prisma.browser.findMany({
        include: {
          group: true
        }
      });
      
      return browsers.map((browser: any) => ({
        id: browser.id,
        name: browser.name,
        platform: browser.platform as any,
        status: browser.status as any,
        config: JSON.parse(browser.config),
        createdAt: browser.createdAt,
        updatedAt: browser.updatedAt,
        lastUsedAt: browser.lastUsedAt || undefined,
        groupId: browser.groupId || undefined
      }));
    } catch (error) {
      this.logger.error('Failed to get browsers:', error);
      throw error;
    }
  }

  async getBrowser(browserId: string): Promise<Browser | null> {
    try {
      const browser = await this.prisma.browser.findUnique({
        where: { id: browserId },
        include: {
          group: true
        }
      });
      
      if (!browser) return null;
      
      return {
        id: browser.id,
        name: browser.name,
        platform: browser.platform as any,
        status: browser.status as any,
        config: JSON.parse(browser.config),
        createdAt: browser.createdAt,
        updatedAt: browser.updatedAt,
        lastUsedAt: browser.lastUsedAt || undefined,
        groupId: browser.groupId || undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get browser ${browserId}:`, error);
      throw error;
    }
  }

  async createBrowserGroup(name: string, description?: string): Promise<string> {
    try {
      const group = await this.prisma.browserGroup.create({
        data: {
          name,
          description
        }
      });
      
      this.logger.info(`Browser group created: ${group.name} (${group.id})`);
      return group.id;
    } catch (error) {
      this.logger.error(`Failed to create browser group:`, error);
      throw error;
    }
  }

  async saveAccount(account: Account): Promise<void> {
    try {
      await this.prisma.account.create({
        data: {
          id: account.id,
          name: account.name,
          type: account.type,
          platform: account.platform,
          credentials: JSON.stringify(account.credentials),
          status: account.status,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          lastUsedAt: account.lastUsedAt,
          groupId: account.groupId
        }
      });
      
      this.logger.info(`Account saved: ${account.name} (${account.id})`);
    } catch (error) {
      this.logger.error(`Failed to save account ${account.id}:`, error);
      throw error;
    }
  }

  async getAccounts(): Promise<Account[]> {
    try {
      const accounts = await this.prisma.account.findMany({
        include: {
          group: true
        }
      });
      
      return accounts.map((account: any) => ({
        id: account.id,
        name: account.name,
        type: account.type as any,
        platform: account.platform,
        credentials: JSON.parse(account.credentials),
        status: account.status as any,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastUsedAt: account.lastUsedAt,
        groupId: account.groupId
      }));
    } catch (error) {
      this.logger.error('Failed to get accounts:', error);
      throw error;
    }
  }

  async logSystemEvent(level: string, message: string, context?: string, metadata?: any): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          level,
          message,
          context,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });
    } catch (error) {
      console.error('Failed to log system event:', error);
    }
  }

  async getSystemConfig(): Promise<SystemConfig | null> {
    try {
      const config = await this.prisma.systemConfig.findFirst();
      if (!config) return null;
      
      return {
        maxConcurrentBrowsers: config.maxConcurrentBrowsers,
        defaultTimeout: config.defaultTimeout,
        retryAttempts: config.retryAttempts,
        logLevel: config.logLevel as any,
        dataDirectory: config.dataDirectory,
        autoCleanup: config.autoCleanup,
        cleanupInterval: config.cleanupInterval
      };
    } catch (error) {
      this.logger.error('Failed to get system config:', error);
      return null;
    }
  }

  async updateSystemConfig(config: Partial<SystemConfig>): Promise<void> {
    try {
      const existingConfig = await this.prisma.systemConfig.findFirst();
      
      if (existingConfig) {
        await this.prisma.systemConfig.update({
          where: { id: existingConfig.id },
          data: config
        });
      } else {
        await this.prisma.systemConfig.create({
          data: config as any
        });
      }
      
      this.logger.info('System config updated');
    } catch (error) {
      this.logger.error('Failed to update system config:', error);
      throw error;
    }
  }

  private async initializeDefaultConfig(): Promise<void> {
    try {
      const existingConfig = await this.prisma.systemConfig.findFirst();
      
      if (!existingConfig) {
        await this.prisma.systemConfig.create({
          data: {
            maxConcurrentBrowsers: 10,
            defaultTimeout: 30000,
            retryAttempts: 3,
            logLevel: 'info',
            dataDirectory: './data',
            autoCleanup: true,
            cleanupInterval: 3600000
          }
        });
        
        this.logger.info('Default system config initialized');
      }
    } catch (error) {
      // 检查是否是表不存在错误
      const err = error as Error;
      if (err.message && err.message.includes('does not exist in the current database')) {
        this.logger.warn('SystemConfig table does not exist, attempting to create schema');
        await this.createDatabaseSchema();
        // 重试初始化默认配置
        await this.initializeDefaultConfig();
      } else {
        this.logger.error('Failed to initialize default config:', error);
        throw error;
      }
    }
  }
  
  /**
   * 创建数据库架构
   * 当检测到表不存在时，使用Prisma创建数据库架构
   */
  private async createDatabaseSchema(): Promise<void> {
    try {
      // 使用子进程执行prisma db push命令
      const { execSync } = require('child_process');
      this.logger.info('Creating database schema using Prisma...');
      
      // 执行prisma db push命令
      execSync('npx prisma db push --schema=src/main/database/schema.prisma', {
        stdio: 'inherit'
      });
      
      this.logger.info('Database schema created successfully');
    } catch (error) {
      this.logger.error('Failed to create database schema:', error);
      throw error;
    }
  }

  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await this.prisma.systemLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });
      
      this.logger.info(`Cleaned up ${result.count} old log entries`);
    } catch (error) {
      this.logger.error('Failed to cleanup old logs:', error);
    }
  }

  // ===== 任务管理方法 =====

  async saveTask(taskFile: TaskFile): Promise<LocalTask> {
    try {
      const task = await this.prisma.task.create({
        data: {
          id: taskFile.metadata.id,
          taskId: taskFile.metadata.id,
          name: taskFile.metadata.name,
          description: taskFile.metadata.description,
          version: taskFile.metadata.version,
          author: taskFile.metadata.author,
          logoUrl: taskFile.metadata.logoUrl,
          category: taskFile.metadata.category,
          tags: JSON.stringify(taskFile.metadata.tags || []),
          code: taskFile.code,
          parameters: JSON.stringify(taskFile.parameters || []),
          examples: JSON.stringify(taskFile.examples || []),
          type: 'automation',
          status: 'active',
          usageCount: 0
        }
      });

      const localTask: LocalTask = {
        id: task.id,
        filePath: '', // 不再使用文件路径
        metadata: taskFile.metadata,
        parameters: taskFile.parameters,
        addedAt: task.createdAt,
        usageCount: task.usageCount,
        status: task.status as 'active' | 'disabled',
        lastUsed: task.lastUsed || undefined
      };

      this.logger.info(`Task saved to database: ${taskFile.metadata.name} (${task.id})`);
      return localTask;
    } catch (error) {
      this.logger.error(`Failed to save task ${taskFile.metadata.id}:`, error);
      throw error;
    }
  }

  async getTasks(): Promise<LocalTask[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        where: {
          type: 'automation' // 只获取新的自动化任务
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return tasks.map(task => ({
        id: task.id,
        filePath: '', // 不再使用文件路径
        metadata: {
          id: task.taskId || task.id,
          name: task.name,
          description: task.description || '',
          version: task.version || '1.0.0',
          author: task.author || 'Unknown',
          logoUrl: task.logoUrl || undefined,
          category: task.category || 'general',
          tags: task.tags ? JSON.parse(task.tags) : [],
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        },
        parameters: task.parameters ? JSON.parse(task.parameters) : [],
        addedAt: task.createdAt,
        usageCount: task.usageCount,
        status: task.status as 'active' | 'disabled',
        lastUsed: task.lastUsed || undefined
      }));
    } catch (error) {
      this.logger.error('Failed to get tasks:', error);
      throw error;
    }
  }

  async getTask(taskId: string): Promise<LocalTask | null> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) return null;

      return {
        id: task.id,
        filePath: '',
        metadata: {
          id: task.taskId || task.id,
          name: task.name,
          description: task.description || '',
          version: task.version || '1.0.0',
          author: task.author || 'Unknown',
          logoUrl: task.logoUrl || undefined,
          category: task.category || 'general',
          tags: task.tags ? JSON.parse(task.tags) : [],
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        },
        parameters: task.parameters ? JSON.parse(task.parameters) : [],
        addedAt: task.createdAt,
        usageCount: task.usageCount,
        status: task.status as 'active' | 'disabled',
        lastUsed: task.lastUsed || undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get task ${taskId}:`, error);
      throw error;
    }
  }

  async getTaskFile(taskId: string): Promise<TaskFile | null> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId }
      });

      if (!task) return null;

      return {
        metadata: {
          id: task.taskId || task.id,
          name: task.name,
          description: task.description || '',
          version: task.version || '1.0.0',
          author: task.author || 'Unknown',
          logoUrl: task.logoUrl || undefined,
          category: task.category || 'general',
          tags: task.tags ? JSON.parse(task.tags) : [],
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        },
        parameters: task.parameters ? JSON.parse(task.parameters) : [],
        code: task.code || '',
        examples: task.examples ? JSON.parse(task.examples) : []
      };
    } catch (error) {
      this.logger.error(`Failed to get task file ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.prisma.task.delete({
        where: { id: taskId }
      });

      this.logger.info(`Task deleted: ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to delete task ${taskId}:`, error);
      throw error;
    }
  }

  async updateTaskUsage(taskId: string): Promise<void> {
    try {
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          usageCount: {
            increment: 1
          },
          lastUsed: new Date()
        }
      });
    } catch (error) {
      this.logger.error(`Failed to update task usage ${taskId}:`, error);
      throw error;
    }
  }

  async saveTaskExecution(execution: TaskExec): Promise<void> {
    try {
      await this.prisma.taskExecution.create({
        data: {
          id: execution.id,
          taskId: execution.taskId,
          browserId: execution.browserId,
          status: execution.status,
          startTime: execution.startTime,
          endTime: execution.endTime,
          error: execution.error,
          logs: JSON.stringify(execution.logs || []),
          retryCount: 0,
          progressCompleted: execution.progress?.current,
          progressTotal: execution.progress?.total,
          variables: JSON.stringify(execution.parameters || {})
        }
      });
    } catch (error) {
      this.logger.error(`Failed to save task execution ${execution.id}:`, error);
      throw error;
    }
  }

  async getTaskExecutions(taskId: string): Promise<TaskExec[]> {
    try {
      const executions = await this.prisma.taskExecution.findMany({
        where: { taskId },
        orderBy: { startTime: 'desc' }
      });

      return executions.map(exec => ({
        id: exec.id,
        taskId: exec.taskId,
        browserId: exec.browserId,
        status: exec.status as any,
        startTime: exec.startTime,
        endTime: exec.endTime || undefined,
        error: exec.error || undefined,
        logs: exec.logs ? JSON.parse(exec.logs) : [],
        parameters: exec.variables ? JSON.parse(exec.variables) : {},
        progress: exec.progressCompleted !== null && exec.progressTotal !== null 
          ? { current: exec.progressCompleted, total: exec.progressTotal }
          : undefined
      }));
    } catch (error) {
      this.logger.error(`Failed to get task executions for ${taskId}:`, error);
      throw error;
    }
  }

  async getAllTaskExecutions(): Promise<TaskExec[]> {
    try {
      const executions = await this.prisma.taskExecution.findMany({
        orderBy: { startTime: 'desc' }
      });

      return executions.map(exec => ({
        id: exec.id,
        taskId: exec.taskId,
        browserId: exec.browserId,
        status: exec.status as any,
        startTime: exec.startTime,
        endTime: exec.endTime || undefined,
        error: exec.error || undefined,
        logs: exec.logs ? JSON.parse(exec.logs) : [],
        parameters: exec.variables ? JSON.parse(exec.variables) : {},
        progress: exec.progressCompleted !== null && exec.progressTotal !== null 
          ? { current: exec.progressCompleted, total: exec.progressTotal }
          : undefined
      }));
    } catch (error) {
      this.logger.error('Failed to get all task executions:', error);
      throw error;
    }
  }
}