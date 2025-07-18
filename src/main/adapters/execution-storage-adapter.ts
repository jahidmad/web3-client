/**
 * Execution Storage Adapter
 * 
 * This module adapts the database task storage to the execution storage interface
 * required by the task execution engine.
 */

import { PrismaClient } from '@prisma/client';
import { ExecutionStorage } from '../../shared/engines/task-execution-engine';
import { 
  Execution, 
  ExecutionStatus, 
  TaskError, 
  ErrorCode 
} from '../../shared/types/plugin-task-system';

/**
 * Database execution storage adapter
 */
export class DatabaseExecutionStorageAdapter implements ExecutionStorage {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new execution record
   */
  async createExecution(executionData: Omit<Execution, 'id'>): Promise<Execution> {
    try {
      const result = await this.prisma.pluginTaskExecution.create({
        data: {
          taskId: executionData.taskId,
          browserId: executionData.browserId,
          status: executionData.status,
          parameters: JSON.stringify(executionData.parameters),
          startTime: executionData.startTime,
          endTime: executionData.endTime,
          duration: executionData.duration,
          progress: executionData.progress,
          progressMessage: executionData.progressMessage,
          logs: executionData.logs ? JSON.stringify(executionData.logs) : '[]',
          result: executionData.result ? JSON.stringify(executionData.result) : null,
          error: executionData.error,
          memoryUsage: executionData.memoryUsage,
          cpuUsage: executionData.cpuUsage
        }
      });

      return this.convertDatabaseExecutionToExecution(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to create execution record: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Update an execution record
   */
  async updateExecution(id: string, updates: Partial<Execution>): Promise<Execution> {
    try {
      const data: any = {};
      
      if (updates.status !== undefined) data.status = updates.status;
      if (updates.endTime !== undefined) data.endTime = updates.endTime;
      if (updates.duration !== undefined) data.duration = updates.duration;
      if (updates.progress !== undefined) data.progress = updates.progress;
      if (updates.progressMessage !== undefined) data.progressMessage = updates.progressMessage;
      if (updates.logs !== undefined) data.logs = JSON.stringify(updates.logs);
      if (updates.result !== undefined) data.result = JSON.stringify(updates.result);
      if (updates.error !== undefined) data.error = updates.error;
      if (updates.memoryUsage !== undefined) data.memoryUsage = updates.memoryUsage;
      if (updates.cpuUsage !== undefined) data.cpuUsage = updates.cpuUsage;

      const result = await this.prisma.pluginTaskExecution.update({
        where: { id },
        data
      });

      return this.convertDatabaseExecutionToExecution(result);
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to update execution record: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get an execution record by ID
   */
  async getExecution(id: string): Promise<Execution | null> {
    try {
      const result = await this.prisma.pluginTaskExecution.findUnique({
        where: { id }
      });

      return result ? this.convertDatabaseExecutionToExecution(result) : null;
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to get execution record: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get execution records for a task
   */
  async getExecutions(taskId?: string): Promise<Execution[]> {
    try {
      const where = taskId ? { taskId } : undefined;
      const results = await this.prisma.pluginTaskExecution.findMany({
        where,
        orderBy: { startTime: 'desc' as const }
      });

      return results.map(result => this.convertDatabaseExecutionToExecution(result));
    } catch (error) {
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to get execution records: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert database execution record to Execution object
   */
  private convertDatabaseExecutionToExecution(dbExecution: any): Execution {
    return {
      id: dbExecution.id,
      taskId: dbExecution.taskId,
      browserId: dbExecution.browserId,
      status: dbExecution.status as ExecutionStatus,
      parameters: JSON.parse(dbExecution.parameters || '{}'),
      startTime: dbExecution.startTime,
      endTime: dbExecution.endTime,
      duration: dbExecution.duration,
      progress: dbExecution.progress,
      progressMessage: dbExecution.progressMessage,
      logs: JSON.parse(dbExecution.logs || '[]'),
      result: dbExecution.result ? JSON.parse(dbExecution.result) : undefined,
      error: dbExecution.error,
      memoryUsage: dbExecution.memoryUsage,
      cpuUsage: dbExecution.cpuUsage
    };
  }
}

/**
 * Create a database execution storage adapter
 */
export function createDatabaseExecutionStorageAdapter(prisma: PrismaClient): DatabaseExecutionStorageAdapter {
  return new DatabaseExecutionStorageAdapter(prisma);
}