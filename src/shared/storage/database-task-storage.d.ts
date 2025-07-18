/**
 * Database Task Storage Implementation
 *
 * This module implements the TaskStorage interface using a database backend.
 * It provides persistent storage for tasks with full CRUD operations.
 */
import { TaskStorage } from '../managers/task-manager';
import { Task, TaskFilter } from '../types/plugin-task-system';
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
    tags: string;
    icon?: string;
    parameters: string;
    dependencies: string;
    config: string;
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
    parameters: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    progress: number;
    progressMessage?: string;
    logs: string;
    result?: string;
    error?: string;
    memoryUsage?: number;
    cpuUsage?: number;
}
/**
 * Database interface for task operations
 */
export interface TaskDatabase {
    createTask(task: Omit<DatabaseTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseTask>;
    findTaskById(id: string): Promise<DatabaseTask | null>;
    findTasks(filter?: TaskFilter): Promise<DatabaseTask[]>;
    updateTask(id: string, updates: Partial<DatabaseTask>): Promise<DatabaseTask>;
    deleteTask(id: string): Promise<void>;
    searchTasks(query: string, filter?: TaskFilter): Promise<DatabaseTask[]>;
    countTasks(filter?: TaskFilter): Promise<number>;
    createExecution(execution: Omit<DatabaseTaskExecution, 'id'>): Promise<DatabaseTaskExecution>;
    findExecutionById(id: string): Promise<DatabaseTaskExecution | null>;
    findExecutions(taskId?: string): Promise<DatabaseTaskExecution[]>;
    updateExecution(id: string, updates: Partial<DatabaseTaskExecution>): Promise<DatabaseTaskExecution>;
    deleteExecution(id: string): Promise<void>;
}
/**
 * In-memory database implementation for testing and development
 */
export declare class InMemoryTaskDatabase implements TaskDatabase {
    private tasks;
    private executions;
    private nextTaskId;
    private nextExecutionId;
    createTask(taskData: Omit<DatabaseTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseTask>;
    findTaskById(id: string): Promise<DatabaseTask | null>;
    findTasks(filter?: TaskFilter): Promise<DatabaseTask[]>;
    updateTask(id: string, updates: Partial<DatabaseTask>): Promise<DatabaseTask>;
    deleteTask(id: string): Promise<void>;
    searchTasks(query: string, filter?: TaskFilter): Promise<DatabaseTask[]>;
    countTasks(filter?: TaskFilter): Promise<number>;
    createExecution(executionData: Omit<DatabaseTaskExecution, 'id'>): Promise<DatabaseTaskExecution>;
    findExecutionById(id: string): Promise<DatabaseTaskExecution | null>;
    findExecutions(taskId?: string): Promise<DatabaseTaskExecution[]>;
    updateExecution(id: string, updates: Partial<DatabaseTaskExecution>): Promise<DatabaseTaskExecution>;
    deleteExecution(id: string): Promise<void>;
    private applyTaskFilter;
}
/**
 * Database-backed task storage implementation
 */
export declare class DatabaseTaskStorage implements TaskStorage {
    private db;
    constructor(database: TaskDatabase);
    create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findMany(filter?: TaskFilter): Promise<Task[]>;
    update(id: string, updates: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
    createMany(tasksData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Task[]>;
    deleteMany(ids: string[]): Promise<void>;
    search(query: string, filter?: TaskFilter): Promise<Task[]>;
    count(filter?: TaskFilter): Promise<number>;
    private convertDatabaseTaskToTask;
}
/**
 * Create a database task storage with in-memory database (for testing)
 */
export declare function createInMemoryDatabaseTaskStorage(): DatabaseTaskStorage;
/**
 * Create a database task storage with custom database implementation
 */
export declare function createDatabaseTaskStorage(database: TaskDatabase): DatabaseTaskStorage;
//# sourceMappingURL=database-task-storage.d.ts.map