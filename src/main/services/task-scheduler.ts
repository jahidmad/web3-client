import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { TaskEngine } from './task-engine';
import {
  Task,
  TaskExecution,
  TaskExecutionRequest
} from '../types/task';

/**
 * 任务调度类型
 */
export type ScheduleType = 'immediate' | 'delayed' | 'interval' | 'cron';

/**
 * 调度配置接口
 */
export interface ScheduleConfig {
  type: ScheduleType;
  // 对于 delayed: delay in milliseconds
  // 对于 interval: interval in milliseconds, optional iterations count
  // 对于 cron: cron expression
  config: {
    delay?: number;
    interval?: number;
    iterations?: number; // -1 for infinite
    cronExpression?: string;
    startTime?: Date;
    endTime?: Date;
  };
}

/**
 * 调度任务接口
 */
export interface ScheduledTask {
  id: string;
  taskId: string;
  scheduleConfig: ScheduleConfig;
  browserId: string;
  variables?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  nextExecutionTime?: Date;
  lastExecutionTime?: Date;
  executionCount: number;
  maxExecutions?: number;
}

/**
 * 任务调度器
 * 负责管理任务的定时执行和周期性执行
 */
export class TaskScheduler extends EventEmitter {
  private logger: Logger;
  private taskEngine: TaskEngine;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(taskEngine: TaskEngine) {
    super();
    this.logger = new Logger('TaskScheduler');
    this.taskEngine = taskEngine;
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Task scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Task scheduler started');

    // 恢复所有激活的调度任务
    await this.restoreScheduledTasks();
    
    this.emit('scheduler:started');
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Task scheduler is not running');
      return;
    }

    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.isRunning = false;
    this.logger.info('Task scheduler stopped');
    this.emit('scheduler:stopped');
  }

  /**
   * 调度任务
   */
  async scheduleTask(
    taskId: string,
    scheduleConfig: ScheduleConfig,
    browserId: string,
    variables?: Record<string, any>
  ): Promise<string> {
    // 验证任务是否存在
    const task = await this.taskEngine.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const scheduleId = uuidv4();
    const now = new Date();

    const scheduledTask: ScheduledTask = {
      id: scheduleId,
      taskId,
      scheduleConfig,
      browserId,
      variables,
      isActive: true,
      createdAt: now,
      executionCount: 0,
      nextExecutionTime: this.calculateNextExecutionTime(scheduleConfig, now)
    };

    this.scheduledTasks.set(scheduleId, scheduledTask);
    
    if (this.isRunning) {
      this.setupTimer(scheduledTask);
    }

    this.logger.info(`Scheduled task: ${task.name} (${scheduleId}) with type: ${scheduleConfig.type}`);
    this.emit('task:scheduled', scheduledTask);

    return scheduleId;
  }

  /**
   * 取消调度任务
   */
  async unscheduleTask(scheduleId: string): Promise<void> {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (!scheduledTask) {
      throw new Error(`Scheduled task not found: ${scheduleId}`);
    }

    // 清除定时器
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }

    // 标记为非激活状态
    scheduledTask.isActive = false;
    
    this.logger.info(`Unscheduled task: ${scheduleId}`);
    this.emit('task:unscheduled', scheduledTask);
  }

  /**
   * 删除调度任务
   */
  async deleteScheduledTask(scheduleId: string): Promise<void> {
    await this.unscheduleTask(scheduleId);
    this.scheduledTasks.delete(scheduleId);
    this.logger.info(`Deleted scheduled task: ${scheduleId}`);
  }

  /**
   * 获取调度任务
   */
  getScheduledTask(scheduleId: string): ScheduledTask | undefined {
    return this.scheduledTasks.get(scheduleId);
  }

  /**
   * 获取所有调度任务
   */
  getAllScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * 获取任务的调度
   */
  getTaskSchedules(taskId: string): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values())
      .filter(schedule => schedule.taskId === taskId);
  }

  /**
   * 暂停调度任务
   */
  async pauseScheduledTask(scheduleId: string): Promise<void> {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (!scheduledTask) {
      throw new Error(`Scheduled task not found: ${scheduleId}`);
    }

    scheduledTask.isActive = false;
    
    // 清除定时器
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
    }

    this.logger.info(`Paused scheduled task: ${scheduleId}`);
    this.emit('task:paused', scheduledTask);
  }

  /**
   * 恢复调度任务
   */
  async resumeScheduledTask(scheduleId: string): Promise<void> {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (!scheduledTask) {
      throw new Error(`Scheduled task not found: ${scheduleId}`);
    }

    scheduledTask.isActive = true;
    scheduledTask.nextExecutionTime = this.calculateNextExecutionTime(
      scheduledTask.scheduleConfig,
      new Date()
    );

    if (this.isRunning) {
      this.setupTimer(scheduledTask);
    }

    this.logger.info(`Resumed scheduled task: ${scheduleId}`);
    this.emit('task:resumed', scheduledTask);
  }

  /**
   * 立即执行调度任务
   */
  async executeScheduledTaskNow(scheduleId: string): Promise<TaskExecution> {
    const scheduledTask = this.scheduledTasks.get(scheduleId);
    if (!scheduledTask) {
      throw new Error(`Scheduled task not found: ${scheduleId}`);
    }

    const request: TaskExecutionRequest = {
      taskId: scheduledTask.taskId,
      browserId: scheduledTask.browserId,
      parameters: scheduledTask.variables || {}
    };

    return await this.taskEngine.executeTask(request);
  }

  /**
   * 设置定时器
   */
  private setupTimer(scheduledTask: ScheduledTask): void {
    if (!scheduledTask.isActive || !scheduledTask.nextExecutionTime) {
      return;
    }

    const now = new Date();
    const delay = scheduledTask.nextExecutionTime.getTime() - now.getTime();

    if (delay <= 0) {
      // 立即执行
      this.executeScheduledTask(scheduledTask);
      return;
    }

    const timer = setTimeout(() => {
      this.executeScheduledTask(scheduledTask);
    }, delay);

    this.timers.set(scheduledTask.id, timer);
  }

  /**
   * 执行调度任务
   */
  private async executeScheduledTask(scheduledTask: ScheduledTask): Promise<void> {
    try {
      this.logger.info(`Executing scheduled task: ${scheduledTask.id}`);

      const request: TaskExecutionRequest = {
        taskId: scheduledTask.taskId,
        browserId: scheduledTask.browserId,
        parameters: scheduledTask.variables || {}
      };

      const execution = await this.taskEngine.executeTask(request);
      
      // 更新执行统计
      scheduledTask.executionCount++;
      scheduledTask.lastExecutionTime = new Date();

      this.emit('task:executed', { scheduledTask, execution });

      // 检查是否需要继续调度
      if (this.shouldContinueScheduling(scheduledTask)) {
        scheduledTask.nextExecutionTime = this.calculateNextExecutionTime(
          scheduledTask.scheduleConfig,
          new Date()
        );
        
        if (scheduledTask.nextExecutionTime) {
          this.setupTimer(scheduledTask);
        }
      } else {
        // 调度完成
        scheduledTask.isActive = false;
        this.logger.info(`Scheduled task completed: ${scheduledTask.id}`);
        this.emit('task:completed', scheduledTask);
      }

    } catch (error) {
      this.logger.error(`Failed to execute scheduled task ${scheduledTask.id}:`, error);
      this.emit('task:error', { scheduledTask, error });
    }
  }

  /**
   * 计算下次执行时间
   */
  private calculateNextExecutionTime(config: ScheduleConfig, baseTime: Date): Date | undefined {
    const now = baseTime.getTime();

    switch (config.type) {
      case 'immediate':
        return baseTime;

      case 'delayed':
        if (config.config.delay) {
          return new Date(now + config.config.delay);
        }
        break;

      case 'interval':
        if (config.config.interval) {
          return new Date(now + config.config.interval);
        }
        break;

      case 'cron':
        // 简化的cron实现，实际项目中可以使用node-cron等库
        if (config.config.cronExpression) {
          return this.parseCronExpression(config.config.cronExpression, baseTime);
        }
        break;
    }

    return undefined;
  }

  /**
   * 简化的cron表达式解析（实际项目建议使用专业库）
   */
  private parseCronExpression(expression: string, baseTime: Date): Date {
    // 这里是一个简化的实现，仅支持基本格式
    // 实际项目中应该使用 node-cron 或 cron-parser 等库
    
    // 示例：每小时执行一次
    if (expression === '0 * * * *') {
      const next = new Date(baseTime);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next;
    }

    // 示例：每天执行一次（凌晨0点）
    if (expression === '0 0 * * *') {
      const next = new Date(baseTime);
      next.setHours(0, 0, 0, 0);
      next.setDate(next.getDate() + 1);
      return next;
    }

    // 默认1小时后执行
    return new Date(baseTime.getTime() + 60 * 60 * 1000);
  }

  /**
   * 检查是否应该继续调度
   */
  private shouldContinueScheduling(scheduledTask: ScheduledTask): boolean {
    const config = scheduledTask.scheduleConfig;

    // 检查最大执行次数
    if (scheduledTask.maxExecutions && 
        scheduledTask.executionCount >= scheduledTask.maxExecutions) {
      return false;
    }

    // 检查迭代次数（仅对interval类型有效）
    if (config.type === 'interval' && 
        config.config.iterations && 
        config.config.iterations > 0 && 
        scheduledTask.executionCount >= config.config.iterations) {
      return false;
    }

    // 检查结束时间
    if (config.config.endTime && new Date() >= config.config.endTime) {
      return false;
    }

    // immediate和delayed类型只执行一次
    if (config.type === 'immediate' || config.type === 'delayed') {
      return false;
    }

    return true;
  }

  /**
   * 恢复所有激活的调度任务
   */
  private async restoreScheduledTasks(): Promise<void> {
    const activeTasks = Array.from(this.scheduledTasks.values())
      .filter(task => task.isActive);

    for (const task of activeTasks) {
      // 重新计算下次执行时间
      task.nextExecutionTime = this.calculateNextExecutionTime(
        task.scheduleConfig,
        new Date()
      );

      if (task.nextExecutionTime) {
        this.setupTimer(task);
      }
    }

    this.logger.info(`Restored ${activeTasks.length} scheduled tasks`);
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    isRunning: boolean;
    totalScheduledTasks: number;
    activeScheduledTasks: number;
    upcomingExecutions: Array<{ scheduleId: string; taskId: string; nextExecution: Date }>;
  } {
    const activeTasks = Array.from(this.scheduledTasks.values())
      .filter(task => task.isActive);

    const upcomingExecutions = activeTasks
      .filter(task => task.nextExecutionTime)
      .map(task => ({
        scheduleId: task.id,
        taskId: task.taskId,
        nextExecution: task.nextExecutionTime!
      }))
      .sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime())
      .slice(0, 10); // 显示最近10个

    return {
      isRunning: this.isRunning,
      totalScheduledTasks: this.scheduledTasks.size,
      activeScheduledTasks: activeTasks.length,
      upcomingExecutions
    };
  }
}