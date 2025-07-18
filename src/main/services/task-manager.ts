import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../utils/logger';
import { CleanupHelper } from '../utils/cleanup-helper';
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
  GetTasksRequest,
  TaskDependencyCheck,
  InstallDependencyRequest,
  InstallDependencyResult
} from '../types/task';
import { ValidationResult } from '../types/validation';
import { TaskErrorHandler } from './task-error-handler';
import { TaskFixer } from './task-fixer';
import { TaskValidator } from './task-validator';
import { BrowserManager } from './browser-manager';
import { DatabaseService } from '../database/database-service';
import { DependencyManager } from './dependency-manager';
import { MetadataCacheManager } from './metadata-cache-manager';

/**
 * 任务管理器 - 管理任务文件的导入、解析、执行
 */
export class TaskManager extends EventEmitter {
  private logger: Logger;
  private browserManager: BrowserManager;
  private databaseService: DatabaseService;
  private dependencyManager: DependencyManager;
  private metadataCache: MetadataCacheManager;
  private errorHandler: TaskErrorHandler;
  private cleanupHelper: CleanupHelper;
  private taskFixer: TaskFixer;
  private taskValidator: TaskValidator;
  private tasksDirectory: string;
  private localTasks: Map<string, LocalTask> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private isRunning: boolean = false;

  constructor(browserManager: BrowserManager, databaseService: DatabaseService, tasksDirectory?: string) {
    super();
    this.logger = new Logger('TaskManager');
    this.browserManager = browserManager;
    this.databaseService = databaseService;
    this.dependencyManager = new DependencyManager();
    this.metadataCache = new MetadataCacheManager();
    this.errorHandler = new TaskErrorHandler();
    this.cleanupHelper = new CleanupHelper();
    this.taskFixer = new TaskFixer();
    this.taskValidator = new TaskValidator();
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

    // Initialize the metadata cache manager
    await this.metadataCache.initialize();
    
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
    // 创建临时文件路径，用于在出错时清理
    let tempFilePath: string | null = null;
    
    try {
      this.logger.info(`Starting task upload${request.filename ? ` for file: ${request.filename}` : ''}`);
      
      // 读取文件内容
      let fileContent: string | Buffer;
      try {
        if (request.file instanceof Uint8Array) {
          // 如果是Uint8Array，转换为Buffer
          fileContent = Buffer.from(request.file);
          this.logger.debug('Converted Uint8Array to Buffer');
        } else if (request.file instanceof Buffer) {
          // 如果是Buffer，直接使用
          fileContent = request.file;
          this.logger.debug('Using Buffer directly');
        } else {
          // 如果是其他类型，尝试转换
          this.logger.debug(`Converting file of type: ${typeof request.file}`);
          const arrayBuffer = await (request.file as any).arrayBuffer();
          fileContent = Buffer.from(arrayBuffer);
          this.logger.debug('Converted to Buffer via arrayBuffer');
        }
        
        // 保存文件内容到临时文件，以便在出错时进行分析
        const extension = request.filename ? path.extname(request.filename) : '.js';
        tempFilePath = await this.cleanupHelper.createTempFile(fileContent, extension);
      } catch (fileError) {
        this.logger.error('Failed to read file content:', fileError);
        throw new Error(`Failed to read file content: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
      }
      
      // 解析任务文件
      this.logger.debug('Parsing task file...');
      let taskFile: TaskFile;
      try {
        taskFile = await this.parseTaskFile(fileContent, request.filename);
        this.logger.info(`Successfully parsed task file: ${taskFile.metadata.name}`);
      } catch (parseError) {
        this.logger.error('Task file parsing failed:', parseError);
        
        // 尝试恢复解析错误
        this.logger.debug('Attempting to recover from parsing error...');
        
        // 如果是纯JavaScript文件，尝试添加最小元数据
        if (typeof fileContent === 'string' || fileContent instanceof Buffer) {
          const recoveryContentStr: string = fileContent instanceof Buffer ? fileContent.toString('utf-8') : (fileContent as unknown as string);
          
          if (recoveryContentStr.includes('function execute(') || 
              recoveryContentStr.includes('execute = function(') || 
              recoveryContentStr.includes('execute=function(')) {
            
            this.logger.info('Found execute function, attempting to create minimal task file');
            
            // 提取可能的任务名称
            let taskName = 'Unnamed Task';
            const nameMatch = recoveryContentStr.match(/\/\/\s*([^\/\n]+)/);
            if (nameMatch) {
              taskName = nameMatch[1].trim();
            }
            
            // 创建最小元数据
            taskFile = {
              metadata: {
                id: `task_${Date.now()}`,
                name: taskName,
                description: 'Auto-generated metadata',
                version: '1.0.0',
                author: 'System',
                category: 'general',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              parameters: [],
              code: recoveryContentStr,
              examples: []
            };
            
            this.logger.info('Created minimal task file with auto-generated metadata');
          } else {
            throw parseError; // 无法恢复，抛出原始错误
          }
        } else {
          throw parseError; // 无法恢复，抛出原始错误
        }
      }
      
      // 验证任务文件（使用宽松的验证规则）
      this.logger.debug('Validating task file...');
      try {
        const validationResult = this.taskValidator.validateTaskFile(taskFile);
        
        if (validationResult.valid) {
          this.logger.info('Task file validation successful');
        } else {
          this.logger.warn(`Task file validation completed with ${validationResult.errors.length} errors and ${validationResult.warnings.length} warnings`);
          
          // 只有在有严重错误时才尝试修复
          if (validationResult.errors.length > 0) {
            this.logger.info('Attempting to fix task file issues...');
            const fixResult = this.taskFixer.fixTaskFile(taskFile);
            
            if (fixResult.fixed) {
              this.logger.info(`Successfully fixed ${fixResult.appliedFixes.length} issues in task file`);
              this.logger.debug(`Applied fixes: ${fixResult.appliedFixes.join(', ')}`);
              
              // 使用修复后的任务文件
              taskFile = fixResult.taskFile;
              
              // 重新验证修复后的任务文件
              const revalidationResult = this.taskValidator.validateTaskFile(taskFile);
              if (revalidationResult.valid) {
                this.logger.info('Validation successful after fixes');
              } else if (revalidationResult.errors.length > 0) {
                this.logger.error('Validation still failed after fixes');
                // 继续处理，但记录错误
              }
            } else {
              this.logger.warn('Could not fix task file issues automatically, continuing with warnings');
              // 继续处理，不阻止任务上传
            }
          }
        }
      } catch (validationError) {
        this.logger.error('Task file validation encountered an error:', validationError);
        // 继续处理，不阻止任务上传
      }
      
      // 检查任务依赖
      let dependencyStatus: TaskDependencyCheck | undefined;
      let securityReport: string | undefined;
      
      if (taskFile.metadata.dependencies && taskFile.metadata.dependencies.length > 0) {
        this.logger.debug(`Checking dependencies for task: ${taskFile.metadata.name}`);
        try {
          // 基本依赖检查
          dependencyStatus = await this.dependencyManager.checkDependencies(
            taskFile.metadata.id,
            taskFile.metadata.dependencies
          );
          
          this.logger.info(`Dependency check for task ${taskFile.metadata.name}: satisfied=${dependencyStatus.satisfied}, missing=${dependencyStatus.missingDependencies.length}`);
          
          if (!dependencyStatus.satisfied) {
            this.logger.warn(`Missing dependencies: ${dependencyStatus.missingDependencies.map(d => d.name).join(', ')}`);
          }
          
          // 安全检查
          this.logger.debug('Performing security check on dependencies');
          const securityCheck = await this.dependencyManager.checkDependencySecurity(taskFile.metadata.dependencies);
          
          if (!securityCheck.safe) {
            this.logger.warn(`Security issues found in dependencies: ${securityCheck.vulnerabilities.length} vulnerabilities`);
            securityCheck.vulnerabilities.forEach(vuln => {
              this.logger.warn(`Security vulnerability in ${vuln.dependency}: ${vuln.description} (${vuln.severity})`);
            });
          }
          
          if (securityCheck.warnings.length > 0) {
            this.logger.warn(`Security warnings: ${securityCheck.warnings.length}`);
            securityCheck.warnings.forEach(warning => {
              this.logger.warn(`Security warning: ${warning}`);
            });
          }
          
          // 生成安全报告
          securityReport = await this.dependencyManager.generateSecurityReport(
            taskFile.metadata.id,
            taskFile.metadata.dependencies
          );
          
          this.logger.info(`Security check completed for task ${taskFile.metadata.name}: safe=${securityCheck.safe}`);
          
        } catch (dependencyError) {
          this.logger.error('Dependency check failed:', dependencyError);
          // 继续处理，不阻止任务上传
        }
      } else {
        this.logger.debug('No dependencies specified for this task');
      }
      
      // 保存任务到数据库
      this.logger.debug('Saving task to database...');
      let localTask: LocalTask;
      try {
        localTask = await this.databaseService.saveTask(taskFile);
        this.logger.info(`Task saved to database with ID: ${localTask.id}`);
      } catch (dbError) {
        this.logger.error('Failed to save task to database:', dbError);
        throw new Error(`Failed to save task to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      }
      
      // 更新依赖状态
      if (dependencyStatus) {
        localTask.dependencyStatus = dependencyStatus;
      }
      
      // 更新内存缓存
      this.localTasks.set(localTask.id, localTask);
      this.logger.debug(`Added task to in-memory cache: ${localTask.id}`);
      
      // 缓存任务元数据
      try {
        this.metadataCache.cacheTaskMetadata(localTask);
        this.logger.debug(`Cached metadata for task: ${localTask.id}`);
      } catch (cacheError) {
        this.logger.warn('Failed to cache task metadata:', cacheError);
        // 继续处理，不阻止任务上传
      }
      
      this.logger.info(`Task upload completed: ${taskFile.metadata.name} (${localTask.id})`);
      this.emit('task:uploaded', localTask);
      
      return localTask;
    } catch (error) {
      this.logger.error('Failed to upload task:', error);
      
      // 清理临时资源
      try {
        await this.cleanupHelper.cleanup();
        this.logger.info('Cleaned up temporary resources after error');
      } catch (cleanupError) {
        this.logger.warn('Failed to clean up temporary resources:', cleanupError);
      }
      
      // 创建更友好的错误消息
      const errorMessage = error instanceof Error ? error.message : String(error);
      const enhancedError = new Error(`Task upload failed: ${errorMessage}`);
      
      // 保留原始错误的堆栈跟踪
      if (error instanceof Error) {
        enhancedError.stack = error.stack;
      }
      
      throw enhancedError;
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
      
      // Remove task metadata from cache
      this.metadataCache.removeCachedMetadata(taskId);
      
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

    // 检查任务依赖
    if (task.metadata.dependencies && task.metadata.dependencies.length > 0) {
      const dependencyCheck = await this.dependencyManager.checkDependencies(
        task.metadata.id,
        task.metadata.dependencies
      );
      
      if (!dependencyCheck.satisfied) {
        this.logger.warn(`Task dependencies not satisfied for task: ${task.metadata.name}`);
        this.logger.info(`Missing dependencies: ${dependencyCheck.missingDependencies.map(d => d.name).join(', ')}`);
        
        // 尝试自动安装缺失的依赖
        try {
          this.logger.info('Attempting to auto-install missing dependencies...');
          
          // 转换依赖格式
          const taskDependencies = task.metadata.dependencies.map((dep: any) => {
            // 如果依赖已经是对象格式，直接使用
            if (typeof dep === 'object' && dep.name) {
              return dep;
            }
            // 如果是字符串格式，解析为对象
            const depStr = typeof dep === 'string' ? dep : String(dep);
            const [name, version = 'latest'] = depStr.split('@');
            return {
              name,
              version,
              type: 'npm' as const,
              optional: false
            };
          });

          const installRequest = {
            taskId: task.metadata.id,
            dependencies: taskDependencies,
            force: false
          };
          
          const installResult = await this.dependencyManager.installDependencies(installRequest);
          
          if (installResult.success) {
            this.logger.info(`Successfully installed dependencies for task: ${task.metadata.name}`);
            
            // 重新检查依赖状态
            const recheckResult = await this.dependencyManager.checkDependencies(
              task.metadata.id,
              task.metadata.dependencies
            );
            
            if (!recheckResult.satisfied) {
              throw new Error(
                `Task dependencies could not be satisfied after installation. Missing: ${recheckResult.missingDependencies.map(d => d.name).join(', ')}`
              );
            }
          } else {
            const failedDeps = installResult.failed.map(f => f.dependency.name).join(', ');
            throw new Error(
              `Failed to install required dependencies: ${failedDeps}. Please install them manually using the task details page.`
            );
          }
        } catch (installError) {
          this.logger.error('Auto-installation of dependencies failed:', installError);
          throw new Error(
            `Task dependencies not satisfied. Missing: ${dependencyCheck.missingDependencies.map(d => d.name).join(', ')}. ` +
            `Auto-installation failed: ${installError instanceof Error ? installError.message : String(installError)}. ` +
            `Please install dependencies manually using the task details page.`
          );
        }
      }
      
      this.logger.info(`All dependencies satisfied for task: ${task.metadata.name}`);
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
        
        // Cache task metadata for faster access
        this.metadataCache.cacheTaskMetadata(task);
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
    let contentStr: string;
    if (content instanceof Buffer) {
      contentStr = content.toString('utf-8');
    } else {
      contentStr = content as string;
    }
    
    try {
      
      // 根据文件扩展名判断格式
      const fileExt = filename ? path.extname(filename).toLowerCase() : '';
      
      // 尝试解析为YAML
      if (fileExt === '.yaml' || fileExt === '.yml') {
        try {
          return await this.parseYAMLTaskFile(contentStr);
        } catch (yamlError) {
          this.logger.warn(`Failed to parse as YAML, trying other formats: ${yamlError}`);
          // 如果YAML解析失败，继续尝试其他格式
        }
      }
      
      // 尝试解析为JSON
      if (fileExt === '.json' || contentStr.trim().startsWith('{')) {
        try {
          const jsonData = JSON.parse(contentStr);
          
          // 验证JSON格式是否符合任务文件要求
          if (jsonData.metadata && jsonData.parameters) {
            return jsonData;
          } else {
            this.logger.warn('JSON file does not contain required metadata and parameters');
            // 继续尝试其他格式
          }
        } catch (jsonError) {
          this.logger.warn(`Failed to parse as JSON, trying other formats: ${jsonError}`);
          // 如果JSON解析失败，继续尝试其他格式
        }
      }
      
      // 尝试解析为JavaScript模块（带JSDoc注释）
      if (fileExt === '.js' || contentStr.includes('@metadata') || contentStr.includes('/**')) {
        try {
          return this.parseJSTaskFile(contentStr);
        } catch (jsError) {
          this.logger.error(`Failed to parse as JavaScript task file: ${jsError}`);
          
          // 提供更详细的错误信息
          if (contentStr.includes('@metadata')) {
            throw new Error(`JavaScript task file has @metadata tag but could not be parsed: ${jsError}`);
          } else if (contentStr.includes('/**')) {
            throw new Error(`JavaScript task file has JSDoc comments but is missing required @metadata tag`);
          } else {
            throw new Error(`Failed to parse JavaScript task file: ${jsError}`);
          }
        }
      }
      
      // 尝试解析为纯JavaScript模块
      if (contentStr.includes('module.exports') || contentStr.includes('export')) {
        // 检查是否有execute函数
        if (contentStr.includes('function execute(') || contentStr.includes('execute = function(') || contentStr.includes('execute=function(')) {
          this.logger.warn('Found execute function but no JSDoc metadata. Adding minimal metadata.');
          
          // 提取可能的任务名称
          let taskName = 'Unnamed Task';
          const nameMatch = contentStr.match(/\/\/\s*([^\/\n]+)/);
          if (nameMatch) {
            taskName = nameMatch[1].trim();
          }
          
          // 创建最小元数据
          const minimalTaskFile: TaskFile = {
            metadata: {
              id: `task_${Date.now()}`,
              name: taskName,
              description: 'Auto-generated metadata',
              version: '1.0.0',
              author: 'System',
              category: 'general',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            parameters: [],
            code: contentStr,
            examples: []
          };
          
          this.logger.info('Created minimal metadata for JavaScript task file');
          return minimalTaskFile;
        } else {
          throw new Error('Pure JavaScript task files require metadata in JSDoc format and an execute function');
        }
      }
      
      // 如果所有尝试都失败，提供详细的错误信息
      this.logger.error('Could not determine task file format');
      
      // 检查常见问题
      if (contentStr.length < 10) {
        throw new Error('Task file is too short or empty');
      } else if (!contentStr.includes('function')) {
        throw new Error('Task file does not contain any functions');
      } else {
        throw new Error('Unsupported task file format. Please ensure it contains proper JSDoc metadata and parameters');
      }
    } catch (error) {
      // 使用增强的错误处理方法
      const errorObj = error instanceof Error ? error : new Error(String(error));
      throw this.handleParsingError(errorObj, contentStr, filename);
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
      // 提取所有JSDoc注释块
      const jsdocBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
      
      if (jsdocBlocks.length === 0) {
        throw new Error('No JSDoc comment blocks found in the file');
      }
      
      // 查找包含任务元数据的JSDoc块（支持@name, @description等标准JSDoc标签）
      let metadataBlock = null;
      for (const block of jsdocBlocks) {
        if (block.includes('@name') || block.includes('@description') || block.includes('@metadata')) {
          metadataBlock = block;
          break;
        }
      }
      
      if (!metadataBlock) {
        throw new Error('Missing required JSDoc metadata tags (@name, @description, etc.)');
      }
      
      // 解析标准JSDoc标签格式的元数据
      let metadata;
      try {
        metadata = this.parseStandardJSDocTags(metadataBlock);
        
        // 确保必要的元数据字段存在
        if (!metadata.id) {
          this.logger.info('Generating ID for task');
          metadata.id = `task_${Date.now()}`;
        }
        
        if (!metadata.createdAt) {
          metadata.createdAt = new Date().toISOString();
        }
        
        if (!metadata.updatedAt) {
          metadata.updatedAt = new Date().toISOString();
        }
        
        if (!metadata.tags) {
          metadata.tags = [];
        } else if (typeof metadata.tags === 'string') {
          // 如果tags是字符串，按逗号分割
          metadata.tags = metadata.tags.split(',').map((tag: string) => tag.trim());
        }
      } catch (metadataError) {
        this.logger.error('Failed to parse metadata:', metadataError);
        throw new Error(`Invalid metadata format: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
      }
      
      // 从代码中提取parameters、dependencies、config等
      let parameters = [];
      let dependencies = [];
      let config = {};
      
      try {
        // 提取parameters数组 - 直接使用简单的方法
        const parametersMatch = content.match(/const\s+parameters\s*=\s*(\[[\s\S]*?\]);/);
        if (parametersMatch) {
          this.logger.debug('Found parameters definition, using simple extraction method');
          parameters = this.extractParametersSimple(content);
          this.logger.debug(`Simple extraction result: ${parameters.length} parameters found`);
          
          if (parameters.length === 0) {
            this.logger.debug('Trying evaluateJSExpression as fallback');
            try {
              const fallbackParams = this.evaluateJSExpression(parametersMatch[1]);
              if (Array.isArray(fallbackParams) && fallbackParams.length > 0) {
                parameters = fallbackParams;
              }
            } catch (paramError) {
              this.logger.warn('Fallback also failed:', paramError);
            }
          }
        }
        
        // 提取dependencies数组
        const dependenciesMatch = content.match(/const\s+dependencies\s*=\s*(\[[\s\S]*?\]);/);
        if (dependenciesMatch) {
          const depArray = this.evaluateJSExpression(dependenciesMatch[1]);
          // 转换字符串格式的依赖为对象格式
          dependencies = depArray.map((dep: string | any) => {
            if (typeof dep === 'string') {
              const [name, version] = dep.split('@');
              return {
                name: name,
                version: version || 'latest',
                type: 'npm'
              };
            }
            return dep;
          });
        }
        
        // 提取config对象
        const configMatch = content.match(/const\s+config\s*=\s*(\{[\s\S]*?\});/);
        if (configMatch) {
          config = this.evaluateJSExpression(configMatch[1]);
        }
      } catch (extractError) {
        this.logger.warn('Failed to extract parameters/dependencies/config from code:', extractError);
        // 继续处理，使用默认值
      }
      
      // 更新元数据中的依赖信息
      if (dependencies.length > 0) {
        metadata.dependencies = dependencies;
      }
      
      // 提取代码部分（移除所有JSDoc注释块）
      let code = content;
      for (const block of jsdocBlocks) {
        code = code.replace(block, '');
      }
      code = code.trim();
      
      // 移除可能的 module.exports 行，更宽容的匹配
      code = code.replace(/^\s*(?:\/\/.*)?(?:module\.exports|exports)\s*=\s*.*?;?\s*$/gm, '').trim();
      
      // 检查是否有execute函数
      if (!code.includes('function execute(') && !code.includes('execute = function(') && !code.includes('execute=function(')) {
        this.logger.warn('No execute function found in the task file');
      }
      
      return {
        metadata,
        parameters,
        code,
        examples: []
      };
    } catch (error) {
      this.logger.error('JSTask parsing error:', error);
      throw new Error(`Failed to parse JavaScript task file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解析标准JSDoc标签
   */
  private parseStandardJSDocTags(jsdocBlock: string): any {
    const metadata: any = {};
    
    // 提取各种JSDoc标签
    const tagMatches = {
      name: jsdocBlock.match(/@name\s+(.+)/),
      description: jsdocBlock.match(/@description\s+([\s\S]*?)(?=@|$|\*\/)/),
      version: jsdocBlock.match(/@version\s+(.+)/),
      author: jsdocBlock.match(/@author\s+(.+)/),
      category: jsdocBlock.match(/@category\s+(.+)/),
      tags: jsdocBlock.match(/@tags\s+(.+)/),
      icon: jsdocBlock.match(/@icon\s+(.+)/)
    };
    
    // 处理每个标签
    if (tagMatches.name) {
      metadata.name = tagMatches.name[1].trim();
    }
    
    if (tagMatches.description) {
      metadata.description = tagMatches.description[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line.length > 0)
        .join(' ')
        .trim();
    }
    
    if (tagMatches.version) {
      metadata.version = tagMatches.version[1].trim();
    }
    
    if (tagMatches.author) {
      metadata.author = tagMatches.author[1].trim();
    }
    
    if (tagMatches.category) {
      metadata.category = tagMatches.category[1].trim();
    }
    
    if (tagMatches.tags) {
      metadata.tags = tagMatches.tags[1].split(',').map(tag => tag.trim());
    }
    
    if (tagMatches.icon) {
      metadata.icon = tagMatches.icon[1].trim();
    }
    
    // 设置默认值
    if (!metadata.name) {
      metadata.name = 'Unnamed Task';
    }
    
    if (!metadata.description) {
      metadata.description = '';
    }
    
    if (!metadata.version) {
      metadata.version = '1.0.0';
    }
    
    if (!metadata.author) {
      metadata.author = 'Unknown';
    }
    
    if (!metadata.category) {
      metadata.category = 'general';
    }
    
    if (!metadata.tags) {
      metadata.tags = [];
    }
    
    return metadata;
  }

  /**
   * 安全地评估JavaScript表达式（仅支持简单的数组和对象字面量）
   */
  private evaluateJSExpression(expression: string): any {
    try {
      // 移除注释
      let cleanExpr = expression.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      
      // 更宽松的安全检查 - 允许基本的数据结构和属性访问
      const unsafePatterns = [
        /\beval\b/,
        /\brequire\b/,
        /\bprocess\b/,
        /\b__dirname\b/,
        /\b__filename\b/,
        /\bsetTimeout\b/,
        /\bsetInterval\b/,
        /\bsetImmediate\b/,
        /\bBuffer\b/,
        /\bglobal\b/,
        /\bwindow\b/,
        /\bdocument\b/
      ];
      
      for (const pattern of unsafePatterns) {
        if (pattern.test(cleanExpr)) {
          throw new Error('Unsafe expression detected');
        }
      }
      
      // 使用Function构造函数来安全地评估表达式
      const func = new Function('return ' + cleanExpr);
      return func();
    } catch (error) {
      this.logger.warn('Failed to evaluate JS expression:', error instanceof Error ? error.message : String(error));
      
      // 尝试使用JSON.parse作为备选方案
      try {
        // 尝试将JavaScript对象字面量转换为JSON格式
        let jsonStr = expression
          .replace(/\/\/.*$/gm, '') // 移除单行注释
          .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
          .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') // 给属性名加引号
          .replace(/:\s*'([^']*)'/g, ': "$1"') // 将单引号转换为双引号
          .replace(/,(\s*[}\]])/g, '$1'); // 移除尾随逗号
        
        return JSON.parse(jsonStr);
      } catch (jsonError) {
        this.logger.warn('JSON parsing also failed:', jsonError instanceof Error ? jsonError.message : String(jsonError));
        
        // 返回空数组或对象作为默认值
        if (expression.trim().startsWith('[')) {
          return [];
        } else if (expression.trim().startsWith('{')) {
          return {};
        }
        return null;
      }
    }
  }

  /**
   * 从模块导出中提取参数（备用方法）
   */
  private extractParametersFromModule(content: string): any[] {
    try {
      // 创建一个临时的模块环境来安全地执行代码
      const moduleExports = {};
      const module = { exports: moduleExports };
      
      // 创建一个安全的执行环境
      const sandbox = {
        module,
        exports: moduleExports,
        console: { log: () => {}, warn: () => {}, error: () => {} },
        require: () => { throw new Error('require not allowed'); }
      };
      
      // 执行代码但不执行execute函数
      const codeWithoutExecute = content.replace(/async\s+function\s+execute\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g, '');
      
      const func = new Function('module', 'exports', 'console', 'require', codeWithoutExecute);
      func(sandbox.module, sandbox.exports, sandbox.console, sandbox.require);
      
      // 从导出中获取参数
      if (sandbox.module.exports && Array.isArray((sandbox.module.exports as any).parameters)) {
        return (sandbox.module.exports as any).parameters;
      }
      
      return [];
    } catch (error) {
      this.logger.warn('Failed to extract parameters from module:', error);
      return [];
    }
  }

  /**
   * 从字符串中提取依赖信息（备用方法）
   */
  private extractDependenciesFromStrings(content: string): any[] {
    try {
      const dependencies = [];
      const depMatches = content.match(/'([^'@]+@[^']+)'/g) || [];
      
      for (const match of depMatches) {
        const depStr = match.replace(/'/g, '');
        const [name, version] = depStr.split('@');
        if (name && version) {
          dependencies.push({
            name: name,
            version: version,
            type: 'npm'
          });
        }
      }
      
      return dependencies;
    } catch (error) {
      this.logger.warn('Failed to extract dependencies from strings:', error);
      return [];
    }
  }

  /**
   * 简单的参数提取方法（使用正则表达式）
   */
  private extractParametersSimple(content: string): any[] {
    try {
      const parameters = [];
      
      // 查找参数数组的开始和结束
      const parametersMatch = content.match(/const\s+parameters\s*=\s*\[([\s\S]*?)\];/);
      if (!parametersMatch) {
        return [];
      }
      
      const parametersContent = parametersMatch[1];
      
      // 使用简单的正则表达式提取每个参数对象
      const paramObjects = parametersContent.split(/},\s*{/).map((obj, index, array) => {
        // 添加缺失的大括号
        if (index === 0 && array.length > 1) {
          obj = obj + '}';
        } else if (index === array.length - 1 && array.length > 1) {
          obj = '{' + obj;
        } else if (array.length > 1) {
          obj = '{' + obj + '}';
        } else {
          // 只有一个对象的情况
          if (!obj.trim().startsWith('{')) obj = '{' + obj;
          if (!obj.trim().endsWith('}')) obj = obj + '}';
        }
        
        return obj;
      });
      
      // 解析每个参数对象
      for (const objStr of paramObjects) {
        try {
          const param: any = {};
          
          // 提取基本字段
          const nameMatch = objStr.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
          const labelMatch = objStr.match(/label\s*:\s*['"`]([^'"`]+)['"`]/);
          const typeMatch = objStr.match(/type\s*:\s*['"`]([^'"`]+)['"`]/);
          const descriptionMatch = objStr.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
          const requiredMatch = objStr.match(/required\s*:\s*(true|false)/);
          const defaultMatch = objStr.match(/default\s*:\s*(['"`]([^'"`]+)['"`]|true|false|\d+)/);
          const placeholderMatch = objStr.match(/placeholder\s*:\s*['"`]([^'"`]+)['"`]/);
          const minMatch = objStr.match(/min\s*:\s*(\d+)/);
          const maxMatch = objStr.match(/max\s*:\s*(\d+)/);
          
          if (nameMatch) param.name = nameMatch[1];
          if (labelMatch) param.label = labelMatch[1];
          if (typeMatch) param.type = typeMatch[1];
          if (descriptionMatch) param.description = descriptionMatch[1];
          if (requiredMatch) param.required = requiredMatch[1] === 'true';
          if (placeholderMatch) param.placeholder = placeholderMatch[1];
          if (minMatch) param.min = parseInt(minMatch[1]);
          if (maxMatch) param.max = parseInt(maxMatch[1]);
          
          if (defaultMatch) {
            const defaultValue = defaultMatch[1];
            if (defaultValue === 'true') param.default = true;
            else if (defaultValue === 'false') param.default = false;
            else if (/^\d+$/.test(defaultValue)) param.default = parseInt(defaultValue);
            else param.default = defaultValue.replace(/['"`]/g, '');
          }
          
          // 提取options数组（如果存在）
          const optionsMatch = objStr.match(/options\s*:\s*\[([\s\S]*?)\]/);
          if (optionsMatch) {
            const optionsContent = optionsMatch[1];
            const options = [];
            
            // 简单解析选项
            const optionObjects = optionsContent.split(/},\s*{/);
            for (let i = 0; i < optionObjects.length; i++) {
              let optionStr = optionObjects[i];
              if (i === 0 && optionObjects.length > 1) optionStr += '}';
              else if (i === optionObjects.length - 1 && optionObjects.length > 1) optionStr = '{' + optionStr;
              else if (optionObjects.length > 1) optionStr = '{' + optionStr + '}';
              else {
                if (!optionStr.trim().startsWith('{')) optionStr = '{' + optionStr;
                if (!optionStr.trim().endsWith('}')) optionStr = optionStr + '}';
              }
              
              const labelMatch = optionStr.match(/label\s*:\s*['"`]([^'"`]+)['"`]/);
              const valueMatch = optionStr.match(/value\s*:\s*['"`]([^'"`]+)['"`]/);
              
              if (labelMatch && valueMatch) {
                options.push({
                  label: labelMatch[1],
                  value: valueMatch[1]
                });
              }
            }
            
            if (options.length > 0) {
              param.options = options;
            }
          }
          
          if (param.name && param.type) {
            parameters.push(param);
          }
        } catch (paramError) {
          this.logger.warn('Failed to parse individual parameter:', paramError);
        }
      }
      
      return parameters;
    } catch (error) {
      this.logger.warn('Failed to extract parameters simply:', error);
      return [];
    }
  }

  /**
   * 解析JSDoc对象
   */
  private parseJSDocObject(objStr: string): any {
    try {
      // 清理JSDoc格式：移除星号和缩进
      let cleanStr = objStr
        .split('\n')
        .map(line => {
          // 移除行首的 * 和空格
          return line.replace(/^\s*\*\s?/, '').trim();
        })
        .filter(line => line.length > 0) // 移除空行
        .join('\n');
      
      // 移除可能的尾随逗号
      cleanStr = cleanStr.replace(/,(\s*[}\]])/g, '$1');
      
      // 确保对象格式正确
      if (!cleanStr.startsWith('{')) {
        cleanStr = `{${cleanStr}`;
      }
      if (!cleanStr.endsWith('}')) {
        cleanStr = `${cleanStr}}`;
      }
      
      this.logger.debug('Parsing JSDoc object:', cleanStr);
      
      // 尝试使用JSON.parse来解析对象
      try {
        return JSON.parse(cleanStr);
      } catch (jsonError) {
        // 如果JSON解析失败，尝试修复常见的JSON格式问题
        
        // 1. 修复没有引号的键名
        let fixedStr = cleanStr.replace(/(\{|\,)\s*([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
        
        // 2. 修复单引号字符串
        fixedStr = fixedStr.replace(/'([^']*?)'/g, '"$1"');
        
        // 3. 修复没有引号的字符串值
        fixedStr = fixedStr.replace(/:\s*([a-zA-Z0-9_$]+)(\s*[,}])/g, ':"$1"$2');
        
        this.logger.debug('Attempting to parse with fixed JSON:', fixedStr);
        return JSON.parse(fixedStr);
      }
    } catch (error) {
      this.logger.error('JSDoc object parsing failed:', error);
      this.logger.error('Original string:', objStr);
      
      // 尝试更激进的清理和修复方法
      try {
        // 更彻底的清理
        let fallbackStr = objStr
          .replace(/^\s*\*\s?/gm, '') // 移除所有行的 * 前缀
          .replace(/^\s+|\s+$/g, '') // 移除首尾空白
          .replace(/,(\s*[}\]])/g, '$1') // 移除尾随逗号
          .replace(/\n\s*\n/g, '\n') // 移除多余的换行
          .replace(/\/\/.*/g, ''); // 移除注释
        
        // 确保对象格式正确
        if (!fallbackStr.startsWith('{')) fallbackStr = `{${fallbackStr}`;
        if (!fallbackStr.endsWith('}')) fallbackStr = `${fallbackStr}}`;
        
        // 修复常见的JSON格式问题
        fallbackStr = fallbackStr
          .replace(/(\{|\,)\s*([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":') // 修复没有引号的键名
          .replace(/'([^']*?)'/g, '"$1"') // 修复单引号字符串
          .replace(/:\s*([a-zA-Z0-9_$]+)(\s*[,}])/g, ':"$1"$2'); // 修复没有引号的字符串值
        
        this.logger.debug('Fallback parsing with aggressive fixes:', fallbackStr);
        
        // 尝试解析修复后的字符串
        try {
          return JSON.parse(fallbackStr);
        } catch (finalError) {
          // 如果所有尝试都失败，构建一个基本的对象
          this.logger.error('All parsing attempts failed, creating basic object');
          
          // 提取可能的键值对
          const keyValuePairs = objStr.match(/([a-zA-Z0-9_$]+)\s*:\s*(['"]?[^,}]*['"]?)/g) || [];
          const result: Record<string, string> = {};
          
          keyValuePairs.forEach(pair => {
            const [key, ...valueParts] = pair.split(':');
            const value = valueParts.join(':').trim();
            if (key && value) {
              result[key.trim()] = value.replace(/^['"]|['"]$/g, ''); // 移除可能的引号
            }
          });
          
          return result;
        }
      } catch (fallbackError) {
        this.logger.error('Fallback parsing also failed:', fallbackError);
        // 返回一个空对象而不是抛出错误，以便处理继续
        this.logger.warn('Returning empty object due to parsing failure');
        return {};
      }
    }
  }

  /**
   * 解析JSDoc数组
   */
  private parseJSDocArray(arrStr: string): any[] {
    try {
      // 清理JSDoc格式：移除星号和缩进
      let cleanStr = arrStr
        .split('\n')
        .map(line => {
          // 移除行首的 * 和空格
          return line.replace(/^\s*\*\s?/, '').trim();
        })
        .filter(line => line.length > 0) // 移除空行
        .join('\n');
      
      // 移除可能的尾随逗号
      cleanStr = cleanStr.replace(/,(\s*[}\]])/g, '$1');
      
      // 确保数组格式正确
      if (!cleanStr.startsWith('[')) {
        cleanStr = `[${cleanStr}`;
      }
      if (!cleanStr.endsWith(']')) {
        cleanStr = `${cleanStr}]`;
      }
      
      this.logger.debug('Parsing JSDoc array:', cleanStr);
      
      // 尝试使用JSON.parse来解析数组
      try {
        return JSON.parse(cleanStr);
      } catch (jsonError) {
        // 如果JSON解析失败，尝试修复常见的JSON格式问题
        
        // 1. 修复单引号字符串
        let fixedStr = cleanStr.replace(/'([^']*?)'/g, '"$1"');
        
        // 2. 修复没有引号的键名
        fixedStr = fixedStr.replace(/(\{|\,)\s*([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":');
        
        // 3. 修复没有引号的字符串值
        fixedStr = fixedStr.replace(/:\s*([a-zA-Z0-9_$]+)(\s*[,}\]])/g, ':"$1"$2');
        
        this.logger.debug('Attempting to parse array with fixed JSON:', fixedStr);
        return JSON.parse(fixedStr);
      }
    } catch (error) {
      this.logger.error('JSDoc array parsing failed:', error);
      this.logger.error('Original string:', arrStr);
      
      // 尝试更激进的清理和修复方法
      try {
        // 更彻底的清理
        let fallbackStr = arrStr
          .replace(/^\s*\*\s?/gm, '') // 移除所有行的 * 前缀
          .replace(/^\s+|\s+$/g, '') // 移除首尾空白
          .replace(/,(\s*[}\]])/g, '$1') // 移除尾随逗号
          .replace(/\n\s*\n/g, '\n') // 移除多余的换行
          .replace(/\/\/.*/g, ''); // 移除注释
        
        // 确保数组格式正确
        if (!fallbackStr.startsWith('[')) fallbackStr = `[${fallbackStr}`;
        if (!fallbackStr.endsWith(']')) fallbackStr = `${fallbackStr}]`;
        
        // 修复常见的JSON格式问题
        fallbackStr = fallbackStr
          .replace(/'([^']*?)'/g, '"$1"') // 修复单引号字符串
          .replace(/(\{|\,)\s*([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":') // 修复没有引号的键名
          .replace(/:\s*([a-zA-Z0-9_$]+)(\s*[,}\]])/g, ':"$1"$2'); // 修复没有引号的字符串值
        
        this.logger.debug('Fallback array parsing with aggressive fixes:', fallbackStr);
        
        try {
          return JSON.parse(fallbackStr);
        } catch (finalError) {
          // 如果所有尝试都失败，尝试提取可能的对象数组
          this.logger.warn('All parsing attempts failed, trying to extract array items');
          
          // 尝试提取数组项
          const itemMatches = arrStr.match(/\{[^{}]*\}/g);
          if (itemMatches && itemMatches.length > 0) {
            const items = [];
            for (const itemStr of itemMatches) {
              try {
                // 尝试解析每个对象
                const item = this.parseJSDocObject(itemStr);
                items.push(item);
              } catch (itemError) {
                this.logger.warn(`Failed to parse array item: ${itemStr}`);
                // 继续处理下一个项
              }
            }
            
            if (items.length > 0) {
              this.logger.info(`Successfully extracted ${items.length} items from array`);
              return items;
            }
          }
          
          // 如果无法提取项，返回空数组
          this.logger.warn('Returning empty array due to parsing failure');
          return [];
        }
      } catch (fallbackError) {
        this.logger.error('Fallback array parsing also failed:', fallbackError);
        // 返回空数组而不是抛出错误，以便处理继续
        this.logger.warn('Returning empty array due to parsing failure');
        return [];
      }
    }
  }

  /**
   * 处理任务解析错误
   */
  private handleParsingError(error: Error, content: string, filename?: string): Error {
    // 使用TaskErrorHandler处理错误
    return this.errorHandler.handleParsingError(error, content, filename);
  }

  /**
   * 验证任务文件
   */
  private validateTaskFile(taskFile: TaskFile): void {
    // 使用TaskValidator进行验证
    const validationResult = this.taskValidator.validateTaskFile(taskFile);
    
    // 如果验证失败，抛出异常
    if (!validationResult.valid) {
      // 生成验证结果摘要
      const summary = this.taskValidator.generateValidationSummary(validationResult);
      throw new Error(summary);
    }
    
    // 如果有警告，记录但不阻止
    if (validationResult.warnings.length > 0) {
      this.logger.warn(`Task validation warnings: ${validationResult.warnings.length}`);
      validationResult.warnings.forEach(warning => {
        this.logger.warn(`- ${warning.message}${warning.path ? ` (${warning.path})` : ''}`);
      });
    }
    
    this.logger.debug(`任务文件验证通过，包含${validationResult.warnings.length}个警告`);
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
        // 基本等待和延迟
        wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        
        // 页面元素操作
        waitForSelector: (selector: string, timeout = 30000) => page.waitForSelector(selector, { timeout }),
        click: (selector: string) => page.click(selector),
        type: (selector: string, text: string) => page.type(selector, text),
        extractText: (selector: string) => page.$eval(selector, (el: any) => el.textContent?.trim()),
        extractAttribute: (selector: string, attribute: string) => page.$eval(selector, (el: any, attr: string) => el.getAttribute(attr), attribute),
        
        // 截图和文件操作
        screenshot: (filename?: string) => this.takeScreenshot(page, filename),
        saveFile: async (content: string | Buffer, filename: string) => {
          const outputDir = path.join(process.cwd(), 'output');
          await fs.mkdir(outputDir, { recursive: true });
          const filePath = path.join(outputDir, filename);
          await fs.writeFile(filePath, content);
          return filePath;
        },
        
        // 字符串和数据处理工具
        formatDate: (date: Date, format: string = 'YYYY-MM-DD_HH-mm-ss') => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          return format
            .replace('YYYY', year.toString())
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
        },
        
        // 数据验证和转换
        isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        isValidUrl: (url: string) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        
        // 随机数和ID生成
        randomString: (length: number = 8) => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        },
        
        // 数组和对象工具
        unique: (array: any[]) => [...new Set(array)],
        groupBy: (array: any[], key: string) => {
          return array.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
          }, {});
        },
        
        // CSV处理
        parseCSV: (csvText: string) => {
          const lines = csvText.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const data = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(v => v.trim());
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              data.push(row);
            }
          }
          
          return data;
        },
        
        // JSON处理
        safeJsonParse: (jsonStr: string, defaultValue: any = null) => {
          try {
            return JSON.parse(jsonStr);
          } catch {
            return defaultValue;
          }
        },
        
        // 哈希和加密工具
        createHash: (content: string) => {
          let hash = 0;
          for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return hash.toString();
        }
      }
    };
  }

  /**
   * 执行任务代码
   */
  private async executeTaskCode(code: string, context: TaskExecutionContext): Promise<any> {
    // 调试：打印实际的代码内容
    this.logger.info(`Original code length: ${code.length}`);
    this.logger.info(`Code preview: ${code.substring(0, 100)}...`);
    
    // 清理代码：移除 module.exports 部分
    let cleanedCode = code;
    
    // 方法1：移除从 "// Export" 注释开始到文件结尾的所有内容
    const exportCommentRegex = /\/\/\s*[Ee]xport.*[\s\S]*$/m;
    if (exportCommentRegex.test(cleanedCode)) {
      cleanedCode = cleanedCode.replace(exportCommentRegex, '').trim();
      this.logger.info('Used export comment regex to clean code');
    } else {
      // 方法2：只移除 module.exports 语句
      const moduleExportsRegex = /module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m;
      if (moduleExportsRegex.test(cleanedCode)) {
        cleanedCode = cleanedCode.replace(moduleExportsRegex, '').trim();
        this.logger.info('Used module.exports regex to clean code');
      } else {
        this.logger.warn('No module.exports pattern found to clean');
      }
    }
    
    this.logger.info(`Cleaned code length: ${cleanedCode.length}`);
    this.logger.info(`Cleaned code preview: ${cleanedCode.substring(Math.max(0, cleanedCode.length - 200))}`);
    
    // 创建执行函数，使用不同的参数名避免与任务代码中的变量冲突
    const functionBody = `
        // 将执行上下文变量映射到任务期望的名称
        const browser = taskBrowser;
        const page = taskPage;
        const params = taskParams;
        const log = taskLog;
        const progress = taskProgress;
        const utils = taskUtils;
        const require = taskRequire;
        
        ${cleanedCode}
        
        // 调用execute函数并传入上下文
        return execute({ browser, page, params, log, progress, utils });
      `;
    
    this.logger.info(`Function body to be executed: ${functionBody.substring(0, 300)}...`);
    
    let taskFunction;
    try {
      taskFunction = new Function(
        'taskBrowser', 'taskPage', 'taskParams', 'taskLog', 'taskProgress', 'taskUtils',
        functionBody
      );
    } catch (syntaxError) {
      const errorMessage = syntaxError instanceof Error ? syntaxError.message : String(syntaxError);
      this.logger.error(`Syntax error in generated function: ${errorMessage}`);
      
      // 保存有问题的函数体到文件以便调试
      const fs = require('fs');
      const debugPath = 'debug-function-body.js';
      fs.writeFileSync(debugPath, functionBody, 'utf8');
      this.logger.error(`Function body saved to ${debugPath} for debugging`);
      
      // 尝试找到具体的语法错误位置
      const lines = functionBody.split('\n');
      this.logger.error(`Function body has ${lines.length} lines`);
      
      throw new Error(`Failed to create task function: ${errorMessage}. Check ${debugPath} for details.`);
    }
    
    return await taskFunction(
      context.browser, 
      context.page, 
      context.parameters, 
      context.log, 
      context.progress, 
      context.utils
    );
  }

  /**
   * 截图
   */
  private async takeScreenshot(page: any, filename?: string): Promise<string> {
    try {
      // 创建输出目录
      const outputDir = path.join(process.cwd(), 'output', 'screenshots');
      await fs.mkdir(outputDir, { recursive: true });
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotFilename = filename || `screenshot_${timestamp}.png`;
      const screenshotPath = path.join(outputDir, screenshotFilename);
      
      // 截图
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      });
      
      this.logger.info(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      this.logger.error('Failed to take screenshot:', error);
      throw error;
    }
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

  /**
   * 检查任务依赖状态
   */
  async checkTaskDependencies(taskId: string): Promise<TaskDependencyCheck | null> {
    try {
      const task = await this.getTask(taskId);
      if (!task?.metadata.dependencies) {
        return null;
      }

      return await this.dependencyManager.checkDependencies(
        taskId,
        task.metadata.dependencies
      );
    } catch (error) {
      this.logger.error(`Failed to check dependencies for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * 安装任务依赖
   */
  async installTaskDependencies(request: any): Promise<any> {
    try {
      this.logger.info(`Installing dependencies for task: ${request.taskId}`);
      
      // 获取任务信息
      const task = this.localTasks.get(request.taskId);
      if (!task) {
        throw new Error(`Task not found: ${request.taskId}`);
      }

      // 转换依赖格式：从 string[] 转换为 TaskDependency[]
      const taskDependencies = (request.dependencies || []).map((dep: string) => {
        // 解析依赖字符串，格式可能是 "package@version" 或 "package"
        const [name, version = 'latest'] = dep.split('@');
        return {
          name,
          version,
          type: 'npm' as const,
          optional: false
        };
      });

      // 创建符合 DependencyManager 期望的请求格式
      const dependencyRequest = {
        taskId: request.taskId,
        dependencies: taskDependencies,
        force: request.force || false
      };
      
      const result = await this.dependencyManager.installDependencies(dependencyRequest);
      
      // 更新任务的依赖状态
      if (result.success) {
        const updatedCheck = await this.checkTaskDependencies(request.taskId);
        if (updatedCheck) {
          const task = this.localTasks.get(request.taskId);
          if (task) {
            task.dependencyStatus = updatedCheck;
            this.localTasks.set(request.taskId, task);
            this.emit('task:dependencies:updated', { taskId: request.taskId, status: updatedCheck });
          }
        }
      }
      
      // 转换返回格式以匹配前端期望
      return {
        success: result.success,
        installedDependencies: result.installed.map(dep => `${dep.name}@${dep.installedVersion || dep.version}`),
        failedDependencies: result.failed.map(f => f.dependency.name),
        warnings: result.warnings
      };
    } catch (error) {
      this.logger.error(`Failed to install dependencies for task ${request.taskId}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有任务的依赖状态摘要
   */
  async getDependencySummary(): Promise<{
    totalTasks: number;
    tasksWithDependencies: number;
    satisfiedTasks: number;
    unsatisfiedTasks: number;
    totalDependencies: number;
    missingDependencies: number;
  }> {
    const tasks = await this.getTasks();
    let tasksWithDependencies = 0;
    let satisfiedTasks = 0;
    let unsatisfiedTasks = 0;
    let totalDependencies = 0;
    let missingDependencies = 0;

    for (const task of tasks) {
      if (task.metadata.dependencies && task.metadata.dependencies.length > 0) {
        tasksWithDependencies++;
        totalDependencies += task.metadata.dependencies.length;
        
        if (task.dependencyStatus) {
          if (task.dependencyStatus.satisfied) {
            satisfiedTasks++;
          } else {
            unsatisfiedTasks++;
            missingDependencies += task.dependencyStatus.missingDependencies.length;
          }
        } else {
          // 需要检查依赖状态
          unsatisfiedTasks++;
        }
      }
    }

    return {
      totalTasks: tasks.length,
      tasksWithDependencies,
      satisfiedTasks,
      unsatisfiedTasks,
      totalDependencies,
      missingDependencies
    };
  }

  /**
   * 清理所有任务依赖
   */
  async cleanupAllDependencies(): Promise<void> {
    try {
      await this.dependencyManager.cleanupAllDependencies();
      
      // 重置所有任务的依赖状态
      for (const [taskId, task] of this.localTasks) {
        if (task.dependencyStatus) {
          delete task.dependencyStatus;
          this.localTasks.set(taskId, task);
        }
      }
      
      this.logger.info('All task dependencies cleaned up');
      this.emit('task:dependencies:cleaned');
    } catch (error) {
      this.logger.error('Failed to cleanup dependencies:', error);
      throw error;
    }
  }

  /**
   * 获取依赖管理器实例（用于高级操作）
   */
  getDependencyManager(): DependencyManager {
    return this.dependencyManager;
  }
  
  /**
   * 获取元数据缓存统计信息
   */
  getMetadataCacheStats() {
    return this.metadataCache.getCacheStats();
  }
  
  /**
   * 清理元数据缓存
   */
  async cleanupMetadataCache(): Promise<void> {
    await this.metadataCache.cleanupCache();
    this.logger.info('Metadata cache cleaned up');
  }
  
  /**
   * 清理所有缓存
   */
  async cleanupAllCaches(): Promise<void> {
    // 清理元数据缓存
    await this.metadataCache.cleanupCache();
    
    // 清理依赖缓存
    await this.dependencyManager.cleanupAllDependencies();
    
    this.logger.info('All caches cleaned up');
    this.emit('cache:cleaned');
  }
}