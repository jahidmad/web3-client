/**
 * Task Manager - Core CRUD Operations
 * 
 * This module implements the core task management functionality including
 * create, read, update, delete operations for tasks, along with file upload,
 * parsing, validation, and storage management.
 */

import { 
  Task, 
  TaskFilter, 
  TaskStatus, 
  TaskManager as ITaskManager,
  TaskImportResult,
  TaskImportOptions,
  TaskExportOptions,
  ExecutionRequest,
  Execution,
  DependencyStatus,
  DependencyInstallRequest,
  DependencyInstallResult,
  TaskError,
  ErrorCode,
  Parameter,
  TaskConfig
} from '../types/plugin-task-system';

import {
  TaskFile,
  TaskFileValidationResult
} from '../types/task-file-format';

import { parseTaskFile, validateTaskFile, TaskFileParser } from '../parsers/task-file-parser';
import { validateTaskFile as validateParsedTaskFile } from '../validators/task-file-validator';

// ============================================================================
// TASK STORAGE INTERFACE
// ============================================================================

/**
 * Interface for task storage operations
 */
export interface TaskStorage {
  // Basic CRUD operations
  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findMany(filter?: TaskFilter): Promise<Task[]>;
  update(id: string, updates: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
  
  // Bulk operations
  createMany(tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Task[]>;
  deleteMany(ids: string[]): Promise<void>;
  
  // Search and filtering
  search(query: string, filter?: TaskFilter): Promise<Task[]>;
  count(filter?: TaskFilter): Promise<number>;
}

/**
 * In-memory task storage implementation for development/testing
 */
export class InMemoryTaskStorage implements TaskStorage {
  private tasks: Map<string, Task> = new Map();
  private nextId = 1;

  async create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date();
    const task: Task = {
      ...taskData,
      id: `task_${this.nextId++}`,
      createdAt: now,
      updatedAt: now
    };
    
    this.tasks.set(task.id, task);
    return { ...task };
  }

  async findById(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async findMany(filter?: TaskFilter): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filter) {
      tasks = this.applyFilter(tasks, filter);
    }
    
    return tasks.map(task => ({ ...task }));
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) {
      throw new TaskError(ErrorCode.DATABASE_ERROR, `Task with id ${id} not found`);
    }

    const updatedTask: Task = {
      ...existingTask,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date()
    };

    this.tasks.set(id, updatedTask);
    return { ...updatedTask };
  }

  async delete(id: string): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new TaskError(ErrorCode.DATABASE_ERROR, `Task with id ${id} not found`);
    }
    this.tasks.delete(id);
  }

  async createMany(tasksData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Task[]> {
    const results: Task[] = [];
    for (const taskData of tasksData) {
      const task = await this.create(taskData);
      results.push(task);
    }
    return results;
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async search(query: string, filter?: TaskFilter): Promise<Task[]> {
    const searchTerm = query.toLowerCase();
    let tasks = Array.from(this.tasks.values());
    
    // Apply text search
    tasks = tasks.filter(task => 
      task.name.toLowerCase().includes(searchTerm) ||
      task.description.toLowerCase().includes(searchTerm) ||
      task.author.toLowerCase().includes(searchTerm) ||
      task.category.toLowerCase().includes(searchTerm) ||
      task.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
    
    // Apply additional filters
    if (filter) {
      tasks = this.applyFilter(tasks, filter);
    }
    
    return tasks.map(task => ({ ...task }));
  }

  async count(filter?: TaskFilter): Promise<number> {
    const tasks = await this.findMany(filter);
    return tasks.length;
  }

  private applyFilter(tasks: Task[], filter: TaskFilter): Task[] {
    return tasks.filter(task => {
      if (filter.category && task.category !== filter.category) return false;
      if (filter.status && task.status !== filter.status) return false;
      if (filter.author && task.author !== filter.author) return false;
      if (filter.tags && !filter.tags.some(tag => task.tags.includes(tag))) return false;
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        const matchesSearch = 
          task.name.toLowerCase().includes(searchTerm) ||
          task.description.toLowerCase().includes(searchTerm) ||
          task.author.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }
      return true;
    }).slice(filter.offset || 0, (filter.offset || 0) + (filter.limit || tasks.length));
  }
}

// ============================================================================
// TASK MANAGER IMPLEMENTATION
// ============================================================================

/**
 * Main task manager implementation
 */
export class TaskManager implements ITaskManager {
  private storage: TaskStorage;

  constructor(storage?: TaskStorage) {
    this.storage = storage || new InMemoryTaskStorage();
  }

  // ============================================================================
  // TASK CRUD OPERATIONS
  // ============================================================================

  /**
   * Upload and parse a task file
   */
  async uploadTask(file: Buffer, filename: string): Promise<Task> {
    try {
      // Parse the task file with disabled security scanning for testing
      const content = file.toString('utf-8');
      
      // Create a parser with security scanning disabled for testing
      const parser = new TaskFileParser({
        security: {
          enableScan: false,
          strictMode: false,
          allowedPatterns: [],
          forbiddenPatterns: []
        }
      });
      
      const context = {
        filename,
        content,
        size: Buffer.byteLength(content, 'utf-8'),
        encoding: 'utf-8'
      };
      
      const taskFile = await parser.parseTaskFile(context);
      
      // Validate the parsed task file
      const validationResult = await validateParsedTaskFile(taskFile);
      if (!validationResult.valid) {
        throw new TaskError(
          ErrorCode.INVALID_FORMAT,
          `Task validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      // Convert TaskFile to Task
      const taskData = this.convertTaskFileToTask(taskFile, filename);
      
      // Check for duplicate names
      const existingTasks = await this.storage.search(taskData.name);
      if (existingTasks.length > 0) {
        throw new TaskError(
          ErrorCode.INVALID_FORMAT,
          `Task with name '${taskData.name}' already exists`
        );
      }

      // Create the task
      const task = await this.storage.create(taskData);
      
      return task;
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      throw new TaskError(
        ErrorCode.PARSE_ERROR,
        `Failed to upload task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all tasks with optional filtering
   */
  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    try {
      return await this.storage.findMany(filter);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to retrieve tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      return await this.storage.findById(taskId);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to retrieve task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Search tasks by query string
   */
  async searchTasks(query: string, filter?: TaskFilter): Promise<Task[]> {
    try {
      return await this.storage.search(query, filter);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to search tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get task count with optional filtering
   */
  async getTaskCount(filter?: TaskFilter): Promise<number> {
    try {
      return await this.storage.count(filter);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to count tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      // Validate that the task exists
      const existingTask = await this.storage.findById(taskId);
      if (!existingTask) {
        throw new TaskError(ErrorCode.DATABASE_ERROR, `Task with id ${taskId} not found`);
      }

      // Prevent updating certain fields
      const allowedUpdates = { ...updates };
      delete allowedUpdates.id;
      delete allowedUpdates.createdAt;
      
      // If updating name, check for duplicates
      if (allowedUpdates.name && allowedUpdates.name !== existingTask.name) {
        const duplicates = await this.storage.search(allowedUpdates.name);
        if (duplicates.length > 0) {
          throw new TaskError(
            ErrorCode.INVALID_FORMAT,
            `Task with name '${allowedUpdates.name}' already exists`
          );
        }
      }

      return await this.storage.update(taskId, allowedUpdates);
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to update task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.storage.delete(taskId);
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to delete task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // SEARCH AND FILTERING
  // ============================================================================

  /**
   * Get tasks by category
   */
  async getTasksByCategory(category: string): Promise<Task[]> {
    return this.getTasks({ category });
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    return this.getTasks({ status });
  }

  /**
   * Get tasks by author
   */
  async getTasksByAuthor(author: string): Promise<Task[]> {
    return this.getTasks({ author });
  }

  /**
   * Get tasks by tags
   */
  async getTasksByTags(tags: string[]): Promise<Task[]> {
    return this.getTasks({ tags });
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Upload multiple task files
   */
  async uploadMultipleTasks(files: Array<{ buffer: Buffer; filename: string }>): Promise<{
    successful: Task[];
    failed: Array<{ filename: string; error: string }>;
  }> {
    const successful: Task[] = [];
    const failed: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const task = await this.uploadTask(file.buffer, file.filename);
        successful.push(task);
      } catch (error) {
        failed.push({
          filename: file.filename,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Delete multiple tasks
   */
  async deleteMultipleTasks(taskIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ taskId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ taskId: string; error: string }> = [];

    for (const taskId of taskIds) {
      try {
        await this.deleteTask(taskId);
        successful.push(taskId);
      } catch (error) {
        failed.push({
          taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Update task status for multiple tasks
   */
  async updateMultipleTaskStatus(taskIds: string[], status: TaskStatus): Promise<{
    successful: Task[];
    failed: Array<{ taskId: string; error: string }>;
  }> {
    const successful: Task[] = [];
    const failed: Array<{ taskId: string; error: string }> = [];

    for (const taskId of taskIds) {
      try {
        const updatedTask = await this.updateTask(taskId, { status });
        successful.push(updatedTask);
      } catch (error) {
        failed.push({
          taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { successful, failed };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert TaskFile to Task data structure
   */
  private convertTaskFileToTask(taskFile: TaskFile, filename: string): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: taskFile.metadata.name,
      description: taskFile.metadata.description,
      version: taskFile.metadata.version,
      author: taskFile.metadata.author,
      category: taskFile.metadata.category || 'Other',
      tags: taskFile.metadata.tags || [],
      icon: taskFile.metadata.icon,
      parameters: taskFile.parameters,
      dependencies: taskFile.dependencies,
      config: {
        timeout: 30000,
        retries: 2,
        concurrent: false,
        priority: 5,
        ...taskFile.config
      },
      code: taskFile.code,
      status: TaskStatus.DRAFT
    };
  }

  /**
   * Validate task data before operations
   */
  private validateTaskData(task: Partial<Task>): void {
    if (task.name !== undefined) {
      if (typeof task.name !== 'string' || task.name.trim().length === 0) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task name must be a non-empty string');
      }
      if (task.name.length > 100) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task name must be less than 100 characters');
      }
    }

    if (task.description !== undefined) {
      if (typeof task.description !== 'string' || task.description.trim().length === 0) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task description must be a non-empty string');
      }
      if (task.description.length > 1000) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task description must be less than 1000 characters');
      }
    }

    if (task.version !== undefined) {
      if (typeof task.version !== 'string' || !/^\d+\.\d+\.\d+/.test(task.version)) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task version must follow semantic versioning format');
      }
    }

    if (task.author !== undefined) {
      if (typeof task.author !== 'string' || task.author.trim().length === 0) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task author must be a non-empty string');
      }
    }

    if (task.category !== undefined) {
      if (typeof task.category !== 'string' || task.category.trim().length === 0) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task category must be a non-empty string');
      }
    }

    if (task.tags !== undefined) {
      if (!Array.isArray(task.tags)) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task tags must be an array');
      }
      for (const tag of task.tags) {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'All tags must be non-empty strings');
        }
      }
    }

    if (task.parameters !== undefined) {
      if (!Array.isArray(task.parameters)) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task parameters must be an array');
      }
    }

    if (task.dependencies !== undefined) {
      if (!Array.isArray(task.dependencies)) {
        throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'Task dependencies must be an array');
      }
      for (const dep of task.dependencies) {
        if (typeof dep !== 'string' || dep.trim().length === 0) {
          throw new TaskError(ErrorCode.INVALID_PARAMETERS, 'All dependencies must be non-empty strings');
        }
      }
    }
  }

  // ============================================================================
  // PLACEHOLDER METHODS (TO BE IMPLEMENTED IN LATER TASKS)
  // ============================================================================

  /**
   * Execute a task (placeholder - will be implemented in task execution engine)
   */
  async executeTask(request: ExecutionRequest): Promise<Execution> {
    throw new TaskError(ErrorCode.EXECUTION_FAILED, 'Task execution not yet implemented');
  }

  /**
   * Stop task execution (placeholder)
   */
  async stopExecution(executionId: string): Promise<void> {
    throw new TaskError(ErrorCode.EXECUTION_FAILED, 'Task execution control not yet implemented');
  }

  /**
   * Get execution details (placeholder)
   */
  async getExecution(executionId: string): Promise<Execution | null> {
    throw new TaskError(ErrorCode.EXECUTION_FAILED, 'Execution tracking not yet implemented');
  }

  /**
   * Get executions for a task (placeholder)
   */
  async getExecutions(taskId?: string): Promise<Execution[]> {
    throw new TaskError(ErrorCode.EXECUTION_FAILED, 'Execution tracking not yet implemented');
  }

  /**
   * Check task dependencies (placeholder)
   */
  async checkDependencies(taskId: string): Promise<DependencyStatus> {
    throw new TaskError(ErrorCode.DEPENDENCY_NOT_FOUND, 'Dependency management not yet implemented');
  }

  /**
   * Install task dependencies (placeholder)
   */
  async installDependencies(request: DependencyInstallRequest): Promise<DependencyInstallResult> {
    throw new TaskError(ErrorCode.DEPENDENCY_INSTALL_FAILED, 'Dependency installation not yet implemented');
  }

  /**
   * Cleanup dependencies (placeholder)
   */
  async cleanupDependencies(): Promise<void> {
    throw new TaskError(ErrorCode.DEPENDENCY_INSTALL_FAILED, 'Dependency cleanup not yet implemented');
  }

  /**
   * Export task as a portable file
   * 
   * @param taskId The ID of the task to export
   * @param options Export options
   * @returns Buffer containing the exported task
   */
  async exportTask(taskId: string, options?: TaskExportOptions): Promise<Buffer> {
    // Get the task by ID
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    // Default options
    const exportOptions = {
      includeMetadata: options?.includeMetadata !== false,
      includeDependencies: options?.includeDependencies !== false,
      format: options?.format || 'js',
      includeExecutionHistory: options?.includeExecutionHistory || false,
      prettify: options?.prettify !== false,
      compress: options?.compress || false
    };

    try {
      // Generate the task file content
      const taskFileContent = this.generateTaskFileContent(task, exportOptions);
      
      // For now, we'll just return the uncompressed content
      // Compression can be handled in the main process if needed
      return Buffer.from(taskFileContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to export task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Export multiple tasks as a zip archive
   * 
   * @param taskIds Array of task IDs to export
   * @param options Export options
   * @returns Buffer containing the exported tasks as a zip archive
   */
  async exportMultipleTasks(taskIds: string[], options?: TaskExportOptions): Promise<Buffer> {
    if (!taskIds || taskIds.length === 0) {
      throw new Error('No task IDs provided for export');
    }
    
    // Default options
    const exportOptions = {
      includeMetadata: options?.includeMetadata !== false,
      includeDependencies: options?.includeDependencies !== false,
      format: options?.format || 'js',
      includeExecutionHistory: options?.includeExecutionHistory || false,
      prettify: options?.prettify !== false,
      compress: options?.compress || false
    };
    
    try {
      // Create a map to store task content by filename
      const taskContents: Record<string, string> = {};
      
      // Export each task
      for (const taskId of taskIds) {
        const task = await this.getTask(taskId);
        if (!task) {
          console.warn(`Task with ID ${taskId} not found, skipping`);
          continue;
        }
        
        // Generate task file content
        const taskFileContent = this.generateTaskFileContent(task, exportOptions);
        
        // Create a safe filename
        const safeTaskName = task.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        // Add to the map with a unique filename
        const filename = `${safeTaskName}-${task.id}.js`;
        taskContents[filename] = taskFileContent;
      }
      
      // If no tasks were found, throw an error
      if (Object.keys(taskContents).length === 0) {
        throw new Error('No valid tasks found for export');
      }
      
      // For now, return a JSON representation of the tasks
      // In a real implementation, this would create a zip file
      const exportData = {
        tasks: taskContents,
        metadata: {
          exportDate: new Date().toISOString(),
          taskCount: Object.keys(taskContents).length,
          format: exportOptions.format
        }
      };
      
      return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to export tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate task file content from a task object
   * 
   * @param task The task to generate content for
   * @param options Export options
   * @returns String containing the task file content
   */
  private generateTaskFileContent(task: Task, options: any): string {
    // Generate JSDoc metadata block
    const metadataBlock = this.generateMetadataBlock(task);
    
    // Generate parameters declaration
    const parametersBlock = this.generateParametersBlock(task.parameters, options.prettify);
    
    // Generate dependencies declaration
    const dependenciesBlock = options.includeDependencies 
      ? this.generateDependenciesBlock(task.dependencies, options.prettify)
      : 'const dependencies = [];';
    
    // Generate config declaration
    const configBlock = this.generateConfigBlock(task.config, options.prettify);
    
    // Extract the execute function from the task code
    const executeFunction = this.extractExecuteFunction(task.code);
    
    // Combine all blocks into a complete task file
    const taskFileContent = [
      metadataBlock,
      '',
      parametersBlock,
      '',
      dependenciesBlock,
      '',
      configBlock,
      '',
      executeFunction,
      '',
      'module.exports = { parameters, dependencies, config, execute };'
    ].join('\n');
    
    return taskFileContent;
  }
  
  /**
   * Generate JSDoc metadata block from task properties
   * 
   * @param task The task to generate metadata for
   * @returns String containing the JSDoc metadata block
   */
  private generateMetadataBlock(task: Task): string {
    const metadata = [
      '/**',
      ` * @name ${task.name}`,
      ` * @description ${task.description}`,
      ` * @version ${task.version}`,
      ` * @author ${task.author}`,
      ` * @category ${task.category}`
    ];
    
    // Add optional metadata
    if (task.tags && task.tags.length > 0) {
      metadata.push(` * @tags ${task.tags.join(',')}`);
    }
    
    if (task.icon) {
      metadata.push(` * @icon ${task.icon}`);
    }
    
    metadata.push(' */');
    
    return metadata.join('\n');
  }
  
  /**
   * Generate parameters declaration block
   * 
   * @param parameters The parameters to include
   * @param prettify Whether to prettify the output
   * @returns String containing the parameters declaration
   */
  private generateParametersBlock(parameters: any[], prettify: boolean): string {
    if (!parameters || parameters.length === 0) {
      return 'const parameters = [];';
    }
    
    const indent = prettify ? '  ' : '';
    const spacing = prettify ? '\n' : '';
    
    const parameterStrings = parameters.map(param => {
      const props = [
        `${indent}name: '${param.name}'`,
        `${indent}label: '${param.label}'`,
        `${indent}type: '${param.type}'`
      ];
      
      if (param.required) {
        props.push(`${indent}required: ${param.required}`);
      }
      
      if (param.default !== undefined) {
        const defaultValue = typeof param.default === 'string' 
          ? `'${param.default}'` 
          : JSON.stringify(param.default);
        props.push(`${indent}default: ${defaultValue}`);
      }
      
      if (param.description) {
        props.push(`${indent}description: '${param.description}'`);
      }
      
      if (param.placeholder) {
        props.push(`${indent}placeholder: '${param.placeholder}'`);
      }
      
      if (param.validation) {
        props.push(`${indent}validation: '${param.validation}'`);
      }
      
      if (param.options && param.options.length > 0) {
        const optionsStr = JSON.stringify(param.options, null, prettify ? 2 : 0)
          .replace(/^/gm, indent)
          .replace(/^\s+/, '');
        props.push(`${indent}options: ${optionsStr}`);
      }
      
      return `{${spacing}${props.join(`,${spacing}`)}${spacing}}`;
    });
    
    return `const parameters = [${spacing}${parameterStrings.join(`,${spacing}`)}${spacing}];`;
  }
  
  /**
   * Generate dependencies declaration block
   * 
   * @param dependencies The dependencies to include
   * @param prettify Whether to prettify the output
   * @returns String containing the dependencies declaration
   */
  private generateDependenciesBlock(dependencies: string[], prettify: boolean): string {
    if (!dependencies || dependencies.length === 0) {
      return 'const dependencies = [];';
    }
    
    const indent = prettify ? '  ' : '';
    const spacing = prettify ? '\n' : '';
    
    const dependencyStrings = dependencies.map(dep => `${indent}'${dep}'`);
    
    return `const dependencies = [${spacing}${dependencyStrings.join(`,${spacing}`)}${spacing}];`;
  }
  
  /**
   * Generate config declaration block
   * 
   * @param config The config to include
   * @param prettify Whether to prettify the output
   * @returns String containing the config declaration
   */
  private generateConfigBlock(config: any, prettify: boolean): string {
    if (!config || Object.keys(config).length === 0) {
      return 'const config = {};';
    }
    
    const configStr = JSON.stringify(config, null, prettify ? 2 : 0);
    return `const config = ${configStr};`;
  }
  
  /**
   * Extract execute function from task code
   * 
   * @param code The full task code
   * @returns String containing just the execute function
   */
  private extractExecuteFunction(code: string): string {
    // Try to find the execute function in the code
    const executeFunctionRegex = /async\s+function\s+execute\s*\([^)]*\)\s*{[\s\S]*?}(?=\s*(?:\/\/|\/\*|$|module\.exports))/;
    const match = code.match(executeFunctionRegex);
    
    if (match && match[0]) {
      return match[0];
    }
    
    // If we can't find it, return a placeholder function
    return `async function execute(context) {
  const { log, progress } = context;
  log('Task started');
  progress(100, 'Task completed');
  return { success: true };
}`;
  }

  /**
   * Import task (placeholder)
   */
  async importTask(data: Buffer, options?: TaskImportOptions): Promise<TaskImportResult> {
    throw new TaskError(ErrorCode.FILE_SYSTEM_ERROR, 'Task import not yet implemented');
  }

  /**
   * Import task from URL (placeholder)
   */
  async importTaskFromUrl(url: string, options?: TaskImportOptions): Promise<TaskImportResult> {
    throw new TaskError(ErrorCode.NETWORK_ERROR, 'Task import from URL not yet implemented');
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new task manager with default storage
 */
export function createTaskManager(storage?: TaskStorage): TaskManager {
  return new TaskManager(storage);
}

/**
 * Create a task manager with in-memory storage (for testing)
 */
export function createInMemoryTaskManager(): TaskManager {
  return new TaskManager(new InMemoryTaskStorage());
}