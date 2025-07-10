import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { Logger } from './utils/logger';
import { BrowserManager } from './services/browser-manager';
import { DatabaseService } from './database/database-service';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private browserManager: BrowserManager | null = null;
  private databaseService: DatabaseService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('Application');
    this.databaseService = new DatabaseService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    app.whenReady().then(async () => {
      try {
        await this.initialize();
        this.setupIPC(); // 在创建窗口之前设置 IPC
        await this.createWindow();
      } catch (error) {
        this.logger.error('Failed to initialize application:', error);
        app.quit();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.databaseService.initialize();
      this.browserManager = new BrowserManager(this.databaseService);
      await this.browserManager.loadBrowsersFromDatabase();
      this.logger.info('Application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private async createWindow(): Promise<void> {
    try {
      this.mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: join(__dirname, '../preload/index.js')
        },
        show: false // 先不显示，等加载完成后再显示
      });

      const isDev = process.env.NODE_ENV === 'development';
      
      if (isDev) {
        await this.mainWindow.loadURL('http://localhost:5173');
        this.mainWindow.webContents.openDevTools();
      } else {
        await this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
      }

      this.mainWindow.show(); // 加载完成后显示窗口
      
      // 设置主窗口引用到 BrowserManager
      if (this.browserManager) {
        this.browserManager.setMainWindow(this.mainWindow);
      }
      
      this.logger.info('Main window created successfully');
    } catch (error) {
      this.logger.error('Failed to create window:', error);
      throw error;
    }
  }

  private setupIPC(): void {
    try {
      if (!this.browserManager) {
        throw new Error('Browser manager not initialized');
      }

      // 清理可能已存在的处理程序
      ipcMain.removeHandler('browser:create');
      ipcMain.removeHandler('browser:open');
      ipcMain.removeHandler('browser:close');
      ipcMain.removeHandler('browser:delete');
      ipcMain.removeHandler('browser:list');
      ipcMain.removeHandler('browser:status');
      ipcMain.removeHandler('browser:batch');
      ipcMain.removeHandler('browser:platforms');
      ipcMain.removeHandler('browser:refresh');
      ipcMain.removeHandler('system:config');
      ipcMain.removeHandler('system:config:update');

      // Browser IPC handlers
      ipcMain.handle('browser:create', async (event, config) => {
        try {
          this.logger.debug('IPC browser:create called with config:', config);
          return await this.browserManager!.createBrowser(config);
        } catch (error) {
          this.logger.error('IPC browser:create error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('browser:open', async (event, id) => {
        try {
          this.logger.debug(`IPC browser:open called for id: ${id}`);
          return await this.browserManager!.openBrowser(id);
        } catch (error) {
          this.logger.error('IPC browser:open error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('browser:close', async (event, id) => {
        try {
          this.logger.debug(`IPC browser:close called for id: ${id}`);
          return await this.browserManager!.closeBrowser(id);
        } catch (error) {
          this.logger.error('IPC browser:close error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('browser:delete', async (event, id) => {
        try {
          this.logger.debug(`IPC browser:delete called for id: ${id}`);
          return await this.browserManager!.deleteBrowser(id);
        } catch (error) {
          this.logger.error('IPC browser:delete error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('browser:list', async () => {
        try {
          this.logger.debug('IPC browser:list called');
          const result = await this.browserManager!.getBrowsers();
          this.logger.debug(`IPC browser:list returning ${result.length} browsers`);
          return result;
        } catch (error) {
          this.logger.error('IPC browser:list error:', error);
          return [];
        }
      });

      ipcMain.handle('browser:status', async (event, id) => {
        try {
          this.logger.debug(`IPC browser:status called for id: ${id}`);
          return await this.browserManager!.getBrowserStatus(id);
        } catch (error) {
          this.logger.error('IPC browser:status error:', error);
          return 'error';
        }
      });

      ipcMain.handle('browser:batch', async (event, action) => {
        try {
          this.logger.debug('IPC browser:batch called with action:', action);
          return await this.browserManager!.batchOperation(action);
        } catch (error) {
          this.logger.error('IPC browser:batch error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      ipcMain.handle('browser:platforms', async () => {
        try {
          this.logger.debug('IPC browser:platforms called');
          return await this.browserManager!.getPlatformAvailability();
        } catch (error) {
          this.logger.error('IPC browser:platforms error:', error);
          return {};
        }
      });

      ipcMain.handle('browser:refresh', async () => {
        try {
          this.logger.debug('IPC browser:refresh called');
          await this.browserManager!.refreshBrowserStatuses();
          return { success: true };
        } catch (error) {
          this.logger.error('IPC browser:refresh error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      // System IPC handlers
      ipcMain.handle('system:config', async () => {
        try {
          return await this.databaseService.getSystemConfig();
        } catch (error) {
          this.logger.error('IPC system:config error:', error);
          return null;
        }
      });

      ipcMain.handle('system:config:update', async (event, config) => {
        try {
          await this.databaseService.updateSystemConfig(config);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC system:config:update error:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      this.logger.info('All IPC handlers registered successfully');
    } catch (error) {
      this.logger.error('Failed to setup IPC handlers:', error);
      throw error;
    }
  }
}

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

new Application();