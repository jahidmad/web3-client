/**
 * Plugin Task Integration
 * 
 * This module integrates all the plugin task system services and provides
 * a unified API for the main process to interact with the plugin task system.
 */

import { PrismaClient } from '@prisma/client';
import { BrowserManager } from './browser-manager';
import { BrowserTaskService } from './browser-task-service';
import { TaskExecutionService } from './task-execution-service';
import { TaskExecutionScheduler } from '../../shared/schedulers/task-execution-scheduler';
import { NpmDependencyInstaller } from './npm-dependency-installer';
import { DependencyCacheManager } from './dependency-cache-manager';
import { DependencyStatusChecker } from './dependency-status-checker';
import { TaskManager } from '../../shared/managers/task-manager';
import { createPrismaTaskDatabase } from '../../shared/storage/prisma-task-storage';
import { DatabaseTaskStorage } from '../../shared/storage/database-task-storage';

/**
 * Plugin Task Integration - Main integration point for the plugin task system
 */
export class PluginTaskIntegration {
  private browserManager: BrowserManager;
  private prisma: PrismaClient;
  private browserTaskService: BrowserTaskService;
  private taskExecutionService: TaskExecutionService;
  private taskExecutionScheduler: TaskExecutionScheduler;
  private npmDependencyInstaller: NpmDependencyInstaller;
  private dependencyCacheManager: DependencyCacheManager;
  private dependencyStatusChecker: DependencyStatusChecker;
  private taskManager: TaskManager;

  constructor(browserManager: BrowserManager, prisma: PrismaClient) {
    this.browserManager = browserManager;
    this.prisma = prisma;
    
    // Create the npm dependency installer
    this.npmDependencyInstaller = new NpmDependencyInstaller();
    
    // Create the dependency cache manager
    this.dependencyCacheManager = new DependencyCacheManager();
    
    // Create the dependency status checker
    this.dependencyStatusChecker = new DependencyStatusChecker(
      this.npmDependencyInstaller,
      this.dependencyCacheManager
    );
    
    // Create the browser task service
    this.browserTaskService = new BrowserTaskService(browserManager, prisma);
    
    // Create the task execution service
    this.taskExecutionService = new TaskExecutionService(browserManager, prisma);
    
    // Create the task execution scheduler
    this.taskExecutionScheduler = new TaskExecutionScheduler(this.taskExecutionService);
    
    // Create the task manager with database storage
    const prismaTaskDatabase = createPrismaTaskDatabase(prisma);
    const taskStorage = new DatabaseTaskStorage(prismaTaskDatabase);
    this.taskManager = new TaskManager(taskStorage);
  }

  /**
   * Initialize the plugin task integration
   */
  async initialize(): Promise<void> {
    // Initialize the npm dependency installer
    await this.npmDependencyInstaller.initialize();
    
    // Initialize the dependency cache manager
    await this.dependencyCacheManager.initialize();
    
    // Initialize the services
    await this.browserTaskService.initialize();
    
    console.log('[PluginTaskIntegration] Initialized');
  }

  /**
   * Get the browser task service
   */
  getBrowserTaskService(): BrowserTaskService {
    return this.browserTaskService;
  }

  /**
   * Get the task execution service
   */
  getTaskExecutionService(): TaskExecutionService {
    return this.taskExecutionService;
  }

  /**
   * Get the task execution scheduler
   */
  getTaskExecutionScheduler(): TaskExecutionScheduler {
    return this.taskExecutionScheduler;
  }

  /**
   * Get the npm dependency installer
   */
  getNpmDependencyInstaller(): NpmDependencyInstaller {
    return this.npmDependencyInstaller;
  }
  
  /**
   * Get the task manager
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
  
  /**
   * Get the dependency cache manager
   */
  getDependencyCacheManager(): DependencyCacheManager {
    return this.dependencyCacheManager;
  }
  
  /**
   * Get the dependency status checker
   */
  getDependencyStatusChecker(): DependencyStatusChecker {
    return this.dependencyStatusChecker;
  }
}

/**
 * Create a plugin task integration
 */
export function createPluginTaskIntegration(
  browserManager: BrowserManager,
  prisma: PrismaClient
): PluginTaskIntegration {
  return new PluginTaskIntegration(browserManager, prisma);
}