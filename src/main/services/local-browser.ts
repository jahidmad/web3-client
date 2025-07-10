import { connect } from 'puppeteer-real-browser';
import type { Browser as PuppeteerBrowser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
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
        config: browserConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      };

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
        turnstile: true,
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

  async deleteBrowser(browserId: string): Promise<void> {
    await this.closeBrowser(browserId);
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
      args.push(`--proxy-server=${this.buildProxyString(config.proxy)}`);
    }

    if (config.userDataDir) {
      args.push(`--user-data-dir=${config.userDataDir}`);
    }

    if (config.args) {
      args.push(...config.args);
    }

    return args;
  }

  private buildProxyString(proxy: ProxyConfig): string {
    const protocol = proxy.type || 'http';
    return `${protocol}://${proxy.host}:${proxy.port}`;
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
          return typeof browser.config === 'string' ? JSON.parse(browser.config) : browser.config;
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
    if (browserData && browserData.status === 'running') {
      this.logger.info(`Browser ${browserId} was closed externally`);
      this.updateBrowserStatus(browserId, 'stopped');
      
      // 清理浏览器数据但保留配置
      browserData.browser = null;
      browserData.pages = [];
    }
  }

  // 清理资源
  public cleanup(): void {
    // No cleanup needed in basic version
  }
}