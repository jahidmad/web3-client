/**
 * Plugin Task System - Core Type Definitions
 *
 * This file contains all the core TypeScript interfaces and types for the plugin task system.
 * It defines the data models for tasks, parameters, executions, dependencies, and error handling.
 */
export interface BrowserAPI {
    goto(url: string, options?: NavigationOptions): Promise<void>;
    reload(options?: NavigationOptions): Promise<void>;
    waitForLoad(timeout?: number): Promise<void>;
    click(selector: string, options?: ClickOptions): Promise<void>;
    type(selector: string, text: string, options?: TypeOptions): Promise<void>;
    select(selector: string, value: string | string[], options?: SelectOptions): Promise<void>;
    getText(selector: string, options?: WaitOptions): Promise<string>;
    getAttribute(selector: string, attribute: string, options?: WaitOptions): Promise<string>;
    getTable(selector: string, options?: WaitOptions): Promise<string[][]>;
    waitFor(selector: string, options?: WaitOptions): Promise<void>;
    waitForText(text: string, options?: WaitOptions): Promise<void>;
    fillForm(formSelector: string, formData: Record<string, any>, options?: any): Promise<void>;
    submitForm(formSelector: string, options?: WaitOptions): Promise<void>;
    screenshot(options?: ScreenshotOptions): Promise<Buffer>;
    evaluate<T>(fn: Function, ...args: any[]): Promise<T>;
    getUrl(): Promise<string>;
    getTitle(): Promise<string>;
    getCookies(): Promise<any[]>;
    setCookies(cookies: any[]): Promise<void>;
}
/**
 * Supported parameter types for task parameters
 */
export type ParameterType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'select' | 'multiselect' | 'file' | 'textarea' | 'password' | 'date' | 'time' | 'datetime';
/**
 * Parameter option for select/multiselect types
 */
export interface ParameterOption {
    label: string;
    value: any;
    description?: string;
}
/**
 * Task parameter definition
 */
export interface Parameter {
    name: string;
    label: string;
    type: ParameterType;
    required?: boolean;
    default?: any;
    min?: number;
    max?: number;
    options?: ParameterOption[];
    placeholder?: string;
    description?: string;
    validation?: string;
}
/**
 * Task configuration settings
 */
export interface TaskConfig {
    timeout?: number;
    retries?: number;
    permissions?: string[];
    maxMemory?: number;
    concurrent?: boolean;
    priority?: number;
    cacheable?: boolean;
    cacheTtl?: number;
}
/**
 * Task status enumeration
 */
export declare enum TaskStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    DISABLED = "disabled",
    ARCHIVED = "archived",
    ERROR = "error"
}
/**
 * Core task model
 */
export interface Task {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    tags: string[];
    icon?: string;
    parameters: Parameter[];
    dependencies: string[];
    config: TaskConfig;
    code: string;
    createdAt: Date;
    updatedAt: Date;
    status: TaskStatus;
    dependencyStatus?: DependencyStatus;
}
/**
 * Individual dependency information
 */
export interface DependencyInfo {
    name: string;
    version: string;
    installed: boolean;
    path?: string;
    size?: number;
    lastChecked?: Date;
}
/**
 * Overall dependency status for a task
 */
export interface DependencyStatus {
    satisfied: boolean;
    dependencies: DependencyInfo[];
    missingDependencies: DependencyInfo[];
    lastChecked: Date;
    installRequired: boolean;
}
/**
 * Individual dependency status (extended from DependencyInfo)
 */
export interface SingleDependencyStatus {
    name: string;
    version: string;
    installed: boolean;
    path?: string;
    size?: number;
    lastChecked: Date;
    cached?: boolean;
    cachedPath?: string;
    updateAvailable?: boolean;
    latestVersion?: string;
    integrityVerified?: boolean;
    integrityIssues?: string[];
    securityChecked?: boolean;
    vulnerabilities?: Array<{
        id: string;
        title: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        description: string;
        fixedIn?: string;
    }>;
    deprecated?: string;
    error?: string;
}
/**
 * Dependency installation request
 */
export interface DependencyInstallRequest {
    taskId: string;
    dependencies: string[];
    force?: boolean;
}
/**
 * Dependency installation result
 */
export interface DependencyInstallResult {
    success: boolean;
    installed: DependencyInfo[];
    failed: Array<{
        dependency: string;
        error: string;
    }>;
    warnings: string[];
}
/**
 * Task execution status enumeration
 */
export declare enum ExecutionStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    STOPPED = "stopped",
    TIMEOUT = "timeout"
}
/**
 * Log entry for task execution
 */
export interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
    source?: string;
}
/**
 * Task execution result
 */
export interface ExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
    logs?: LogEntry[];
    progress?: {
        value: number;
        message: string;
    };
    memoryUsage?: number;
    cpuUsage?: number;
}
/**
 * Task execution context provided to tasks during execution
 */
export interface ExecutionContext {
    browser: BrowserAPI;
    page: any;
    params: Record<string, any>;
    log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => string;
    progress: (value: number, message?: string) => {
        value: number;
        message: string;
    };
    utils: {
        sleep: (ms: number) => Promise<void>;
        formatDate: (date: Date, format?: string) => string;
        parseJson: (json: string) => any;
        generateId: () => string;
    };
    _internal: {
        logs: Array<{
            timestamp: Date;
            message: string;
            level: 'debug' | 'info' | 'warn' | 'error';
        }>;
        progress: {
            value: number;
            message: string;
        };
        startTime: Date;
        memoryUsage: number;
        cpuUsage: number;
    };
}
/**
 * Task execution record
 */
export interface Execution {
    id: string;
    taskId: string;
    browserId: string;
    status: ExecutionStatus;
    parameters: Record<string, any>;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    progress: number;
    progressMessage?: string;
    logs: LogEntry[];
    result?: ExecutionResult;
    error?: string;
    memoryUsage?: number;
    cpuUsage?: number;
}
/**
 * Task execution request
 */
export interface ExecutionRequest {
    taskId: string;
    browserId?: string;
    parameters?: Record<string, any>;
    debug?: boolean;
    priority?: number;
    timeout?: number;
}
/**
 * Navigation options for browser operations
 */
export interface NavigationOptions {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    referer?: string;
}
/**
 * Click options for element interaction
 */
export interface ClickOptions {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
    force?: boolean;
    timeout?: number;
}
/**
 * Type options for text input
 */
export interface TypeOptions {
    delay?: number;
    clear?: boolean;
    timeout?: number;
}
/**
 * Select options for dropdown selection
 */
export interface SelectOptions {
    timeout?: number;
}
/**
 * Element information
 */
export interface ElementInfo {
    selector: string;
    found: boolean;
    visible: boolean;
    duration: number;
}
/**
 * Interaction result
 */
export interface InteractionResult {
    success: boolean;
    selector: string;
    duration: number;
    action: string;
    data?: any;
}
/**
 * Wait options for element waiting
 */
export interface WaitOptions {
    timeout?: number;
    visible?: boolean;
    hidden?: boolean;
}
/**
 * Screenshot options
 */
export interface ScreenshotOptions {
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
    clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Navigation result interface
 */
export interface NavigationResult {
    success: boolean;
    url: string;
    duration: number;
    redirected: boolean;
    status: {
        url: string;
        title: string;
        ready: boolean;
        loaded: boolean;
    };
}
/**
 * Task utility functions interface
 */
export interface TaskUtils {
    formatString(template: string, data: Record<string, any>): string;
    slugify(text: string): string;
    truncate(text: string, length: number): string;
    validateEmail(email: string): boolean;
    validateUrl(url: string): boolean;
    parseJson(json: string): any;
    saveFile(path: string, data: Buffer | string): Promise<void>;
    readFile(path: string): Promise<Buffer>;
    fileExists(path: string): Promise<boolean>;
    formatDate(date: Date, format: string): string;
    parseDate(dateString: string): Date;
    addDays(date: Date, days: number): Date;
    sleep(ms: number): Promise<void>;
    timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
    retry<T>(fn: () => Promise<T>, attempts: number): Promise<T>;
}
/**
 * Task execution context provided to tasks
 */
export interface TaskContext {
    page: any;
    params: Record<string, any>;
    log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
    progress: (percent: number, message?: string) => void;
    browser: BrowserAPI;
    utils: TaskUtils;
    executionId: string;
    taskId: string;
    config: TaskConfig;
}
/**
 * Error codes for different types of errors
 */
export declare enum ErrorCode {
    PARSE_ERROR = "PARSE_ERROR",
    INVALID_FORMAT = "INVALID_FORMAT",
    MISSING_METADATA = "MISSING_METADATA",
    INVALID_PARAMETERS = "INVALID_PARAMETERS",
    DEPENDENCY_NOT_FOUND = "DEPENDENCY_NOT_FOUND",
    DEPENDENCY_INSTALL_FAILED = "DEPENDENCY_INSTALL_FAILED",
    DEPENDENCY_VERSION_CONFLICT = "DEPENDENCY_VERSION_CONFLICT",
    EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT",
    EXECUTION_FAILED = "EXECUTION_FAILED",
    EXECUTION_NOT_FOUND = "EXECUTION_NOT_FOUND",
    BROWSER_ERROR = "BROWSER_ERROR",
    BROWSER_NOT_FOUND = "BROWSER_NOT_FOUND",
    BROWSER_NOT_AVAILABLE = "BROWSER_NOT_AVAILABLE",
    NAVIGATION_FAILED = "NAVIGATION_FAILED",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    QUEUE_FULL = "QUEUE_FULL",
    DATABASE_ERROR = "DATABASE_ERROR",
    FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    MEMORY_ERROR = "MEMORY_ERROR"
}
/**
 * Custom error class for task system
 */
export declare class TaskError extends Error {
    code: ErrorCode;
    message: string;
    details?: any | undefined;
    taskId?: string | undefined;
    executionId?: string | undefined;
    constructor(code: ErrorCode, message: string, details?: any | undefined, taskId?: string | undefined, executionId?: string | undefined);
}
/**
 * Task file metadata extracted from JSDoc comments
 */
export interface TaskFileMetadata {
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    tags: string[];
    icon?: string;
    license?: string;
    homepage?: string;
    repository?: string;
}
/**
 * Parsed task file structure
 */
export interface TaskFile {
    metadata: TaskFileMetadata;
    parameters: Parameter[];
    dependencies: string[];
    config: TaskConfig;
    code: string;
    executeFunction: string;
}
/**
 * Task file validation result
 */
export interface TaskFileValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    metadata?: TaskFileMetadata;
}
/**
 * Task export options
 */
export interface TaskExportOptions {
    includeMetadata?: boolean;
    includeDependencies?: boolean;
    includeExecutionHistory?: boolean;
    format?: 'js' | 'json' | 'zip';
    prettify?: boolean;
    compress?: boolean;
}
/**
 * Task import options
 */
export interface TaskImportOptions {
    overwrite?: boolean;
    validateDependencies?: boolean;
    skipInvalid?: boolean;
}
/**
 * Task import result
 */
export interface TaskImportResult {
    success: boolean;
    imported: string[];
    failed: Array<{
        filename: string;
        error: string;
    }>;
    warnings: string[];
}
/**
 * Task filter options for querying
 */
export interface TaskFilter {
    category?: string;
    tags?: string[];
    status?: TaskStatus;
    author?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
/**
 * Task manager interface
 */
export interface TaskManager {
    uploadTask(file: Buffer, filename: string): Promise<Task>;
    getTasks(filter?: TaskFilter): Promise<Task[]>;
    getTask(taskId: string): Promise<Task | null>;
    updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
    deleteTask(taskId: string): Promise<void>;
    executeTask(request: ExecutionRequest): Promise<Execution>;
    stopExecution(executionId: string): Promise<void>;
    getExecution(executionId: string): Promise<Execution | null>;
    getExecutions(taskId?: string): Promise<Execution[]>;
    checkDependencies(taskId: string): Promise<DependencyStatus>;
    installDependencies(request: DependencyInstallRequest): Promise<DependencyInstallResult>;
    cleanupDependencies(): Promise<void>;
    exportTask(taskId: string, options?: TaskExportOptions): Promise<Buffer>;
    importTask(data: Buffer, options?: TaskImportOptions): Promise<TaskImportResult>;
    importTaskFromUrl(url: string, options?: TaskImportOptions): Promise<TaskImportResult>;
}
/**
 * Task system event types
 */
export declare enum TaskEventType {
    TASK_CREATED = "task:created",
    TASK_UPDATED = "task:updated",
    TASK_DELETED = "task:deleted",
    EXECUTION_STARTED = "execution:started",
    EXECUTION_PROGRESS = "execution:progress",
    EXECUTION_COMPLETED = "execution:completed",
    EXECUTION_FAILED = "execution:failed",
    EXECUTION_CANCELLED = "execution:cancelled",
    DEPENDENCY_INSTALLED = "dependency:installed",
    DEPENDENCY_FAILED = "dependency:failed"
}
/**
 * Task system event data
 */
export interface TaskEvent {
    type: TaskEventType;
    timestamp: Date;
    taskId?: string;
    executionId?: string;
    data?: any;
}
/**
 * Event listener function type
 */
export type TaskEventListener = (event: TaskEvent) => void;
/**
 * Event emitter interface for task system
 */
export interface TaskEventEmitter {
    on(eventType: TaskEventType, listener: TaskEventListener): void;
    off(eventType: TaskEventType, listener: TaskEventListener): void;
    emit(event: TaskEvent): void;
}
//# sourceMappingURL=plugin-task-system.d.ts.map