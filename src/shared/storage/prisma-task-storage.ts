/**
 * Prisma Database Task Storage Implementation
 * 
 * This module implements the TaskDatabase interface using Prisma ORM
 * to integrate with the existing SQLite database.
 */

import { TaskDatabase, DatabaseTask, DatabaseTaskExecution } from './database-task-storage';
import { TaskFilter, TaskError, ErrorCode } from '../types/plugin-task-system';

// ============================================================================
// PRISMA CLIENT INTERFACE
// ============================================================================

/**
 * Prisma client interface for task operations
 * This interface abstracts the Prisma client to make testing easier
 */
export interface PrismaClient {
  pluginTask: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: any }): Promise<any>;
    findMany(args?: { where?: any; orderBy?: any; skip?: number; take?: number }): Promise<any[]>;
    update(args: { where: any; data: any }): Promise<any>;
    delete(args: { where: any }): Promise<any>;
    count(args?: { where?: any }): Promise<number>;
  };
  pluginTaskExecution: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: any }): Promise<any>;
    findMany(args?: { where?: any; orderBy?: any }): Promise<any[]>;
    update(args: { where: any; data: any }): Promise<any>;
    delete(args: { where: any }): Promise<any>;
  };
}

// ============================================================================
// PRISMA TASK DATABASE IMPLEMENTATION
// ============================================================================

/**
 * Prisma-based task database implementation
 */
export class PrismaTaskDatabase implements TaskDatabase {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  // ============================================================================
  // TASK OPERATIONS
  // ============================================================================

  async createTask(taskData: Omit<DatabaseTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseTask> {
    try {
      const result = await this.prisma.pluginTask.create({
        data: {
          name: taskData.name,
          description: taskData.description,
          version: taskData.version,
          author: taskData.author,
          category: taskData.category,
          tags: taskData.tags,
          icon: taskData.icon,
          parameters: taskData.parameters,
          dependencies: taskData.dependencies,
          config: taskData.config,
          code: taskData.code,
          status: taskData.status
        }
      });

      return this.convertPrismaTaskToDatabaseTask(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create task in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findTaskById(id: string): Promise<DatabaseTask | null> {
    try {
      const result = await this.prisma.pluginTask.findUnique({
        where: { id }
      });

      return result ? this.convertPrismaTaskToDatabaseTask(result) : null;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find task in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findTasks(filter?: TaskFilter): Promise<DatabaseTask[]> {
    try {
      const where = this.buildTaskWhereClause(filter);
      const orderBy = { createdAt: 'desc' as const };
      const skip = filter?.offset;
      const take = filter?.limit;

      const results = await this.prisma.pluginTask.findMany({
        where,
        orderBy,
        skip,
        take
      });

      return results.map(result => this.convertPrismaTaskToDatabaseTask(result));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find tasks in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateTask(id: string, updates: Partial<DatabaseTask>): Promise<DatabaseTask> {
    try {
      const data: any = {};
      
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.version !== undefined) data.version = updates.version;
      if (updates.author !== undefined) data.author = updates.author;
      if (updates.category !== undefined) data.category = updates.category;
      if (updates.tags !== undefined) data.tags = updates.tags;
      if (updates.icon !== undefined) data.icon = updates.icon;
      if (updates.parameters !== undefined) data.parameters = updates.parameters;
      if (updates.dependencies !== undefined) data.dependencies = updates.dependencies;
      if (updates.config !== undefined) data.config = updates.config;
      if (updates.code !== undefined) data.code = updates.code;
      if (updates.status !== undefined) data.status = updates.status;

      const result = await this.prisma.pluginTask.update({
        where: { id },
        data
      });

      return this.convertPrismaTaskToDatabaseTask(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to update task in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      await this.prisma.pluginTask.delete({
        where: { id }
      });
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to delete task from database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async searchTasks(query: string, filter?: TaskFilter): Promise<DatabaseTask[]> {
    try {
      const searchWhere = {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
          { author: { contains: query, mode: 'insensitive' as const } },
          { category: { contains: query, mode: 'insensitive' as const } },
          { tags: { contains: query, mode: 'insensitive' as const } }
        ]
      };

      const filterWhere = this.buildTaskWhereClause(filter);
      const where = filterWhere ? { AND: [searchWhere, filterWhere] } : searchWhere;

      const results = await this.prisma.pluginTask.findMany({
        where,
        orderBy: { createdAt: 'desc' as const },
        skip: filter?.offset,
        take: filter?.limit
      });

      return results.map(result => this.convertPrismaTaskToDatabaseTask(result));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to search tasks in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async countTasks(filter?: TaskFilter): Promise<number> {
    try {
      const where = this.buildTaskWhereClause(filter);
      return await this.prisma.pluginTask.count({ where });
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to count tasks in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // EXECUTION OPERATIONS
  // ============================================================================

  async createExecution(executionData: Omit<DatabaseTaskExecution, 'id'>): Promise<DatabaseTaskExecution> {
    try {
      const result = await this.prisma.pluginTaskExecution.create({
        data: {
          taskId: executionData.taskId,
          browserId: executionData.browserId,
          status: executionData.status,
          parameters: executionData.parameters,
          startTime: executionData.startTime,
          endTime: executionData.endTime,
          duration: executionData.duration,
          progress: executionData.progress,
          progressMessage: executionData.progressMessage,
          logs: executionData.logs,
          result: executionData.result,
          error: executionData.error,
          memoryUsage: executionData.memoryUsage,
          cpuUsage: executionData.cpuUsage
        }
      });

      return this.convertPrismaExecutionToDatabaseExecution(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create execution in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findExecutionById(id: string): Promise<DatabaseTaskExecution | null> {
    try {
      const result = await this.prisma.pluginTaskExecution.findUnique({
        where: { id }
      });

      return result ? this.convertPrismaExecutionToDatabaseExecution(result) : null;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find execution in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findExecutions(taskId?: string): Promise<DatabaseTaskExecution[]> {
    try {
      const where = taskId ? { taskId } : undefined;
      const results = await this.prisma.pluginTaskExecution.findMany({
        where,
        orderBy: { startTime: 'desc' as const }
      });

      return results.map(result => this.convertPrismaExecutionToDatabaseExecution(result));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to find executions in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async updateExecution(id: string, updates: Partial<DatabaseTaskExecution>): Promise<DatabaseTaskExecution> {
    try {
      const data: any = {};
      
      if (updates.status !== undefined) data.status = updates.status;
      if (updates.endTime !== undefined) data.endTime = updates.endTime;
      if (updates.duration !== undefined) data.duration = updates.duration;
      if (updates.progress !== undefined) data.progress = updates.progress;
      if (updates.progressMessage !== undefined) data.progressMessage = updates.progressMessage;
      if (updates.logs !== undefined) data.logs = updates.logs;
      if (updates.result !== undefined) data.result = updates.result;
      if (updates.error !== undefined) data.error = updates.error;
      if (updates.memoryUsage !== undefined) data.memoryUsage = updates.memoryUsage;
      if (updates.cpuUsage !== undefined) data.cpuUsage = updates.cpuUsage;

      const result = await this.prisma.pluginTaskExecution.update({
        where: { id },
        data
      });

      return this.convertPrismaExecutionToDatabaseExecution(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to update execution in database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async deleteExecution(id: string): Promise<void> {
    try {
      await this.prisma.pluginTaskExecution.delete({
        where: { id }
      });
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to delete execution from database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private buildTaskWhereClause(filter?: TaskFilter): any {
    if (!filter) return undefined;

    const where: any = {};

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.author) {
      where.author = filter.author;
    }

    if (filter.tags && filter.tags.length > 0) {
      // For SQLite, we need to use string contains for JSON array search
      where.OR = filter.tags.map(tag => ({
        tags: { contains: `"${tag}"` }
      }));
    }

    if (filter.search) {
      const searchCondition = {
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' as const } },
          { description: { contains: filter.search, mode: 'insensitive' as const } },
          { author: { contains: filter.search, mode: 'insensitive' as const } }
        ]
      };

      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition];
        delete where.OR;
      } else {
        Object.assign(where, searchCondition);
      }
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private convertPrismaTaskToDatabaseTask(prismaTask: any): DatabaseTask {
    return {
      id: prismaTask.id,
      name: prismaTask.name,
      description: prismaTask.description,
      version: prismaTask.version,
      author: prismaTask.author,
      category: prismaTask.category,
      tags: prismaTask.tags,
      icon: prismaTask.icon,
      parameters: prismaTask.parameters,
      dependencies: prismaTask.dependencies,
      config: prismaTask.config,
      code: prismaTask.code,
      status: prismaTask.status,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt
    };
  }

  private convertPrismaExecutionToDatabaseExecution(prismaExecution: any): DatabaseTaskExecution {
    return {
      id: prismaExecution.id,
      taskId: prismaExecution.taskId,
      browserId: prismaExecution.browserId,
      status: prismaExecution.status,
      parameters: prismaExecution.parameters,
      startTime: prismaExecution.startTime,
      endTime: prismaExecution.endTime,
      duration: prismaExecution.duration,
      progress: prismaExecution.progress,
      progressMessage: prismaExecution.progressMessage,
      logs: prismaExecution.logs,
      result: prismaExecution.result,
      error: prismaExecution.error,
      memoryUsage: prismaExecution.memoryUsage,
      cpuUsage: prismaExecution.cpuUsage
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a Prisma task database instance
 */
export function createPrismaTaskDatabase(prismaClient: PrismaClient): PrismaTaskDatabase {
  return new PrismaTaskDatabase(prismaClient);
}