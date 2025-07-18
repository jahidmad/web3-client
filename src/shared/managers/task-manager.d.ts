/**
 * Task Manager - Core CRUD Operations
 *
 * This module implements the core task management functionality including
 * create, read, update, delete operations for tasks, along with file upload,
 * parsing, validation, and storage management.
 */
import { Task, TaskFilter, TaskStatus, TaskManager as ITaskManager, TaskImportResult, TaskImportOptions, TaskExportOptions, ExecutionRequest, Execution, DependencyStatus, DependencyInstallRequest, DependencyInstallResult } from '../types/plugin-task-system';
/**
 * Interface for task storage operations
 */
export interface TaskStorage {
    create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findMany(filter?: TaskFilter): Promise<Task[]>;
    update(id: string, updates: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
    createMany(tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Task[]>;
    deleteMany(ids: string[]): Promise<void>;
    search(query: string, filter?: TaskFilter): Promise<Task[]>;
    count(filter?: TaskFilter): Promise<number>;
}
/**
 * In-memory task storage implementation for development/testing
 */
export declare class InMemoryTaskStorage implements TaskStorage {
    private tasks;
    private nextId;
    create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findMany(filter?: TaskFilter): Promise<Task[]>;
    update(id: string, updates: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<void>;
    createMany(tasksData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Task[]>;
    deleteMany(ids: string[]): Promise<void>;
    search(query: string, filter?: TaskFilter): Promise<Task[]>;
    count(filter?: TaskFilter): Promise<number>;
    private applyFilter;
}
/**
 * Main task manager implementation
 */
export declare class TaskManager implements ITaskManager {
    private storage;
    constructor(storage?: TaskStorage);
    /**
     * Upload and parse a task file
     */
    uploadTask(file: Buffer, filename: string): Promise<Task>;
    /**
     * Get all tasks with optional filtering
     */
    getTasks(filter?: TaskFilter): Promise<Task[]>;
    /**
     * Get a specific task by ID
     */
    getTask(taskId: string): Promise<Task | null>;
    /**
     * Search tasks by query string
     */
    searchTasks(query: string, filter?: TaskFilter): Promise<Task[]>;
    /**
     * Get task count with optional filtering
     */
    getTaskCount(filter?: TaskFilter): Promise<number>;
    /**
     * Update a task
     */
    updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
    /**
     * Delete a task
     */
    deleteTask(taskId: string): Promise<void>;
    /**
     * Get tasks by category
     */
    getTasksByCategory(category: string): Promise<Task[]>;
    /**
     * Get tasks by status
     */
    getTasksByStatus(status: TaskStatus): Promise<Task[]>;
    /**
     * Get tasks by author
     */
    getTasksByAuthor(author: string): Promise<Task[]>;
    /**
     * Get tasks by tags
     */
    getTasksByTags(tags: string[]): Promise<Task[]>;
    /**
     * Upload multiple task files
     */
    uploadMultipleTasks(files: Array<{
        buffer: Buffer;
        filename: string;
    }>): Promise<{
        successful: Task[];
        failed: Array<{
            filename: string;
            error: string;
        }>;
    }>;
    /**
     * Delete multiple tasks
     */
    deleteMultipleTasks(taskIds: string[]): Promise<{
        successful: string[];
        failed: Array<{
            taskId: string;
            error: string;
        }>;
    }>;
    /**
     * Update task status for multiple tasks
     */
    updateMultipleTaskStatus(taskIds: string[], status: TaskStatus): Promise<{
        successful: Task[];
        failed: Array<{
            taskId: string;
            error: string;
        }>;
    }>;
    /**
     * Convert TaskFile to Task data structure
     */
    private convertTaskFileToTask;
    /**
     * Validate task data before operations
     */
    private validateTaskData;
    /**
     * Execute a task (placeholder - will be implemented in task execution engine)
     */
    executeTask(request: ExecutionRequest): Promise<Execution>;
    /**
     * Stop task execution (placeholder)
     */
    stopExecution(executionId: string): Promise<void>;
    /**
     * Get execution details (placeholder)
     */
    getExecution(executionId: string): Promise<Execution | null>;
    /**
     * Get executions for a task (placeholder)
     */
    getExecutions(taskId?: string): Promise<Execution[]>;
    /**
     * Check task dependencies (placeholder)
     */
    checkDependencies(taskId: string): Promise<DependencyStatus>;
    /**
     * Install task dependencies (placeholder)
     */
    installDependencies(request: DependencyInstallRequest): Promise<DependencyInstallResult>;
    /**
     * Cleanup dependencies (placeholder)
     */
    cleanupDependencies(): Promise<void>;
    /**
     * Export task as a portable file
     *
     * @param taskId The ID of the task to export
     * @param options Export options
     * @returns Buffer containing the exported task
     */
    exportTask(taskId: string, options?: TaskExportOptions): Promise<Buffer>;
    /**
     * Export multiple tasks as a zip archive
     *
     * @param taskIds Array of task IDs to export
     * @param options Export options
     * @returns Buffer containing the exported tasks as a zip archive
     */
    exportMultipleTasks(taskIds: string[], options?: TaskExportOptions): Promise<Buffer>;
    /**
     * Generate task file content from a task object
     *
     * @param task The task to generate content for
     * @param options Export options
     * @returns String containing the task file content
     */
    private generateTaskFileContent;
    /**
     * Generate JSDoc metadata block from task properties
     *
     * @param task The task to generate metadata for
     * @returns String containing the JSDoc metadata block
     */
    private generateMetadataBlock;
    /**
     * Generate parameters declaration block
     *
     * @param parameters The parameters to include
     * @param prettify Whether to prettify the output
     * @returns String containing the parameters declaration
     */
    private generateParametersBlock;
    /**
     * Generate dependencies declaration block
     *
     * @param dependencies The dependencies to include
     * @param prettify Whether to prettify the output
     * @returns String containing the dependencies declaration
     */
    private generateDependenciesBlock;
    /**
     * Generate config declaration block
     *
     * @param config The config to include
     * @param prettify Whether to prettify the output
     * @returns String containing the config declaration
     */
    private generateConfigBlock;
    /**
     * Extract execute function from task code
     *
     * @param code The full task code
     * @returns String containing just the execute function
     */
    private extractExecuteFunction;
    /**
     * Import task (placeholder)
     */
    importTask(data: Buffer, options?: TaskImportOptions): Promise<TaskImportResult>;
    /**
     * Import task from URL (placeholder)
     */
    importTaskFromUrl(url: string, options?: TaskImportOptions): Promise<TaskImportResult>;
}
/**
 * Create a new task manager with default storage
 */
export declare function createTaskManager(storage?: TaskStorage): TaskManager;
/**
 * Create a task manager with in-memory storage (for testing)
 */
export declare function createInMemoryTaskManager(): TaskManager;
//# sourceMappingURL=task-manager.d.ts.map