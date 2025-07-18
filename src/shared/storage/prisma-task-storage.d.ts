/**
 * Prisma Database Task Storage Implementation
 *
 * This module implements the TaskDatabase interface using Prisma ORM
 * to integrate with the existing SQLite database.
 */
import { TaskDatabase, DatabaseTask, DatabaseTaskExecution } from './database-task-storage';
import { TaskFilter } from '../types/plugin-task-system';
/**
 * Prisma client interface for task operations
 * This interface abstracts the Prisma client to make testing easier
 */
export interface PrismaClient {
    pluginTask: {
        create(args: {
            data: any;
        }): Promise<any>;
        findUnique(args: {
            where: any;
        }): Promise<any>;
        findMany(args?: {
            where?: any;
            orderBy?: any;
            skip?: number;
            take?: number;
        }): Promise<any[]>;
        update(args: {
            where: any;
            data: any;
        }): Promise<any>;
        delete(args: {
            where: any;
        }): Promise<any>;
        count(args?: {
            where?: any;
        }): Promise<number>;
    };
    pluginTaskExecution: {
        create(args: {
            data: any;
        }): Promise<any>;
        findUnique(args: {
            where: any;
        }): Promise<any>;
        findMany(args?: {
            where?: any;
            orderBy?: any;
        }): Promise<any[]>;
        update(args: {
            where: any;
            data: any;
        }): Promise<any>;
        delete(args: {
            where: any;
        }): Promise<any>;
    };
}
/**
 * Prisma-based task database implementation
 */
export declare class PrismaTaskDatabase implements TaskDatabase {
    private prisma;
    constructor(prismaClient: PrismaClient);
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
    private buildTaskWhereClause;
    private convertPrismaTaskToDatabaseTask;
    private convertPrismaExecutionToDatabaseExecution;
}
/**
 * Create a Prisma task database instance
 */
export declare function createPrismaTaskDatabase(prismaClient: PrismaClient): PrismaTaskDatabase;
//# sourceMappingURL=prisma-task-storage.d.ts.map