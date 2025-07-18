/**
 * Plugin Task IPC Handlers
 * 
 * This module defines the IPC handlers for the plugin task system.
 */

import { ipcMain } from 'electron';
import { PluginTaskIntegration } from '../services/plugin-task-integration';
import { DependencyInstallRequest, TaskFilter, TaskExportOptions } from '../../shared/types';
import { DependencyInfo } from '../../shared/types/dependency-status';

/**
 * Register all plugin task IPC handlers
 */
export function registerPluginTaskHandlers(integration: PluginTaskIntegration): void {
  const browserTaskService = integration.getBrowserTaskService();
  const taskExecutionService = integration.getTaskExecutionService();
  const taskExecutionScheduler = integration.getTaskExecutionScheduler();
  const npmDependencyInstaller = integration.getNpmDependencyInstaller();
  const taskManager = integration.getTaskManager();

  // Browser task execution
  ipcMain.handle('plugin-task:execute-in-browser', async (_, request, task) => {
    return await browserTaskService.executeTask(request, task);
  });

  ipcMain.handle('plugin-task:get-available-browsers', async () => {
    return await browserTaskService.getAvailableBrowsers();
  });

  // Task execution
  ipcMain.handle('plugin-task:execute', async (_, request, task) => {
    return await taskExecutionService.executeTask(request, task);
  });

  ipcMain.handle('plugin-task:stop-execution', async (_, executionId) => {
    return await taskExecutionService.stopExecution(executionId);
  });

  ipcMain.handle('plugin-task:get-execution', async (_, executionId) => {
    return await taskExecutionService.getExecution(executionId);
  });

  ipcMain.handle('plugin-task:get-executions', async (_, taskId) => {
    return await taskExecutionService.getExecutions(taskId);
  });

  // Task scheduling
  ipcMain.handle('plugin-task:schedule', async (_, request, task, priority) => {
    return await taskExecutionScheduler.scheduleExecution(request, task, priority);
  });

  ipcMain.handle('plugin-task:cancel-scheduled', async (_, queueId) => {
    return await taskExecutionScheduler.cancelExecution(queueId);
  });

  ipcMain.handle('plugin-task:get-queue-status', async () => {
    return taskExecutionScheduler.getQueueStatus();
  });

  ipcMain.handle('plugin-task:get-scheduled-execution', async (_, queueId) => {
    return await taskExecutionScheduler.getExecutionByQueueId(queueId);
  });

  ipcMain.handle('plugin-task:clear-queue', async () => {
    taskExecutionScheduler.clearQueue();
  });

  // Task CRUD operations
  ipcMain.handle('plugin-task:upload', async (_, file: Buffer, filename: string) => {
    return await taskManager.uploadTask(file, filename);
  });

  ipcMain.handle('plugin-task:get-all', async (_, filter?: TaskFilter) => {
    return await taskManager.getTasks(filter);
  });

  ipcMain.handle('plugin-task:get-by-id', async (_, taskId: string) => {
    return await taskManager.getTask(taskId);
  });

  ipcMain.handle('plugin-task:update', async (_, taskId: string, updates: any) => {
    return await taskManager.updateTask(taskId, updates);
  });

  ipcMain.handle('plugin-task:delete', async (_, taskId: string) => {
    return await taskManager.deleteTask(taskId);
  });

  ipcMain.handle('plugin-task:search', async (_, query: string, filter?: TaskFilter) => {
    return await taskManager.searchTasks(query, filter);
  });

  ipcMain.handle('plugin-task:count', async (_, filter?: TaskFilter) => {
    return await taskManager.getTaskCount(filter);
  });
  
  // Task export/import
  ipcMain.handle('plugin-task:export', async (_, taskId: string, options?: TaskExportOptions) => {
    return await taskManager.exportTask(taskId, options);
  });
  
  ipcMain.handle('plugin-task:export-multiple', async (_, taskIds: string[], options?: TaskExportOptions) => {
    return await taskManager.exportMultipleTasks(taskIds, options);
  });

  // Dependency management
  ipcMain.handle('plugin-task:install-dependencies', async (_, request: DependencyInstallRequest) => {
    return await npmDependencyInstaller.installDependencies(request);
  });

  ipcMain.handle('plugin-task:check-dependency', async (_, dependency: string, taskId: string) => {
    return await npmDependencyInstaller.checkDependency(dependency, taskId);
  });

  ipcMain.handle('plugin-task:cleanup-task-dependencies', async (_, taskId: string) => {
    return await npmDependencyInstaller.cleanupTaskDependencies(taskId);
  });

  ipcMain.handle('plugin-task:cleanup-all-dependencies', async () => {
    return await npmDependencyInstaller.cleanupAllDependencies();
  });
  
  // Dependency status and cache management
  const dependencyStatusChecker = integration.getDependencyStatusChecker();
  const dependencyCacheManager = integration.getDependencyCacheManager();
  
  ipcMain.handle('plugin-task:check-dependency-status', async (_, dependency: string, taskId: string) => {
    return await dependencyStatusChecker.checkDependencyStatus(dependency, taskId);
  });
  
  ipcMain.handle('plugin-task:check-dependency-health', async (_, dependency: string, taskId: string) => {
    return await dependencyStatusChecker.checkDependencyHealth(dependency, taskId);
  });
  
  ipcMain.handle('plugin-task:check-task-dependencies', async (_, taskId: string, dependencies: string[]) => {
    return await dependencyStatusChecker.checkTaskDependencies(taskId, dependencies);
  });
  
  ipcMain.handle('plugin-task:check-dependency-conflicts', async (_, taskId: string, dependencies: string[]) => {
    return await dependencyStatusChecker.checkDependencyConflicts(taskId, dependencies);
  });
  
  ipcMain.handle('plugin-task:get-cached-dependency', async (_, name: string, version: string) => {
    return await dependencyCacheManager.getCachedDependency(name, version);
  });
  
  ipcMain.handle('plugin-task:add-to-cache', async (_, dependency: DependencyInfo, taskId: string) => {
    return await dependencyCacheManager.addToCache(dependency, taskId);
  });
  
  ipcMain.handle('plugin-task:remove-from-cache', async (_, name: string, version: string) => {
    return await dependencyCacheManager.removeFromCache(name, version);
  });
  
  ipcMain.handle('plugin-task:get-cache-stats', async () => {
    return dependencyCacheManager.getCacheStats();
  });
  
  ipcMain.handle('plugin-task:cleanup-cache', async () => {
    return await dependencyCacheManager.cleanupCache();
  });

  console.log('[IPC] Plugin task handlers registered');
}

/**
 * Unregister all plugin task IPC handlers
 */
export function unregisterPluginTaskHandlers(): void {
  // Browser task execution
  ipcMain.removeHandler('plugin-task:execute-in-browser');
  ipcMain.removeHandler('plugin-task:get-available-browsers');

  // Task execution
  ipcMain.removeHandler('plugin-task:execute');
  ipcMain.removeHandler('plugin-task:stop-execution');
  ipcMain.removeHandler('plugin-task:get-execution');
  ipcMain.removeHandler('plugin-task:get-executions');

  // Task scheduling
  ipcMain.removeHandler('plugin-task:schedule');
  ipcMain.removeHandler('plugin-task:cancel-scheduled');
  ipcMain.removeHandler('plugin-task:get-queue-status');
  ipcMain.removeHandler('plugin-task:get-scheduled-execution');
  ipcMain.removeHandler('plugin-task:clear-queue');

  // Task CRUD operations
  ipcMain.removeHandler('plugin-task:upload');
  ipcMain.removeHandler('plugin-task:get-all');
  ipcMain.removeHandler('plugin-task:get-by-id');
  ipcMain.removeHandler('plugin-task:update');
  ipcMain.removeHandler('plugin-task:delete');
  ipcMain.removeHandler('plugin-task:search');
  ipcMain.removeHandler('plugin-task:count');
  
  // Task export/import
  ipcMain.removeHandler('plugin-task:export');
  ipcMain.removeHandler('plugin-task:export-multiple');

  // Dependency management
  ipcMain.removeHandler('plugin-task:install-dependencies');
  ipcMain.removeHandler('plugin-task:check-dependency');
  ipcMain.removeHandler('plugin-task:cleanup-task-dependencies');
  ipcMain.removeHandler('plugin-task:cleanup-all-dependencies');

  // Dependency status and cache management
  ipcMain.removeHandler('plugin-task:check-dependency-status');
  ipcMain.removeHandler('plugin-task:check-dependency-health');
  ipcMain.removeHandler('plugin-task:check-task-dependencies');
  ipcMain.removeHandler('plugin-task:check-dependency-conflicts');
  ipcMain.removeHandler('plugin-task:get-cached-dependency');
  ipcMain.removeHandler('plugin-task:add-to-cache');
  ipcMain.removeHandler('plugin-task:remove-from-cache');
  ipcMain.removeHandler('plugin-task:get-cache-stats');
  ipcMain.removeHandler('plugin-task:cleanup-cache');

  console.log('[IPC] Plugin task handlers unregistered');
}