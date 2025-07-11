import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../utils/logger';
import { 
  TaskFile,
  LocalTask,
  TaskExecution,
  TaskExecutionRequest,
  TaskExecutionStatus,
  TaskExecutionContext,
  TaskStats,
  UploadTaskRequest,
  ImportTaskRequest,
  GetTasksRequest
} from '../types/task';
import { BrowserManager } from './browser-manager';
import { DatabaseService } from '../database/database-service';

/**
 * 任务管理器 - 管理任务文件的导入、解析、执行
 */
export class TaskManager extends EventEmitter {
  private logger: Logger;
  private browserManager: BrowserManager;
  private databaseService: DatabaseService;
  private tasksDirectory: string;
  private localTasks: Map<string, LocalTask> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private isRunning: boolean = false;

  constructor(browserManager: BrowserManager, databaseService: DatabaseService, tasksDirectory?: string) {
    super();
    this.logger = new Logger('TaskManager');
    this.browserManager = browserManager;
    this.databaseService = databaseService;
    this.tasksDirectory = tasksDirectory || path.join(process.cwd(), 'data', 'tasks');
    this.initializeTasksDirectory();
  }

  /**
   * 启动任务管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Task manager is already running');
      return;
    }

    this.isRunning = true;
    await this.loadLocalTasks();
    this.logger.info('Task manager started');
    this.emit('manager:started');
  }

  /**
   * 停止任务管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Task manager is not running');
      return;
    }

    // 停止所有正在执行的任务
    const runningExecutions = Array.from(this.executions.values())
      .filter(execution => execution.status === 'running');

    for (const execution of runningExecutions) {
      await this.stopExecution(execution.id);
    }

    this.isRunning = false;
    this.logger.info('Task manager stopped');
    this.emit('manager:stopped');
  }

  /**
   * 上传任务文件
   */
  async uploadTask(request: UploadTaskRequest): Promise<LocalTask> {
    try {
      // 读取文件内容
      let fileContent: string | Buffer;
      if (request.file instanceof Uint8Array) {
        // 如果是Uint8Array，转换为Buffer
        fileContent = Buffer.from(request.file);
      } else if (request.file instanceof Buffer) {
        // 如果是Buffer，直接使用
        fileContent = request.file;
      } else {
        // 如果是其他类型，尝试转换
        const arrayBuffer = await (request.file as any).arrayBuffer();
        fileContent = Buffer.from(arrayBuffer);
      }
      
      // 解析任务文件
      const taskFile = await this.parseTaskFile(fileContent, request.filename);
      
      // 验证任务文件
      this.validateTaskFile(taskFile);
      
      // 保存任务到数据库
      const localTask = await this.databaseService.saveTask(taskFile);
      
      this.localTasks.set(localTask.id, localTask);
      
      this.logger.info(`Task uploaded: ${taskFile.metadata.name} (${localTask.id})`);
      this.emit('task:uploaded', localTask);
      
      return localTask;
    } catch (error) {
      this.logger.error('Failed to upload task:', error);
      throw error;
    }
  }

  /**
   * 从远程URL导入任务
   */
  async importTask(request: ImportTaskRequest): Promise<LocalTask> {
    try {
      // 下载任务文件
      const response = await fetch(request.url);
      if (!response.ok) {
        throw new Error(`Failed to download task: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const filename = path.basename(new URL(request.url).pathname) || 'imported-task.js';
      
      return await this.uploadTask({
        file: Buffer.from(buffer),
        filename
      });
    } catch (error) {
      this.logger.error('Failed to import task:', error);
      throw error;
    }
  }

  /**
   * 获取本地任务列表
   */
  async getTasks(request?: GetTasksRequest): Promise<LocalTask[]> {
    let tasks = await this.databaseService.getTasks();

    if (request) {
      // 筛选条件
      if (request.category) {
        tasks = tasks.filter(task => task.metadata.category === request.category);
      }
      
      if (request.tags && request.tags.length > 0) {
        tasks = tasks.filter(task => 
          request.tags!.some(tag => task.metadata.tags.includes(tag))
        );
      }
      
      if (request.search) {
        const searchTerm = request.search.toLowerCase();
        tasks = tasks.filter(task =>
          task.metadata.name.toLowerCase().includes(searchTerm) ||
          task.metadata.description.toLowerCase().includes(searchTerm)
        );
      }
      
      if (request.status) {
        tasks = tasks.filter(task => task.status === request.status);
      }
      
      // 分页
      if (request.offset !== undefined) {
        tasks = tasks.slice(request.offset);
      }
      
      if (request.limit !== undefined) {
        tasks = tasks.slice(0, request.limit);
      }
    }

    return tasks;
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: string): Promise<LocalTask | null> {
    return await this.databaseService.getTask(taskId);
  }

  /**
   * 获取任务文件内容
   */
  async getTaskFile(taskId: string): Promise<TaskFile | null> {
    return await this.databaseService.getTaskFile(taskId);
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.databaseService.deleteTask(taskId);
      this.localTasks.delete(taskId);
      
      this.logger.info(`Task deleted: ${taskId}`);
      this.emit('task:deleted', taskId);
    } catch (error) {
      this.logger.error(`Failed to delete task: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 执行任务
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecution> {
    const task = this.localTasks.get(request.taskId);
    if (!task) {
      throw new Error(`Task not found: ${request.taskId}`);
    }

    if (!this.isRunning) {
      throw new Error('Task manager is not running');
    }

    const executionId = uuidv4();
    const now = new Date();

    const execution: TaskExecution = {
      id: executionId,
      taskId: request.taskId,
      browserId: request.browserId,
      status: 'pending',
      parameters: request.parameters,
      startTime: now,
      logs: []
    };

    this.executions.set(executionId, execution);
    this.logger.info(`Created execution: ${executionId} for task: ${request.taskId}`);
    this.emit('execution:created', execution);

    // 异步执行任务
    this.performExecution(execution, task, request.debug || false)
      .catch(error => {
        this.logger.error(`Execution failed: ${executionId}`, error);
      });

    return execution;
  }

  /**
   * 停止任务执行
   */
  async stopExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'running') {
      this.logger.warn(`Execution ${executionId} is not running (status: ${execution.status})`);
      return;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();

    this.logger.info(`Stopped execution: ${executionId}`);
    this.emit('execution:stopped', execution);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<TaskExecution | null> {
    const execution = this.executions.get(executionId);
    if (!execution) return null;
    // 简单的JSON序列化来清理对象
    return JSON.parse(JSON.stringify(execution));
  }

  /**
   * 获取任务的执行历史
   */
  async getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
    const executions = await this.databaseService.getTaskExecutions(taskId);
    // 简单的JSON序列化来清理对象
    return JSON.parse(JSON.stringify(executions));
  }

  /**
   * 获取所有执行记录
   */
  async getAllExecutions(): Promise<TaskExecution[]> {
    const executions = await this.databaseService.getAllTaskExecutions();
    // 简单的JSON序列化来清理对象
    return JSON.parse(JSON.stringify(executions));
  }

  /**
   * 获取任务统计
   */
  async getTaskStats(taskId: string): Promise<TaskStats> {
    const executions = await this.getTaskExecutions(taskId);
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    
    const completedExecutions = executions.filter(e => e.endTime);
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = e.endTime!.getTime() - e.startTime.getTime();
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    const lastExecution = executions.length > 0 ? executions[0].startTime : undefined;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      lastExecutionTime: lastExecution
    };
  }

  /**
   * 初始化任务目录
   */
  private async initializeTasksDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tasksDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create tasks directory:', error);
      throw error;
    }
  }

  /**
   * 加载本地任务
   */
  private async loadLocalTasks(): Promise<void> {
    try {
      const tasks = await this.databaseService.getTasks();
      
      // 将任务加载到内存中以便快速访问
      this.localTasks.clear();
      for (const task of tasks) {
        this.localTasks.set(task.id, task);
      }

      this.logger.info(`Loaded ${this.localTasks.size} tasks from database`);
    } catch (error) {
      this.logger.error('Failed to load local tasks:', error);
    }
  }

  /**
   * 解析任务文件
   */
  private async parseTaskFile(content: string | Buffer, filename?: string): Promise<TaskFile> {
    try {
      let contentStr: string;
      if (content instanceof Buffer) {
        contentStr = content.toString('utf-8');
      } else {
        contentStr = content as string;
      }
      
      // 根据文件扩展名判断格式
      const fileExt = filename ? path.extname(filename).toLowerCase() : '';
      
      // 尝试解析为YAML
      if (fileExt === '.yaml' || fileExt === '.yml') {
        return await this.parseYAMLTaskFile(contentStr);
      }
      
      // 尝试解析为JSON
      if (fileExt === '.json' || contentStr.trim().startsWith('{')) {
        return JSON.parse(contentStr);
      }
      
      // 尝试解析为JavaScript模块（带JSDoc注释）
      if (fileExt === '.js' || (contentStr.includes('@metadata') && contentStr.includes('@parameters'))) {
        return this.parseJSTaskFile(contentStr);
      }
      
      // 尝试解析为纯JavaScript模块
      if (contentStr.includes('module.exports') || contentStr.includes('export')) {
        throw new Error('Pure JavaScript task files require metadata in JSDoc format');
      }
      
      throw new Error('Unsupported task file format');
    } catch (error) {
      throw new Error(`Invalid task file format: ${error}`);
    }
  }

  /**
   * 解析YAML任务文件
   */
  private async parseYAMLTaskFile(content: string): Promise<TaskFile> {
    try {
      const yamlData = yaml.load(content) as any;
      
      if (!yamlData.metadata || !yamlData.parameters) {
        throw new Error('Missing required metadata or parameters in YAML file');
      }
      
      // 如果有codeFile字段，加载外部代码文件
      if (yamlData.codeFile) {
        try {
          // 构建代码文件的完整路径
          const codeFilePath = path.resolve(process.cwd(), yamlData.codeFile);
          const codeContent = await fs.readFile(codeFilePath, 'utf-8');
          
          return {
            metadata: yamlData.metadata,
            parameters: yamlData.parameters,
            code: codeContent,
            examples: yamlData.examples || []
          };
        } catch (error) {
          this.logger.warn(`Failed to load external code file: ${yamlData.codeFile}`, error);
          // 如果加载失败，返回错误信息
          return {
            metadata: yamlData.metadata,
            parameters: yamlData.parameters,
            code: `throw new Error('Failed to load external code file: ${yamlData.codeFile}');`,
            examples: yamlData.examples || []
          };
        }
      }
      
      // 如果有code字段，直接使用
      if (yamlData.code) {
        return {
          metadata: yamlData.metadata,
          parameters: yamlData.parameters,
          code: yamlData.code,
          examples: yamlData.examples || []
        };
      }
      
      throw new Error('YAML task file must contain either code or codeFile field');
    } catch (error) {
      throw new Error(`Failed to parse YAML task file: ${error}`);
    }
  }

  /**
   * 解析JavaScript任务文件（带JSDoc注释）
   */
  private parseJSTaskFile(content: string): TaskFile {
    try {
      // 提取JSDoc注释中的元数据
      const metadataMatch = content.match(/@metadata\s*\{([\s\S]*?)\}/);
      const parametersMatch = content.match(/@parameters\s*\[([\s\S]*?)\]/);
      const examplesMatch = content.match(/@examples\s*\[([\s\S]*?)\]/);
      
      if (!metadataMatch || !parametersMatch) {
        throw new Error('Missing required @metadata or @parameters in JSDoc');
      }
      
      // 解析元数据
      const metadata = this.parseJSDocObject(metadataMatch[1]);
      
      // 解析参数
      const parameters = this.parseJSDocArray(parametersMatch[1]);
      
      // 解析示例（可选）
      const examples = examplesMatch ? this.parseJSDocArray(examplesMatch[1]) : [];
      
      // 提取代码部分（移除JSDoc注释块和module.exports）
      const codeMatch = content.match(/\/\*\*[\s\S]*?\*\//);
      let code = codeMatch ? content.replace(codeMatch[0], '').trim() : content;
      
      // 移除 module.exports 行
      code = code.replace(/\/\/.*导出.*\n.*module\.exports.*=.*execute.*;?\s*$/, '').trim();
      
      return {
        metadata,
        parameters,
        code,
        examples
      };
    } catch (error) {
      throw new Error(`Failed to parse JavaScript task file: ${error}`);
    }
  }

  /**
   * 解析JSDoc对象
   */
  private parseJSDocObject(objStr: string): any {
    try {
      // 简单的对象解析（实际项目中应该使用更robust的解析器）
      const cleanStr = objStr.replace(/^\s*\*\s*/gm, '').trim();
      return Function(`"use strict"; return (${cleanStr})`)();
    } catch (error) {
      throw new Error(`Invalid JSDoc object format: ${error}`);
    }
  }

  /**
   * 解析JSDoc数组
   */
  private parseJSDocArray(arrStr: string): any[] {
    try {
      const cleanStr = arrStr.replace(/^\s*\*\s*/gm, '').trim();
      return Function(`"use strict"; return [${cleanStr}]`)();
    } catch (error) {
      throw new Error(`Invalid JSDoc array format: ${error}`);
    }
  }

  /**
   * 验证任务文件
   */
  private validateTaskFile(taskFile: TaskFile): void {
    if (!taskFile.metadata || !taskFile.metadata.id || !taskFile.metadata.name) {
      throw new Error('Invalid task metadata');
    }
    
    if (!taskFile.code || typeof taskFile.code !== 'string') {
      throw new Error('Invalid task code');
    }
    
    if (!Array.isArray(taskFile.parameters)) {
      throw new Error('Invalid task parameters');
    }
  }

  /**
   * 执行任务的核心逻辑
   */
  private async performExecution(
    execution: TaskExecution,
    task: LocalTask,
    debug: boolean
  ): Promise<void> {
    try {
      execution.status = 'running';
      this.emit('execution:started', execution);

      // 获取浏览器实例
      const browser = this.browserManager.getBrowser(execution.browserId);
      if (!browser) {
        throw new Error(`Browser not found: ${execution.browserId}`);
      }

      // 如果浏览器未运行，启动它
      if (browser.status !== 'running') {
        await this.browserManager.openBrowser(execution.browserId);
      }

      // 获取页面实例
      const page = await this.getPageFromBrowser(execution.browserId);
      if (!page) {
        throw new Error(`Failed to get page from browser: ${execution.browserId}`);
      }

      // 读取任务文件
      const taskFile = await this.getTaskFile(task.id);
      if (!taskFile) {
        throw new Error(`Failed to load task file: ${task.id}`);
      }

      // 创建任务执行上下文
      const context = this.createExecutionContext(execution, browser, page);

      // 执行任务代码
      await this.executeTaskCode(taskFile.code, context);

      // 执行完成
      execution.status = 'completed';
      execution.endTime = new Date();
      
      // 保存执行记录到数据库
      await this.databaseService.saveTaskExecution(execution);
      
      // 更新使用统计
      await this.databaseService.updateTaskUsage(task.id);
      
      this.logger.info(`Execution completed: ${execution.id}`);
      this.emit('execution:completed', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : String(error);
      
      // 保存失败的执行记录到数据库
      await this.databaseService.saveTaskExecution(execution);
      
      this.logger.error(`Execution failed: ${execution.id}`, error);
      this.emit('execution:failed', execution);
    }
  }

  /**
   * 从浏览器获取页面实例
   */
  private async getPageFromBrowser(browserId: string): Promise<any> {
    const platform = this.browserManager.getPlatform('local');
    if (!platform) {
      throw new Error('Local browser platform not available');
    }

    const page = await (platform as any).getMainPage(browserId);
    if (!page) {
      throw new Error(`Failed to get page from browser: ${browserId}`);
    }

    return page;
  }

  /**
   * 创建任务执行上下文
   */
  private createExecutionContext(
    execution: TaskExecution,
    browser: any,
    page: any
  ): TaskExecutionContext {
    return {
      browser,
      page,
      parameters: execution.parameters,
      log: (level, message) => {
        execution.logs.push({
          level,
          message,
          timestamp: new Date()
        });
        this.logger[level](`[${execution.id}] ${message}`);
      },
      progress: (current, total, message) => {
        execution.progress = { current, total, message };
        this.emit('execution:progress', execution);
      },
      utils: {
        wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        waitForSelector: (selector, timeout = 30000) => page.waitForSelector(selector, { timeout }),
        click: (selector) => page.click(selector),
        type: (selector, text) => page.type(selector, text),
        screenshot: (filename) => this.takeScreenshot(page, filename),
        extractText: (selector) => page.$eval(selector, (el: any) => el.textContent?.trim()),
        extractAttribute: (selector, attribute) => page.$eval(selector, (el: any, attr: string) => el.getAttribute(attr), attribute)
      }
    };
  }

  /**
   * 执行任务代码
   */
  private async executeTaskCode(code: string, context: TaskExecutionContext): Promise<any> {
    // 调试：打印实际的代码内容
    this.logger.info(`Executing code: ${code.substring(0, 50)}...`);
    
    // 清理代码：移除 module.exports 行
    const cleanedCode = code.replace(/\/\/.*导出.*\n.*module\.exports.*=.*execute.*;?\s*$/, '').trim();
    
    // 将所有上下文变量提取到全局作用域
    const { browser, page, parameters, log, progress, utils } = context;
    
    // 创建执行函数，并将上下文变量传入
    const taskFunction = new Function(
      'browser', 'page', 'parameters', 'log', 'progress', 'utils',
      `
        ${cleanedCode}
        return execute();
      `
    );
    
    return await taskFunction(browser, page, parameters, log, progress, utils);
  }

  /**
   * 截图
   */
  private async takeScreenshot(page: any, filename?: string): Promise<string> {
    const screenshotPath = filename || `screenshot_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    return screenshotPath;
  }

  /**
   * 获取管理器状态
   */
  getStatus(): { 
    isRunning: boolean; 
    totalTasks: number; 
    activeTasks: number; 
    activeExecutions: number;
  } {
    const activeExecutions = Array.from(this.executions.values())
      .filter(execution => execution.status === 'running').length;

    const activeTasks = Array.from(this.localTasks.values())
      .filter(task => task.status === 'active').length;

    return {
      isRunning: this.isRunning,
      totalTasks: this.localTasks.size,
      activeTasks,
      activeExecutions
    };
  }
}