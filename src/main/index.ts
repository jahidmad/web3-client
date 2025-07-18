import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { Logger } from './utils/logger';
import { BrowserManager } from './services/browser-manager';
import { DatabaseService } from './database/database-service';
import { TaskEngine } from './services/task-engine';
import { TaskScheduler } from './services/task-scheduler';
import { TaskManager } from './services/task-manager';
import { TaskStoreService } from './services/task-store';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private browserManager: BrowserManager | null = null;
  private taskEngine: TaskEngine | null = null;
  private taskScheduler: TaskScheduler | null = null;
  private taskManager: TaskManager | null = null;
  private taskStoreService: TaskStoreService | null = null;
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
      
      // 初始化任务引擎和调度器
      this.taskEngine = new TaskEngine(this.browserManager);
      this.taskScheduler = new TaskScheduler(this.taskEngine);
      
      // 初始化任务管理器
      this.taskManager = new TaskManager(this.browserManager, this.databaseService);
      
      // 初始化任务商店服务
      this.taskStoreService = new TaskStoreService(this.databaseService);
      
      // 启动任务引擎、调度器和任务管理器
      await this.taskEngine.start();
      await this.taskScheduler.start();
      await this.taskManager.start();
      
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
      if (!this.browserManager || !this.taskEngine || !this.taskScheduler || !this.taskManager) {
        throw new Error('Services not initialized');
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
      
      // 清理任务相关处理程序
      ipcMain.removeHandler('task-engine:create-task');
      ipcMain.removeHandler('task-engine:get-tasks');
      ipcMain.removeHandler('task-engine:get-task');
      ipcMain.removeHandler('task-engine:update-task');
      ipcMain.removeHandler('task-engine:delete-task');
      ipcMain.removeHandler('task-engine:execute-task');
      ipcMain.removeHandler('task-engine:get-executions');
      ipcMain.removeHandler('task-scheduler:schedule-task');
      ipcMain.removeHandler('task-scheduler:get-scheduled-tasks');
      ipcMain.removeHandler('task-scheduler:pause-task');
      ipcMain.removeHandler('task-scheduler:resume-task');
      ipcMain.removeHandler('task-scheduler:delete-task');
      
      // 清理任务管理器相关处理程序
      ipcMain.removeHandler('task-manager:upload-task');
      ipcMain.removeHandler('task-manager:import-task');
      ipcMain.removeHandler('task-manager:get-tasks');
      ipcMain.removeHandler('task-manager:get-task');
      ipcMain.removeHandler('task-manager:delete-task');
      ipcMain.removeHandler('task-manager:execute-task');
      ipcMain.removeHandler('task-manager:get-executions');
      ipcMain.removeHandler('task-manager:get-all-executions');
      ipcMain.removeHandler('task-manager:get-task-stats');
      ipcMain.removeHandler('task-manager:check-dependencies');
      ipcMain.removeHandler('task-manager:install-dependencies');
      ipcMain.removeHandler('task-manager:get-dependency-summary');
      ipcMain.removeHandler('task-manager:cleanup-dependencies');

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

      // Task Engine IPC handlers
      ipcMain.handle('task-engine:create-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-engine:create-task called');
          return await this.taskEngine!.createTask(request);
        } catch (error) {
          this.logger.error('IPC task-engine:create-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-engine:get-tasks', async () => {
        try {
          this.logger.debug('IPC task-engine:get-tasks called');
          return await this.taskEngine!.getTasks();
        } catch (error) {
          this.logger.error('IPC task-engine:get-tasks error:', error);
          return [];
        }
      });

      ipcMain.handle('task-engine:get-task', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-engine:get-task called for: ${taskId}`);
          return await this.taskEngine!.getTask(taskId);
        } catch (error) {
          this.logger.error('IPC task-engine:get-task error:', error);
          return null;
        }
      });

      ipcMain.handle('task-engine:update-task', async (event, taskId, updates) => {
        try {
          this.logger.debug(`IPC task-engine:update-task called for: ${taskId}`);
          return await this.taskEngine!.updateTask(taskId, updates);
        } catch (error) {
          this.logger.error('IPC task-engine:update-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-engine:delete-task', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-engine:delete-task called for: ${taskId}`);
          await this.taskEngine!.deleteTask(taskId);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-engine:delete-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-engine:execute-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-engine:execute-task called');
          return await this.taskEngine!.executeTask(request);
        } catch (error) {
          this.logger.error('IPC task-engine:execute-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-engine:get-executions', async () => {
        try {
          this.logger.debug('IPC task-engine:get-executions called');
          return Array.from(this.taskEngine!['executions'].values());
        } catch (error) {
          this.logger.error('IPC task-engine:get-executions error:', error);
          return [];
        }
      });

      // Task Scheduler IPC handlers
      ipcMain.handle('task-scheduler:schedule-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-scheduler:schedule-task called');
          const { taskId, scheduleConfig, browserId, variables } = request;
          return await this.taskScheduler!.scheduleTask(taskId, scheduleConfig, browserId, variables);
        } catch (error) {
          this.logger.error('IPC task-scheduler:schedule-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-scheduler:get-scheduled-tasks', async () => {
        try {
          this.logger.debug('IPC task-scheduler:get-scheduled-tasks called');
          return this.taskScheduler!.getAllScheduledTasks();
        } catch (error) {
          this.logger.error('IPC task-scheduler:get-scheduled-tasks error:', error);
          return [];
        }
      });

      ipcMain.handle('task-scheduler:pause-task', async (event, scheduleId) => {
        try {
          this.logger.debug(`IPC task-scheduler:pause-task called for: ${scheduleId}`);
          await this.taskScheduler!.pauseScheduledTask(scheduleId);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-scheduler:pause-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-scheduler:resume-task', async (event, scheduleId) => {
        try {
          this.logger.debug(`IPC task-scheduler:resume-task called for: ${scheduleId}`);
          await this.taskScheduler!.resumeScheduledTask(scheduleId);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-scheduler:resume-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-scheduler:delete-task', async (event, scheduleId) => {
        try {
          this.logger.debug(`IPC task-scheduler:delete-task called for: ${scheduleId}`);
          await this.taskScheduler!.deleteScheduledTask(scheduleId);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-scheduler:delete-task error:', error);
          throw error;
        }
      });

      // Task Manager IPC handlers
      ipcMain.handle('task-manager:upload-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-manager:upload-task called');
          return await this.taskManager!.uploadTask(request);
        } catch (error) {
          this.logger.error('IPC task-manager:upload-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:import-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-manager:import-task called');
          return await this.taskManager!.importTask(request);
        } catch (error) {
          this.logger.error('IPC task-manager:import-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:get-tasks', async (event, request) => {
        try {
          this.logger.debug('IPC task-manager:get-tasks called');
          return await this.taskManager!.getTasks(request);
        } catch (error) {
          this.logger.error('IPC task-manager:get-tasks error:', error);
          return [];
        }
      });

      ipcMain.handle('task-manager:get-task', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-manager:get-task called for: ${taskId}`);
          return await this.taskManager!.getTask(taskId);
        } catch (error) {
          this.logger.error('IPC task-manager:get-task error:', error);
          return null;
        }
      });

      ipcMain.handle('task-manager:delete-task', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-manager:delete-task called for: ${taskId}`);
          await this.taskManager!.deleteTask(taskId);
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-manager:delete-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:execute-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-manager:execute-task called');
          return await this.taskManager!.executeTask(request);
        } catch (error) {
          this.logger.error('IPC task-manager:execute-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:get-executions', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-manager:get-executions called for: ${taskId}`);
          return await this.taskManager!.getTaskExecutions(taskId);
        } catch (error) {
          this.logger.error('IPC task-manager:get-executions error:', error);
          return [];
        }
      });

      ipcMain.handle('task-manager:get-all-executions', async () => {
        try {
          this.logger.debug('IPC task-manager:get-all-executions called');
          return await this.taskManager!.getAllExecutions();
        } catch (error) {
          this.logger.error('IPC task-manager:get-all-executions error:', error);
          return [];
        }
      });

      ipcMain.handle('task-manager:get-task-stats', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-manager:get-task-stats called for: ${taskId}`);
          return await this.taskManager!.getTaskStats(taskId);
        } catch (error) {
          this.logger.error('IPC task-manager:get-task-stats error:', error);
          return null;
        }
      });

      // Task Store IPC handlers
      ipcMain.handle('task-store:search-tasks', async (event, request) => {
        try {
          this.logger.debug('IPC task-store:search-tasks called');
          return await this.taskStoreService!.searchTasks(request);
        } catch (error) {
          this.logger.error('IPC task-store:search-tasks error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-store:install-task', async (event, request) => {
        try {
          this.logger.debug('IPC task-store:install-task called');
          return await this.taskStoreService!.installTask(request);
        } catch (error) {
          this.logger.error('IPC task-store:install-task error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-store:uninstall-task', async (event, taskId) => {
        try {
          this.logger.debug('IPC task-store:uninstall-task called');
          return await this.taskStoreService!.uninstallTask(taskId);
        } catch (error) {
          this.logger.error('IPC task-store:uninstall-task error:', error);
          throw error;
        }
      });

      // Task Dependencies IPC handlers
      ipcMain.handle('task-manager:check-dependencies', async (event, taskId) => {
        try {
          this.logger.debug(`IPC task-manager:check-dependencies called for: ${taskId}`);
          return await this.taskManager!.checkTaskDependencies(taskId);
        } catch (error) {
          this.logger.error('IPC task-manager:check-dependencies error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:install-dependencies', async (event, request) => {
        try {
          this.logger.debug('IPC task-manager:install-dependencies called');
          return await this.taskManager!.installTaskDependencies(request);
        } catch (error) {
          this.logger.error('IPC task-manager:install-dependencies error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:get-dependency-summary', async () => {
        try {
          this.logger.debug('IPC task-manager:get-dependency-summary called');
          return await this.taskManager!.getDependencySummary();
        } catch (error) {
          this.logger.error('IPC task-manager:get-dependency-summary error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-manager:cleanup-dependencies', async () => {
        try {
          this.logger.debug('IPC task-manager:cleanup-dependencies called');
          await this.taskManager!.cleanupAllDependencies();
          return { success: true };
        } catch (error) {
          this.logger.error('IPC task-manager:cleanup-dependencies error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-store:get-store-stats', async () => {
        try {
          this.logger.debug('IPC task-store:get-store-stats called');
          return await this.taskStoreService!.getStoreStats();
        } catch (error) {
          this.logger.error('IPC task-store:get-store-stats error:', error);
          throw error;
        }
      });

      ipcMain.handle('task-store:check-for-updates', async () => {
        try {
          this.logger.debug('IPC task-store:check-for-updates called');
          return await this.taskStoreService!.checkForUpdates();
        } catch (error) {
          this.logger.error('IPC task-store:check-for-updates error:', error);
          throw error;
        }
      });

      // Browser related IPC for tasks  
      ipcMain.handle('browser:get-browsers', async () => {
        try {
          this.logger.debug('IPC browser:get-browsers called');
          return await this.browserManager!.getBrowsers();
        } catch (error) {
          this.logger.error('IPC browser:get-browsers error:', error);
          return [];
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