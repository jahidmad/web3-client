/**
 * Database Task Storage Implementation
 * 
 * This module implements the TaskStorage interface using a database backend.
 * It provides persistent storage for tasks with full CRUD operations.
 */

import { TaskStorage } from '../managers/task-manager';
import { Task, TaskFilter, TaskStatus, TaskError, ErrorCode } from '../types/plugin-task-system';

// ============================================================================
// DATABASE MODELS
// ============================================================================

/**
 * Database task model - matches the structure we need for the plugin task system
 */
export interface DatabaseTask {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string; // JSON string array
  icon?: string;
  parameters: string; // JSON string
  dependencies: string; // JSON string array
  config: string; // JSON string
  code: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database task execution record
 */
export interface DatabaseTaskExecution {
  id: string;
  taskId: string;
  browserId: string;
  status: string;
  parameters: string; // JSON string
  startTime: Date;
  endTime?: Date;
  duration?: number;
  progress: number;
  progressMessage?: string;
  logs: string; // JSON string array
  result?: string; // JSON string
  error?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

/**
 * Database interface for task operations
 */
export interface TaskDatabase {
  // Task operations
  createTask(task: Omit<DatabaseTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseTask>;
  findTaskById(id: string): Promise<DatabaseTask | null>;
  findTasks(filter?: TaskFilter): Promise<DatabaseTask[]>;
  updateTask(id: string, updates: Partial<DatabaseTask>): Promise<DatabaseTask>;
  deleteTask(id: string): Promise<void>;
  searchTasks(query: string, filter?: TaskFilter): Promise<DatabaseTask[]>;
  countTasks(filter?: TaskFilter): Promise<number>;
  
  // Execution operations
  createExecution(execution: Omit<DatabaseTaskExecution, 'id'>): Promise<DatabaseTaskExecution>;
  findExecutionById(id: string): Promise<DatabaseTaskExecution | null>;
  findExecutions(taskId?: string): Promise<DatabaseTaskExecution[]>;
  updateExecution(id: string, updates: Partial<DatabaseTaskExecution>): Promise<DatabaseTaskExecution>;
  deleteExecution(id: string): Promise<void>;
}

// ============================================================================
// IN-MEMORY DATABASE IMPLEMENTATION (FOR TESTING)
// ============================================================================

/**
 * In-memory database implementation for testing and development
 */
export class InMemoryTaskDatabase implements TaskDatabase {
  private tasks: Map<string, DatabaseTask> = new Map();
  private executions: Map<string, DatabaseTaskExecution> = new Map();
  private nextTaskId = 1;
  private nextExecutionId = 1;

  // Task operations
  async createTask(taskData: Omit<DatabaseTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseTask> {
    const now = new Date();
    const task: DatabaseTask = {
      ...taskData,
      id: `task_${this.nextTaskId++}`,
      createdAt: now,
      updatedAt: now
    };
    
    this.tasks.set(task.id, task);
    return { ...task };
  }

  async findTaskById(id: string): Promise<DatabaseTask | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async findTasks(filter?: TaskFilter): Promise<DatabaseTask[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filter) {
      tasks = this.applyTaskFilter(tasks, filter);
    }
    
    return tasks.map(task => ({ ...task }));
  }

  async updateTask(id: string, updates: Partial<DatabaseTask>): Promise<DatabaseTask> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) {
      throw new Error(`Task with id ${id} not found`);
    }

    const updatedTask: DatabaseTask = {
      ...existingTask,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date()
    };

    this.tasks.set(id, updatedTask);
    return { ...updatedTask };
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new Error(`Task with id ${id} not found`);
    }
    this.tasks.delete(id);
  }

  async searchTasks(query: string, filter?: TaskFilter): Promise<DatabaseTask[]> {
    const searchTerm = query.toLowerCase();
    let tasks = Array.from(this.tasks.values());
    
    // Apply text search
    tasks = tasks.filter(task => 
      task.name.toLowerCase().includes(searchTerm) ||
      task.description.toLowerCase().includes(searchTerm) ||
      task.author.toLowerCase().includes(searchTerm) ||
      task.category.toLowerCase().includes(searchTerm) ||
      JSON.parse(task.tags || '[]').some((tag: string) => tag.toLowerCase().includes(searchTerm))
    );
    
    // Apply additional filters
    if (filter) {
      tasks = this.applyTaskFilter(tasks, filter);
    }
    
    return tasks.map(task => ({ ...task }));
  }

  async countTasks(filter?: TaskFilter): Promise<number> {
    const tasks = await this.findTasks(filter);
    return tasks.length;
  }

  // Execution operations
  async createExecution(executionData: Omit<DatabaseTaskExecution, 'id'>): Promise<DatabaseTaskExecution> {
    const execution: DatabaseTaskExecution = {
      ...executionData,
      id: `exec_${this.nextExecutionId++}`
    };
    
    this.executions.set(execution.id, execution);
    return { ...execution };
  }

  async findExecutionById(id: string): Promise<DatabaseTaskExecution | null> {
    const execution = this.executions.get(id);
    return execution ? { ...execution } : null;
  }

  async findExecutions(taskId?: string): Promise<DatabaseTaskExecution[]> {
    let executions = Array.from(this.executions.values());
    
    if (taskId) {
      executions = executions.filter(exec => exec.taskId === taskId);
    }
    
    return executions.map(exec => ({ ...exec }));
  }

  async updateExecution(id: string, updates: Partial<DatabaseTaskExecution>): Promise<DatabaseTaskExecution> {
    const existingExecution = this.executions.get(id);
    if (!existingExecution) {
      throw new Error(`Execution with id ${id} not found`);
    }

    const updatedExecution: DatabaseTaskExecution = {
      ...existingExecution,
      ...updates,
      id // Ensure ID cannot be changed
    };

    this.executions.set(id, updatedExecution);
    return { ...updatedExecution };
  }

  async deleteExecution(id: string): Promise<void> {
    if (!this.executions.has(id)) {
      throw new Error(`Execution with id ${id} not found`);
    }
    this.executions.delete(id);
  }

  // Helper methods
  private applyTaskFilter(tasks: DatabaseTask[], filter: TaskFilter): DatabaseTask[] {
    return tasks.filter(task => {
      if (filter.category && task.category !== filter.category) return false;
      if (filter.status && task.status !== filter.status) return false;
      if (filter.author && task.author !== filter.author) return false;
      if (filter.tags) {
        const taskTags = JSON.parse(task.tags || '[]');
        if (!filter.tags.some(tag => taskTags.includes(tag))) return false;
      }
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
// DATABASE TASK STORAGE IMPLEMENTATION
// ============================================================================

/**
 * Database-backed task storage implementation
 */
export class DatabaseTaskStorage implements TaskStorage {
  private db: TaskDatabase;

  constructor(database: TaskDatabase) {
    this.db = database;
  }

  async create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      const dbTask = await this.db.createTask({
        name: taskData.name,
        description: taskData.description,
        version: taskData.version,
        author: taskData.author,
        category: taskData.category,
        tags: JSON.stringify(taskData.tags),
        icon: taskData.icon,
        parameters: JSON.stringify(taskData.parameters),
        dependencies: JSON.stringify(taskData.dependencies),
        config: JSON.stringify(taskData.config),
        code: taskData.code,
        status: taskData.status
      });

      return this.convertDatabaseTaskToTask(dbTask);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findById(id: string): Promise<Task | null> {
    try {
      const dbTask = await this.db.findTaskById(id);
      return dbTask ? this.convertDatabaseTaskToTask(dbTask) : null;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findMany(filter?: TaskFilter): Promise<Task[]> {
    try {
      const dbTasks = await this.db.findTasks(filter);
      return dbTasks.map(dbTask => this.convertDatabaseTaskToTask(dbTask));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    try {
      const dbUpdates: Partial<DatabaseTask> = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.version !== undefined) dbUpdates.version = updates.version;
      if (updates.author !== undefined) dbUpdates.author = updates.author;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.tags !== undefined) dbUpdates.tags = JSON.stringify(updates.tags);
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
      if (updates.parameters !== undefined) dbUpdates.parameters = JSON.stringify(updates.parameters);
      if (updates.dependencies !== undefined) dbUpdates.dependencies = JSON.stringify(updates.dependencies);
      if (updates.config !== undefined) dbUpdates.config = JSON.stringify(updates.config);
      if (updates.code !== undefined) dbUpdates.code = updates.code;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const updatedDbTask = await this.db.updateTask(id, dbUpdates);
      return this.convertDatabaseTaskToTask(updatedDbTask);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to update task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.deleteTask(id);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to delete task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
    try {
      const dbTasks = await this.db.searchTasks(query, filter);
      return dbTasks.map(dbTask => this.convertDatabaseTaskToTask(dbTask));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to search tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async count(filter?: TaskFilter): Promise<number> {
    try {
      return await this.db.countTasks(filter);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to count tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  private convertDatabaseTaskToTask(dbTask: DatabaseTask): Task {
    return {
      id: dbTask.id,
      name: dbTask.name,
      description: dbTask.description,
      version: dbTask.version,
      author: dbTask.author,
      category: dbTask.category,
      tags: JSON.parse(dbTask.tags || '[]'),
      icon: dbTask.icon,
      parameters: JSON.parse(dbTask.parameters || '[]'),
      dependencies: JSON.parse(dbTask.dependencies || '[]'),
      config: JSON.parse(dbTask.config || '{}'),
      code: dbTask.code,
      status: dbTask.status as TaskStatus,
      createdAt: dbTask.createdAt,
      updatedAt: dbTask.updatedAt
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a database task storage with in-memory database (for testing)
 */
export function createInMemoryDatabaseTaskStorage(): DatabaseTaskStorage {
  return new DatabaseTaskStorage(new InMemoryTaskDatabase());
}

/**
 * Create a database task storage with custom database implementation
 */
export function createDatabaseTaskStorage(database: TaskDatabase): DatabaseTaskStorage {
  return new DatabaseTaskStorage(database);
}