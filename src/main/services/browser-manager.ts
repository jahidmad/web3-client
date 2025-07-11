import { v4 as uuidv4 } from 'uuid';
import { 
  Browser, 
  BrowserConfig, 
  BrowserStatus, 
  BrowserFilter, 
  CreateBrowserRequest,
  BatchAction,
  BatchResult,
  IBrowserPlatform,
  BrowserOperationResult
} from '../types/browser';
import { LocalBrowser } from './local-browser';
import { DatabaseService } from '../database/database-service';
import { Logger } from '../utils/logger';

export class BrowserManager {
  private platforms: Map<string, IBrowserPlatform> = new Map();
  private browsers: Map<string, Browser> = new Map();
  private logger: Logger;
  private databaseService: DatabaseService;
  private mainWindow: any; // 添加主窗口引用用于通知前端

  constructor(databaseService: DatabaseService, mainWindow?: any) {
    this.logger = new Logger('BrowserManager');
    this.databaseService = databaseService;
    this.mainWindow = mainWindow;
    this.initializePlatforms();
  }

  private initializePlatforms(): void {
    const localBrowser = new LocalBrowser(this.databaseService);
    
    // 设置状态变化回调
    if (localBrowser.setStatusChangeCallback) {
      localBrowser.setStatusChangeCallback((browserId: string, newStatus: BrowserStatus) => {
        this.handleBrowserStatusChange(browserId, newStatus);
      });
    }
    
    this.platforms.set('local', localBrowser);
    
    this.logger.info('Browser platforms initialized');
  }

  async createBrowser(request: CreateBrowserRequest): Promise<BrowserOperationResult> {
    try {
      const browserId = uuidv4();
      
      const config: BrowserConfig = {
        id: browserId,
        name: request.name,
        platform: request.platform,
        headless: request.headless,
        proxy: request.proxy,
        ...request.config  // 其他额外配置
      };

      const platform = this.platforms.get(request.platform);
      if (!platform) {
        throw new Error(`Platform ${request.platform} not supported`);
      }

      const browser = await platform.createBrowser(config);
      this.browsers.set(browserId, browser);

      await this.databaseService.saveBrowser(browser);
      
      this.logger.info(`Browser created: ${browser.name} (${browserId})`);
      
      return {
        success: true,
        data: browser
      };
    } catch (error) {
      this.logger.error('Failed to create browser:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async openBrowser(browserId: string): Promise<BrowserOperationResult> {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        throw new Error(`Browser ${browserId} not found`);
      }

      const platform = this.platforms.get(browser.platform);
      if (!platform) {
        throw new Error(`Platform ${browser.platform} not available`);
      }

      await platform.openBrowser(browserId);
      
      browser.status = 'running';
      browser.lastUsedAt = new Date();
      browser.updatedAt = new Date();
      
      await this.databaseService.updateBrowser(browser);
      
      this.logger.info(`Browser opened: ${browser.name} (${browserId})`);
      
      return {
        success: true,
        data: browser
      };
    } catch (error) {
      this.logger.error(`Failed to open browser ${browserId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async closeBrowser(browserId: string): Promise<BrowserOperationResult> {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        throw new Error(`Browser ${browserId} not found`);
      }

      const platform = this.platforms.get(browser.platform);
      if (!platform) {
        throw new Error(`Platform ${browser.platform} not available`);
      }

      await platform.closeBrowser(browserId);
      
      browser.status = 'stopped';
      browser.updatedAt = new Date();
      
      await this.databaseService.updateBrowser(browser);
      
      this.logger.info(`Browser closed: ${browser.name} (${browserId})`);
      
      return {
        success: true,
        data: browser
      };
    } catch (error) {
      this.logger.error(`Failed to close browser ${browserId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteBrowser(browserId: string, deleteUserData: boolean = false): Promise<BrowserOperationResult> {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        throw new Error(`Browser ${browserId} not found`);
      }

      const platform = this.platforms.get(browser.platform);
      if (platform) {
        await platform.deleteBrowser(browserId, deleteUserData);
      }

      this.browsers.delete(browserId);
      await this.databaseService.deleteBrowser(browserId);
      
      this.logger.info(`Browser deleted: ${browser.name} (${browserId})`);
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to delete browser ${browserId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getBrowsers(filter?: BrowserFilter): Promise<Browser[]> {
    try {
      let browsers = Array.from(this.browsers.values());

      if (filter) {
        if (filter.platform) {
          browsers = browsers.filter(b => b.platform === filter.platform);
        }
        
        if (filter.status) {
          browsers = browsers.filter(b => b.status === filter.status);
        }
        
        if (filter.groupId) {
          browsers = browsers.filter(b => b.groupId === filter.groupId);
        }
        
        if (filter.search) {
          const searchTerm = filter.search.toLowerCase();
          browsers = browsers.filter(b => 
            b.name.toLowerCase().includes(searchTerm) ||
            b.id.toLowerCase().includes(searchTerm)
          );
        }
      }

      return browsers;
    } catch (error) {
      this.logger.error('Failed to get browsers:', error);
      return [];
    }
  }

  getBrowser(browserId: string): Browser | undefined {
    return this.browsers.get(browserId);
  }

  async getBrowserStatus(browserId: string): Promise<BrowserStatus> {
    try {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        return 'stopped';
      }

      const platform = this.platforms.get(browser.platform);
      if (!platform) {
        return 'error';
      }

      const status = await platform.getBrowserStatus(browserId);
      
      if (browser.status !== status) {
        browser.status = status;
        browser.updatedAt = new Date();
        await this.databaseService.updateBrowser(browser);
      }

      return status;
    } catch (error) {
      this.logger.error(`Failed to get browser status for ${browserId}:`, error);
      return 'error';
    }
  }

  async batchOperation(action: BatchAction): Promise<BatchResult> {
    const results: BatchResult['results'] = [];
    let successCount = 0;

    for (const browserId of action.targetIds) {
      try {
        let result: BrowserOperationResult;

        switch (action.type) {
          case 'start':
            result = await this.openBrowser(browserId);
            break;
          case 'stop':
            result = await this.closeBrowser(browserId);
            break;
          case 'restart':
            await this.closeBrowser(browserId);
            result = await this.openBrowser(browserId);
            break;
          case 'delete':
            result = await this.deleteBrowser(browserId);
            break;
          default:
            throw new Error(`Unsupported action: ${action.type}`);
        }

        results.push({
          id: browserId,
          success: result.success,
          error: result.error
        });

        if (result.success) {
          successCount++;
        }
      } catch (error) {
        results.push({
          id: browserId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const batchResult: BatchResult = {
      success: successCount === action.targetIds.length,
      results
    };

    this.logger.info(`Batch operation ${action.type} completed. Success: ${successCount}/${action.targetIds.length}`);
    
    return batchResult;
  }

  async loadBrowsersFromDatabase(): Promise<void> {
    try {
      const browsers = await this.databaseService.getBrowsers();
      for (const browser of browsers) {
        browser.status = 'stopped';
        this.browsers.set(browser.id, browser);
        
        // 初始化平台状态
        const platform = this.platforms.get(browser.platform);
        if (platform && platform.platformType === 'local') {
          const localPlatform = platform as any;
          if (localPlatform.initializeBrowserConfig) {
            await localPlatform.initializeBrowserConfig(browser.id, browser.config);
          }
        }
      }
      
      this.logger.info(`Loaded ${browsers.length} browsers from database`);
    } catch (error) {
      this.logger.error('Failed to load browsers from database:', error);
    }
  }

  async getPlatformAvailability(): Promise<Record<string, boolean>> {
    const availability: Record<string, boolean> = {};
    
    for (const [platformName, platform] of this.platforms.entries()) {
      try {
        availability[platformName] = await platform.isAvailable();
      } catch (error) {
        availability[platformName] = false;
      }
    }
    
    return availability;
  }

  getBrowserCount(): number {
    return this.browsers.size;
  }

  getRunningBrowserCount(): number {
    return Array.from(this.browsers.values()).filter(b => b.status === 'running').length;
  }

  // 设置主窗口引用（用于状态通知）
  setMainWindow(mainWindow: any): void {
    this.mainWindow = mainWindow;
  }

  // 处理浏览器状态变化
  private async handleBrowserStatusChange(browserId: string, newStatus: BrowserStatus): Promise<void> {
    try {
      const browser = this.browsers.get(browserId);
      if (browser) {
        const oldStatus = browser.status;
        browser.status = newStatus;
        browser.updatedAt = new Date();
        
        // 检查数据库中是否还存在该浏览器记录
        try {
          const dbBrowser = await this.databaseService.getBrowser(browserId);
          if (!dbBrowser) {
            this.logger.debug(`Browser ${browserId} not found in database, skipping update`);
            return;
          }
          
          // 更新数据库
          await this.databaseService.updateBrowser(browser);
        } catch (dbError: any) {
          if (dbError.code === 'P2025' || dbError.message?.includes('Record to update not found')) {
            // 数据库中记录不存在，可能已被删除，忽略此更新
            this.logger.debug(`Browser ${browserId} record not found in database, skipping status update`);
            return;
          } else {
            // 其他数据库错误，重新抛出
            throw dbError;
          }
        }
        
        // 通知前端
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('browser:status:changed', {
            browserId,
            oldStatus,
            newStatus,
            browser
          });
        }
        
        this.logger.info(`Browser ${browserId} status changed: ${oldStatus} -> ${newStatus}`);
      } else {
        this.logger.debug(`Browser ${browserId} not found in memory, ignoring status change to ${newStatus}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle status change for browser ${browserId}:`, error);
    }
  }

  // 手动刷新所有浏览器状态
  async refreshBrowserStatuses(): Promise<void> {
    try {
      this.logger.info('Starting manual refresh of all browser statuses');
      
      for (const [platformName, platform] of this.platforms.entries()) {
        if (platform.platformType === 'local' && (platform as any).refreshAllBrowserStatuses) {
          await (platform as any).refreshAllBrowserStatuses();
        }
      }
      
      this.logger.info('Manual browser status refresh completed');
    } catch (error) {
      this.logger.error('Failed to refresh browser statuses:', error);
    }
  }

  /**
   * 获取平台实例 - 供TaskEngine使用
   */
  public getPlatform(platformName: string): IBrowserPlatform | undefined {
    return this.platforms.get(platformName);
  }

  /**
   * 获取所有平台
   */
  public getPlatforms(): Map<string, IBrowserPlatform> {
    return this.platforms;
  }
}