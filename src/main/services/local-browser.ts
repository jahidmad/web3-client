import { connect } from 'puppeteer-real-browser';
import type { Browser as PuppeteerBrowser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { 
  Browser, 
  BrowserConfig, 
  BrowserStatus, 
  IBrowserPlatform, 
  LocalBrowserConfig,
  ProxyConfig,
  FingerprintConfig
} from '../types/browser';
import { Logger } from '../utils/logger';

export class LocalBrowser implements IBrowserPlatform {
  public readonly platformType = 'local' as const;
  
  private browsers: Map<string, {
    browser: any;
    config: LocalBrowserConfig;
    status: BrowserStatus;
    pages: any[];
    startTime?: Date;
  }> = new Map();
  
  private logger: Logger;
  private databaseService: any;
  private statusChangeCallback?: (browserId: string, newStatus: BrowserStatus) => void;
  private globalMonitorInterval?: NodeJS.Timeout;

  constructor(databaseService?: any) {
    this.logger = new Logger('LocalBrowser');
    this.databaseService = databaseService;
  }

  async createBrowser(config: BrowserConfig): Promise<Browser> {
    const browserConfig = config as LocalBrowserConfig;
    const browserId = config.id || uuidv4();
    
    try {
      this.logger.info(`Creating local browser: ${browserConfig.name}`);
      
      // 为每个浏览器创建唯一的用户数据目录
      const userDataDir = await this.createUserDataDirectory(browserId, browserConfig.name);
      browserConfig.userDataDir = userDataDir;
      
      // 存储配置以便后续使用
      this.browsers.set(browserId, {
        browser: null,
        config: browserConfig,
        status: 'stopped',
        pages: []
      });
      
      const browser: Browser = {
        id: browserId,
        name: browserConfig.name,
        platform: 'local',
        status: 'stopped',
        config: {
          ...browserConfig,  // 保留完整配置，包括代理
          id: browserId,     // 确保 ID 正确
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.logger.info(`Browser ${browserId} created with user data directory: ${userDataDir}`);
      return browser;
    } catch (error) {
      this.logger.error(`Failed to create browser ${browserConfig.name}:`, error);
      throw error;
    }
  }

  async openBrowser(browserId: string): Promise<void> {
    const existingBrowser = this.browsers.get(browserId);
    if (existingBrowser && existingBrowser.status === 'running') {
      this.logger.warn(`Browser ${browserId} is already running`);
      return;
    }

    try {
      this.logger.info(`Opening browser: ${browserId}`);
      
      const config = existingBrowser?.config || await this.getStoredConfig(browserId);
      if (!config) {
        throw new Error(`Browser configuration not found for ${browserId}`);
      }

      const args = this.buildLaunchArgs(config);
      
      const { browser, page } = await connect({
        headless: config.headless || false,
        args,
        turnstile: false,
        customConfig: {
          userDataDir: config.userDataDir,
        },
        connectOption: {
          defaultViewport: config.fingerprint?.viewport || { width: 1920, height: 1080 }
        }
      });

      this.browsers.set(browserId, {
        browser,
        config,
        status: 'running',
        pages: [page],
        startTime: new Date()
      });

      this.logger.info(`Browser ${browserId} opened successfully`);
      
      await this.applyFingerprint(page, config.fingerprint);
      
      // 设置浏览器事件监听
      this.setupBrowserEventListeners(browserId, browser);
      
    } catch (error) {
      this.logger.error(`Failed to open browser ${browserId}:`, error);
      this.updateBrowserStatus(browserId, 'error');
      throw error;
    }
  }

  async closeBrowser(browserId: string): Promise<void> {
    const browserData = this.browsers.get(browserId);
    if (!browserData) {
      this.logger.warn(`Browser ${browserId} not found`);
      return;
    }

    try {
      this.logger.info(`Closing browser: ${browserId}`);
      this.updateBrowserStatus(browserId, 'stopping');
      
      if (browserData.browser && !browserData.browser.process()?.killed) {
        // 移除事件监听器以防止在删除后触发状态更新
        try {
          const process = browserData.browser.process();
          if (process) {
            process.removeAllListeners('exit');
            process.removeAllListeners('error');
          }
          browserData.browser.removeAllListeners('disconnected');
        } catch (cleanupError) {
          this.logger.debug(`Event listener cleanup failed for ${browserId}:`, cleanupError);
        }
        
        await browserData.browser.close();
      }
      
      this.browsers.delete(browserId);
      this.logger.info(`Browser ${browserId} closed successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to close browser ${browserId}:`, error);
      this.updateBrowserStatus(browserId, 'error');
      throw error;
    }
  }

  async getBrowserStatus(browserId: string): Promise<BrowserStatus> {
    const browserData = this.browsers.get(browserId);
    if (!browserData) {
      return 'stopped';
    }
    
    // 如果没有浏览器实例，直接返回停止状态
    if (!browserData.browser) {
      return 'stopped';
    }
    
    // 直接检查进程状态
    try {
      const process = browserData.browser.process();
      if (process && !process.killed && process.exitCode === null) {
        return 'running';
      } else {
        return 'stopped';
      }
    } catch (error) {
      this.logger.debug(`Process check failed for ${browserId}: ${error instanceof Error ? error.message : String(error)}`);
      return 'stopped';
    }
  }

  async deleteBrowser(browserId: string, deleteUserData: boolean = true): Promise<void> {
    // 先获取浏览器数据（在closeBrowser删除之前）
    const browserData = this.browsers.get(browserId);
    
    // 关闭浏览器并清理事件监听器
    await this.closeBrowser(browserId);
    
    this.logger.info(`browserData: ${browserData}`)
    
    // 清理用户数据目录（始终删除）
    if (browserData && browserData.config.userDataDir) {
      try {
        await this.removeUserDataDirectory(browserData.config.userDataDir);
        this.logger.info(`Browser ${browserId} deleted, user data removed from: ${browserData.config.userDataDir}`);
      } catch (error) {
        this.logger.warn(`Failed to clean user data directory for ${browserId}:`, error);
      }
    }
    
    this.logger.info(`Browser ${browserId} deleted`);
  }

  // 完全删除浏览器和用户数据
  async deleteBrowserWithData(browserId: string, deleteUserData: boolean = false): Promise<void> {
    await this.closeBrowser(browserId);
    
    // 获取浏览器数据以便清理用户目录
    const browserData = this.browsers.get(browserId);
    
    // 从内存中删除浏览器数据
    this.browsers.delete(browserId);
    
    // 清理用户数据目录
    if (browserData && browserData.config.userDataDir) {
      try {
        if (deleteUserData) {
          await this.removeUserDataDirectory(browserData.config.userDataDir);
          this.logger.info(`Browser ${browserId} and user data deleted completely`);
        } else {
          this.logger.info(`Browser ${browserId} deleted, user data preserved at: ${browserData.config.userDataDir}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to clean user data directory for ${browserId}:`, error);
      }
    }
    
    this.logger.info(`Browser ${browserId} deleted`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { browser } = await connect({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      await browser.close();
      return true;
    } catch (error) {
      this.logger.error('Local browser platform not available:', error);
      return false;
    }
  }

  private buildLaunchArgs(config: LocalBrowserConfig): string[] {
    const args: string[] = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];

    if (config.proxy) {
      const proxyString = this.buildProxyString(config.proxy);
      args.push(`--proxy-server=${proxyString}`);
    }

    // 移除 --user-data-dir 参数，因为现在通过 userDataDir 选项传递
    // if (config.userDataDir) {
    //   args.push(`--user-data-dir=${config.userDataDir}`);
    // }

    if (config.args) {
      args.push(...config.args);
    }

    return args;
  }

  private buildProxyString(proxy: ProxyConfig): string {
    const protocol = proxy.type || proxy.protocol || 'http';
    let proxyUrl = `${protocol}://${proxy.host}:${proxy.port}`;
    
    // 如果有用户名密码，添加认证
    if (proxy.username && proxy.password) {
      proxyUrl = `${protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    }
    
    return proxyUrl;
  }

  private async applyFingerprint(page: any, fingerprint?: FingerprintConfig): Promise<void> {
    if (!fingerprint) return;

    try {
      if (fingerprint.userAgent) {
        await page.setUserAgent(fingerprint.userAgent);
      }

      if (fingerprint.viewport) {
        await page.setViewport(fingerprint.viewport);
      }

      if (fingerprint.timezone) {
        await page.emulateTimezone(fingerprint.timezone);
      }

      if (fingerprint.language) {
        await page.setExtraHTTPHeaders({
          'Accept-Language': fingerprint.language
        });
      }

      this.logger.info('Fingerprint applied successfully');
    } catch (error) {
      this.logger.error('Failed to apply fingerprint:', error);
    }
  }

  private updateBrowserStatus(browserId: string, status: BrowserStatus): void {
    const browserData = this.browsers.get(browserId);
    if (browserData) {
      const oldStatus = browserData.status;
      browserData.status = status;
      
      // 通知状态变化
      if (oldStatus !== status && this.statusChangeCallback) {
        this.statusChangeCallback(browserId, status);
      }
    }
  }

  private async getStoredConfig(browserId: string): Promise<LocalBrowserConfig | null> {
    try {
      if (this.databaseService) {
        const browser = await this.databaseService.getBrowser(browserId);
        if (browser && browser.config) {
          const config = typeof browser.config === 'string' ? JSON.parse(browser.config) : browser.config;
          
          // 确保用户数据目录存在，如果不存在则重新创建
          if (!config.userDataDir) {
            const userDataDir = await this.createUserDataDirectory(browserId, config.name || 'Unknown');
            config.userDataDir = userDataDir;
            this.logger.info(`Regenerated user data directory for browser ${browserId}: ${userDataDir}`);
          }
          
          return config;
        }
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get stored config for browser ${browserId}:`, error);
      return null;
    }
  }

  public async getPage(browserId: string, pageIndex: number = 0): Promise<any | null> {
    const browserData = this.browsers.get(browserId);
    if (!browserData || !browserData.pages[pageIndex]) {
      return null;
    }
    
    return browserData.pages[pageIndex];
  }

  public async createNewPage(browserId: string): Promise<any | null> {
    const browserData = this.browsers.get(browserId);
    if (!browserData) {
      return null;
    }
    
    try {
      const page = await browserData.browser.newPage();
      browserData.pages.push(page);
      return page;
    } catch (error) {
      this.logger.error(`Failed to create new page for browser ${browserId}:`, error);
      return null;
    }
  }

  public getBrowserCount(): number {
    return this.browsers.size;
  }

  public getRunningBrowsers(): string[] {
    return Array.from(this.browsers.entries())
      .filter(([_, data]) => data.status === 'running')
      .map(([id]) => id);
  }

  public async initializeBrowserConfig(browserId: string, config: any): Promise<void> {
    this.browsers.set(browserId, {
      browser: null,
      config: config,
      status: 'stopped',
      pages: []
    });
    this.logger.debug(`Initialized config for browser ${browserId}`);
  }

  // 设置状态变化回调
  public setStatusChangeCallback(callback: (browserId: string, newStatus: BrowserStatus) => void): void {
    this.statusChangeCallback = callback;
  }

  // 简单的事件监听器设置
  private setupBrowserEventListeners(browserId: string, browser: any): void {
    try {
      // 监听WebSocket断开连接事件
      if (browser.on) {
        browser.once('disconnected', () => {
          this.logger.info(`Browser ${browserId} WebSocket disconnected`);
          this.handleBrowserProcessExit(browserId);
        });
      }

      // 监听进程退出事件
      const process = browser.process();
      if (process) {
        process.once('exit', (code: number) => {
          this.logger.info(`Browser process ${browserId} exited with code ${code}`);
          this.handleBrowserProcessExit(browserId);
        });

        process.once('error', (error: any) => {
          this.logger.error(`Browser process ${browserId} error:`, error);
          this.handleBrowserProcessExit(browserId);
        });
      }
    } catch (error) {
      this.logger.debug(`Failed to setup event listeners for ${browserId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // 处理浏览器进程退出
  private handleBrowserProcessExit(browserId: string): void {
    const browserData = this.browsers.get(browserId);
    // 只有当浏览器仍在内存中且状态为运行时才处理退出
    if (browserData && browserData.status === 'running') {
      this.logger.info(`Browser ${browserId} was closed externally`);
      this.updateBrowserStatus(browserId, 'stopped');
      
      // 清理浏览器数据但保留配置
      browserData.browser = null;
      browserData.pages = [];
    } else {
      // 如果浏览器已被删除，则忽略此事件
      this.logger.debug(`Ignoring process exit for deleted browser ${browserId}`);
    }
  }

  // 创建用户数据目录
  private async createUserDataDirectory(browserId: string, browserName: string): Promise<string> {
    try {
      // 获取应用数据目录
      const appDataDir = process.env.APPDATA || 
                         (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : 
                          path.join(os.homedir(), '.local', 'share'));
      
      // 创建Web3Client浏览器配置文件目录
      const baseDir = path.join(appDataDir, 'Web3Client', 'browsers');
      
      // 确保基础目录存在
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      
      // 创建浏览器专用目录 (使用ID和名称)
      const safeBrowserName = browserName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const userDataDir = path.join(baseDir, `${safeBrowserName}_${browserId.substring(0, 8)}`);
      
      // 确保用户数据目录存在
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      
      this.logger.info(`Created user data directory: ${userDataDir}`);
      return userDataDir;
    } catch (error) {
      this.logger.error(`Failed to create user data directory for ${browserId}:`, error);
      // 回退到临时目录
      const tempDir = path.join(os.tmpdir(), 'web3client-browsers', browserId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      return tempDir;
    }
  }
  
  // 删除用户数据目录（可选使用）
  private async removeUserDataDirectory(userDataDir: string): Promise<void> {
    try {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
        this.logger.info(`Removed user data directory: ${userDataDir}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove user data directory ${userDataDir}:`, error);
      throw error;
    }
  }
  
  // 获取用户数据目录大小（用于统计）
  public async getUserDataSize(browserId: string): Promise<number> {
    const browserData = this.browsers.get(browserId);
    if (!browserData || !browserData.config.userDataDir) {
      return 0;
    }
    
    try {
      return await this.getDirectorySize(browserData.config.userDataDir);
    } catch (error) {
      this.logger.error(`Failed to get user data size for ${browserId}:`, error);
      return 0;
    }
  }
  
  // 计算目录大小
  private async getDirectorySize(dirPath: string): Promise<number> {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }
    
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += await this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
  
  // 清理资源
  public cleanup(): void {
    // No cleanup needed in basic version
  }
}