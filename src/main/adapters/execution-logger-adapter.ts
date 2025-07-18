/**
 * Execution Logger Adapter
 * 
 * This module implements the execution logger interface for the task execution engine.
 */

import { PrismaClient } from '@prisma/client';
import { ExecutionLogger } from '../../shared/engines/task-execution-engine';
import { TaskError, ErrorCode } from '../../shared/types/plugin-task-system';

/**
 * Database execution logger adapter
 */
export class DatabaseExecutionLoggerAdapter implements ExecutionLogger {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log a message for an execution
   */
  async log(executionId: string, message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): Promise<void> {
    try {
      // Get the current execution
      const execution = await this.prisma.pluginTaskExecution.findUnique({
        where: { id: executionId }
      });

      if (!execution) {
        throw new Error(`Execution with ID ${executionId} not found`);
      }

      // Parse existing logs
      const logs = JSON.parse(execution.logs || '[]');

      // Add new log entry
      logs.push({
        timestamp: new Date(),
        message,
        level
      });

      // Update the execution with the new logs
      await this.prisma.pluginTaskExecution.update({
        where: { id: executionId },
        data: { logs: JSON.stringify(logs) }
      });
    } catch (error) {
      console.error(`Failed to log message for execution ${executionId}:`, error);
      // Don't throw here to prevent execution failures due to logging issues
    }
  }

  /**
   * Get logs for an execution
   */
  async getLogs(executionId: string): Promise<Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }>> {
    try {
      const execution = await this.prisma.pluginTaskExecution.findUnique({
        where: { id: executionId }
      });

      if (!execution) {
        throw new TaskError(
          ErrorCode.EXECUTION_NOT_FOUND,
          `Execution with ID ${executionId} not found`
        );
      }

      // Parse and return logs
      const logs = JSON.parse(execution.logs || '[]');
      
      // Convert string timestamps to Date objects
      return logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      }
      
      throw new TaskError(
        ErrorCode.DATABASE_ERROR,
        `Failed to get logs for execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Create a database execution logger adapter
 */
export function createDatabaseExecutionLoggerAdapter(prisma: PrismaClient): DatabaseExecutionLoggerAdapter {
  return new DatabaseExecutionLoggerAdapter(prisma);
}