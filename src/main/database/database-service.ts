import { PrismaClient } from '@prisma/client';
import { Browser, BrowserGroup, Task, Account, SystemConfig } from '../types';
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
      
      await this.initializeDefaultConfig();
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
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
    } catch (error) {
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
      this.logger.error('Failed to initialize default config:', error);
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
}