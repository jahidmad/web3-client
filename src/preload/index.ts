import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  browser: {
    create: (config: any) => ipcRenderer.invoke('browser:create', config),
    open: (id: string) => ipcRenderer.invoke('browser:open', id),
    close: (id: string) => ipcRenderer.invoke('browser:close', id),
    delete: (id: string) => ipcRenderer.invoke('browser:delete', id),
    list: () => ipcRenderer.invoke('browser:list'),
    status: (id: string) => ipcRenderer.invoke('browser:status', id),
    refresh: () => ipcRenderer.invoke('browser:refresh'),
    batchOperation: (action: any) => ipcRenderer.invoke('browser:batch', action),
    platformAvailability: () => ipcRenderer.invoke('browser:platforms'),
    getBrowsers: () => ipcRenderer.invoke('browser:get-browsers'),
  },
  
  // 任务引擎 API
  taskEngine: {
    createTask: (request: any) => ipcRenderer.invoke('task-engine:create-task', request),
    getTasks: () => ipcRenderer.invoke('task-engine:get-tasks'),
    getTask: (taskId: string) => ipcRenderer.invoke('task-engine:get-task', taskId),
    updateTask: (taskId: string, updates: any) => ipcRenderer.invoke('task-engine:update-task', taskId, updates),
    deleteTask: (taskId: string) => ipcRenderer.invoke('task-engine:delete-task', taskId),
    executeTask: (request: any) => ipcRenderer.invoke('task-engine:execute-task', request),
    getExecutions: () => ipcRenderer.invoke('task-engine:get-executions'),
  },
  
  // 任务调度器 API
  taskScheduler: {
    scheduleTask: (request: any) => ipcRenderer.invoke('task-scheduler:schedule-task', request),
    getScheduledTasks: () => ipcRenderer.invoke('task-scheduler:get-scheduled-tasks'),
    pauseTask: (scheduleId: string) => ipcRenderer.invoke('task-scheduler:pause-task', scheduleId),
    resumeTask: (scheduleId: string) => ipcRenderer.invoke('task-scheduler:resume-task', scheduleId),
    deleteTask: (scheduleId: string) => ipcRenderer.invoke('task-scheduler:delete-task', scheduleId),
  },
  
  // 任务管理器 API
  taskManager: {
    uploadTask: (request: any) => ipcRenderer.invoke('task-manager:upload-task', request),
    importTask: (request: any) => ipcRenderer.invoke('task-manager:import-task', request),
    getTasks: (request?: any) => ipcRenderer.invoke('task-manager:get-tasks', request),
    getTask: (taskId: string) => ipcRenderer.invoke('task-manager:get-task', taskId),
    deleteTask: (taskId: string) => ipcRenderer.invoke('task-manager:delete-task', taskId),
    executeTask: (request: any) => ipcRenderer.invoke('task-manager:execute-task', request),
    getTaskExecutions: (taskId: string) => ipcRenderer.invoke('task-manager:get-executions', taskId),
    getAllExecutions: () => ipcRenderer.invoke('task-manager:get-all-executions'),
    getTaskStats: (taskId: string) => ipcRenderer.invoke('task-manager:get-task-stats', taskId),
    checkDependencies: (taskId: string) => ipcRenderer.invoke('task-manager:check-dependencies', taskId),
    installDependencies: (request: any) => ipcRenderer.invoke('task-manager:install-dependencies', request),
    getDependencySummary: () => ipcRenderer.invoke('task-manager:get-dependency-summary'),
    cleanupDependencies: () => ipcRenderer.invoke('task-manager:cleanup-dependencies'),
  },

  taskStore: {
    searchTasks: (request: any) => ipcRenderer.invoke('task-store:search-tasks', request),
    installTask: (request: any) => ipcRenderer.invoke('task-store:install-task', request),
    uninstallTask: (taskId: string) => ipcRenderer.invoke('task-store:uninstall-task', taskId),
    getStoreStats: () => ipcRenderer.invoke('task-store:get-store-stats'),
    checkForUpdates: () => ipcRenderer.invoke('task-store:check-for-updates'),
  },
  
  // 插件任务系统 API
  pluginTask: {
    // 浏览器任务执行
    executeInBrowser: (request: any, task: any) => ipcRenderer.invoke('plugin-task:execute-in-browser', request, task),
    getAvailableBrowsers: () => ipcRenderer.invoke('plugin-task:get-available-browsers'),
    
    // 任务执行
    execute: (request: any, task: any) => ipcRenderer.invoke('plugin-task:execute', request, task),
    stopExecution: (executionId: string) => ipcRenderer.invoke('plugin-task:stop-execution', executionId),
    getExecution: (executionId: string) => ipcRenderer.invoke('plugin-task:get-execution', executionId),
    getExecutions: (taskId?: string) => ipcRenderer.invoke('plugin-task:get-executions', taskId),
    
    // 任务调度
    schedule: (request: any, task: any, priority?: number) => ipcRenderer.invoke('plugin-task:schedule', request, task, priority),
    cancelScheduled: (queueId: string) => ipcRenderer.invoke('plugin-task:cancel-scheduled', queueId),
    getQueueStatus: () => ipcRenderer.invoke('plugin-task:get-queue-status'),
    getScheduledExecution: (queueId: string) => ipcRenderer.invoke('plugin-task:get-scheduled-execution', queueId),
    clearQueue: () => ipcRenderer.invoke('plugin-task:clear-queue'),
    
    // 任务CRUD操作
    upload: (file: Buffer, filename: string) => ipcRenderer.invoke('plugin-task:upload', file, filename),
    getAll: (filter?: any) => ipcRenderer.invoke('plugin-task:get-all', filter),
    getById: (taskId: string) => ipcRenderer.invoke('plugin-task:get-by-id', taskId),
    update: (taskId: string, updates: any) => ipcRenderer.invoke('plugin-task:update', taskId, updates),
    delete: (taskId: string) => ipcRenderer.invoke('plugin-task:delete', taskId),
    search: (query: string, filter?: any) => ipcRenderer.invoke('plugin-task:search', query, filter),
    count: (filter?: any) => ipcRenderer.invoke('plugin-task:count', filter),
    
    // 依赖管理
    installDependencies: (request: any) => ipcRenderer.invoke('plugin-task:install-dependencies', request),
    checkDependency: (dependency: string, taskId: string) => ipcRenderer.invoke('plugin-task:check-dependency', dependency, taskId),
    cleanupTaskDependencies: (taskId: string) => ipcRenderer.invoke('plugin-task:cleanup-task-dependencies', taskId),
    cleanupAllDependencies: () => ipcRenderer.invoke('plugin-task:cleanup-all-dependencies'),
    
    // 依赖状态和缓存管理
    checkDependencyStatus: (dependency: string, taskId: string) => ipcRenderer.invoke('plugin-task:check-dependency-status', dependency, taskId),
    checkDependencyHealth: (dependency: string, taskId: string) => ipcRenderer.invoke('plugin-task:check-dependency-health', dependency, taskId),
    checkTaskDependencies: (taskId: string, dependencies: string[]) => ipcRenderer.invoke('plugin-task:check-task-dependencies', taskId, dependencies),
    checkDependencyConflicts: (taskId: string, dependencies: string[]) => ipcRenderer.invoke('plugin-task:check-dependency-conflicts', taskId, dependencies),
    getCachedDependency: (name: string, version: string) => ipcRenderer.invoke('plugin-task:get-cached-dependency', name, version),
    addToCache: (dependency: any, taskId: string) => ipcRenderer.invoke('plugin-task:add-to-cache', dependency, taskId),
    removeFromCache: (name: string, version: string) => ipcRenderer.invoke('plugin-task:remove-from-cache', name, version),
    getCacheStats: () => ipcRenderer.invoke('plugin-task:get-cache-stats'),
    cleanupCache: () => ipcRenderer.invoke('plugin-task:cleanup-cache'),
  },
  
  // 保留原有的 task API 以兼容
  task: {
    create: (task: any) => ipcRenderer.invoke('task:create', task),
    update: (id: string, updates: any) => ipcRenderer.invoke('task:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('task:delete', id),
    list: (filter?: any) => ipcRenderer.invoke('task:list', filter),
    execute: (taskId: string, browserIds: string[]) => ipcRenderer.invoke('task:execute', taskId, browserIds),
    stop: (executionId: string) => ipcRenderer.invoke('task:stop', executionId),
    getExecutions: (taskId: string, filter?: any) => ipcRenderer.invoke('task:executions', taskId, filter),
    getStats: (taskId: string) => ipcRenderer.invoke('task:stats', taskId),
  },
  
  account: {
    create: (account: any) => ipcRenderer.invoke('account:create', account),
    update: (id: string, updates: any) => ipcRenderer.invoke('account:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('account:delete', id),
    list: (filter?: any) => ipcRenderer.invoke('account:list', filter),
    verify: (id: string) => ipcRenderer.invoke('account:verify', id),
    batchVerify: (ids: string[]) => ipcRenderer.invoke('account:batch-verify', ids),
    import: (data: any) => ipcRenderer.invoke('account:import', data),
    export: (filter?: any) => ipcRenderer.invoke('account:export', filter),
  },
  
  system: {
    getConfig: () => ipcRenderer.invoke('system:config'),
    updateConfig: (config: any) => ipcRenderer.invoke('system:config:update', config),
    getLogs: (filter?: any) => ipcRenderer.invoke('system:logs', filter),
    clearLogs: () => ipcRenderer.invoke('system:logs:clear'),
  },

  // 通用调用方法，用于简化组件中的调用
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  
  events: {
    onBrowserStatusChange: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('browser:status:changed', callback);
      return () => ipcRenderer.removeListener('browser:status:changed', callback);
    },
    
    onTaskProgress: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('task:progress', callback);
      return () => ipcRenderer.removeListener('task:progress', callback);
    },
    
    onSystemNotification: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('system:notification', callback);
      return () => ipcRenderer.removeListener('system:notification', callback);
    },
    
    // 插件任务系统事件
    onPluginTaskExecution: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('plugin-task:execution', callback);
      return () => ipcRenderer.removeListener('plugin-task:execution', callback);
    },
    
    onPluginTaskProgress: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('plugin-task:progress', callback);
      return () => ipcRenderer.removeListener('plugin-task:progress', callback);
    },
    
    onPluginTaskScheduler: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('plugin-task:scheduler', callback);
      return () => ipcRenderer.removeListener('plugin-task:scheduler', callback);
    },
    
    onPluginTaskDependency: (callback: (event: any, data: any) => void) => {
      ipcRenderer.on('plugin-task:dependency', callback);
      return () => ipcRenderer.removeListener('plugin-task:dependency', callback);
    },
    
    onPluginTaskError: (callback: (event: any, error: any) => void) => {
      ipcRenderer.on('plugin-task:error', callback);
      return () => ipcRenderer.removeListener('plugin-task:error', callback);
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;