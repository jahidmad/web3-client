/**
 * Plugin Task System - Core Type Definitions
 * 
 * This file contains all the core TypeScript interfaces and types for the plugin task system.
 * It defines the data models for tasks, parameters, executions, dependencies, and error handling.
 */

// Forward declaration for BrowserAPI (will be imported from browser-api module)
export interface BrowserAPI {
  // Page navigation
  goto(url: string, options?: NavigationOptions): Promise<void>;
  reload(options?: NavigationOptions): Promise<void>;
  waitForLoad(timeout?: number): Promise<void>;
  
  // Element operations
  click(selector: string, options?: ClickOptions): Promise<void>;
  type(selector: string, text: string, options?: TypeOptions): Promise<void>;
  select(selector: string, value: string | string[], options?: SelectOptions): Promise<void>;
  
  // Data extraction
  getText(selector: string, options?: WaitOptions): Promise<string>;
  getAttribute(selector: string, attribute: string, options?: WaitOptions): Promise<string>;
  getTable(selector: string, options?: WaitOptions): Promise<string[][]>;
  
  // Wait operations
  waitFor(selector: string, options?: WaitOptions): Promise<void>;
  waitForText(text: string, options?: WaitOptions): Promise<void>;
  
  // Form operations
  fillForm(formSelector: string, formData: Record<string, any>, options?: any): Promise<void>;
  submitForm(formSelector: string, options?: WaitOptions): Promise<void>;
  
  // Advanced operations
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  evaluate<T>(fn: Function, ...args: any[]): Promise<T>;
  
  // Page information
  getUrl(): Promise<string>;
  getTitle(): Promise<string>;
  getCookies(): Promise<any[]>;
  setCookies(cookies: any[]): Promise<void>;
}

// ============================================================================
// PARAMETER TYPES AND DEFINITIONS
// ============================================================================

/**
 * Supported parameter types for task parameters
 */
export type ParameterType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'url' 
  | 'email' 
  | 'select' 
  | 'multiselect' 
  | 'file'
  | 'textarea'
  | 'password'
  | 'date'
  | 'time'
  | 'datetime';

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
  name: string;                    // Parameter name
  label: string;                   // Display label
  type: ParameterType;             // Parameter type
  required?: boolean;              // Whether required
  default?: any;                   // Default value
  min?: number;                    // Minimum value (for number type)
  max?: number;                    // Maximum value (for number type)
  options?: ParameterOption[];     // Options list (for select types)
  placeholder?: string;            // Placeholder text
  description?: string;            // Parameter description
  validation?: string;             // Validation regex pattern
}

// ============================================================================
// TASK CONFIGURATION AND METADATA
// ============================================================================

/**
 * Task configuration settings
 */
export interface TaskConfig {
  timeout?: number;                // Execution timeout in milliseconds
  retries?: number;                // Number of retry attempts
  permissions?: string[];          // Required permissions
  maxMemory?: number;              // Maximum memory usage in MB
  concurrent?: boolean;            // Whether task can run concurrently
  priority?: number;               // Task execution priority (1-10)
  cacheable?: boolean;             // Whether task results can be cached
  cacheTtl?: number;               // Time-to-live for cached results in milliseconds (0 = no expiration)
}

/**
 * Task status enumeration
 */
export enum TaskStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DISABLED = 'disabled',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

/**
 * Core task model
 */
export interface Task {
  id: string;                      // Unique identifier
  name: string;                    // Task name
  description: string;             // Task description
  version: string;                 // Version number
  author: string;                  // Author name
  category: string;                // Task category
  tags: string[];                  // Tag array
  icon?: string;                   // Task icon (emoji or URL)
  parameters: Parameter[];         // Parameter definitions
  dependencies: string[];          // Dependency package list
  config: TaskConfig;              // Task configuration
  code: string;                    // Task code
  createdAt: Date;                 // Creation timestamp
  updatedAt: Date;                 // Last update timestamp
  status: TaskStatus;              // Task status
  dependencyStatus?: DependencyStatus; // Dependency status
}

// ============================================================================
// DEPENDENCY MANAGEMENT
// ============================================================================

/**
 * Individual dependency information
 */
export interface DependencyInfo {
  name: string;                    // Package name
  version: string;                 // Package version
  installed: boolean;              // Whether installed
  path?: string;                   // Installation path
  size?: number;                   // Package size in bytes
  lastChecked?: Date;              // Last check timestamp
}

/**
 * Overall dependency status for a task
 */
export interface DependencyStatus {
  satisfied: boolean;              // Whether all dependencies are satisfied
  dependencies: DependencyInfo[];  // All dependency information
  missingDependencies: DependencyInfo[]; // Missing dependencies
  lastChecked: Date;               // Last check timestamp
  installRequired: boolean;        // Whether installation is required
}

/**
 * Individual dependency status (extended from DependencyInfo)
 */
export interface SingleDependencyStatus {
  name: string;                    // Package name
  version: string;                 // Package version
  installed: boolean;              // Whether installed
  path?: string;                   // Installation path
  size?: number;                   // Package size in bytes
  lastChecked: Date;               // Last check timestamp
  cached?: boolean;                // Whether cached
  cachedPath?: string;             // Cache path
  updateAvailable?: boolean;       // Update available
  latestVersion?: string;          // Latest version
  integrityVerified?: boolean;     // Integrity verified
  integrityIssues?: string[];      // Integrity issues
  securityChecked?: boolean;       // Security checked
  vulnerabilities?: Array<{        // Security vulnerabilities
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    fixedIn?: string;
  }>;
  deprecated?: string;             // Deprecation notice
  error?: string;                  // Error message
}

/**
 * Dependency installation request
 */
export interface DependencyInstallRequest {
  taskId: string;                  // Task ID
  dependencies: string[];          // Dependencies to install
  force?: boolean;                 // Force reinstallation
}

/**
 * Dependency installation result
 */
export interface DependencyInstallResult {
  success: boolean;                // Overall success status
  installed: DependencyInfo[];     // Successfully installed dependencies
  failed: Array<{                  // Failed installations
    dependency: string;
    error: string;
  }>;
  warnings: string[];              // Installation warnings
}

// ============================================================================
// TASK EXECUTION
// ============================================================================

/**
 * Task execution status enumeration
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped',
  TIMEOUT = 'timeout'
}

/**
 * Log entry for task execution
 */
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  source?: string;                 // Log source (e.g., 'task', 'system')
}

/**
 * Task execution result
 */
export interface ExecutionResult {
  success: boolean;                // Whether execution was successful
  data?: any;                      // Result data
  error?: string;                  // Error message if failed
  metadata?: Record<string, any>;  // Additional metadata
  logs?: LogEntry[];               // Execution logs
  progress?: { value: number; message: string }; // Progress information
  memoryUsage?: number;            // Memory usage in KB
  cpuUsage?: number;               // CPU usage in milliseconds
}

/**
 * Task execution context provided to tasks during execution
 */
export interface ExecutionContext {
  browser: BrowserAPI;             // Comprehensive browser API
  page: any;                       // Browser page object
  params: Record<string, any>;     // User input parameters
  log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => string;
  progress: (value: number, message?: string) => { value: number; message: string };
  utils: {
    sleep: (ms: number) => Promise<void>;
    formatDate: (date: Date, format?: string) => string;
    parseJson: (json: string) => any;
    generateId: () => string;
  };
  _internal: {
    logs: Array<{ timestamp: Date; message: string; level: 'debug' | 'info' | 'warn' | 'error' }>;
    progress: { value: number; message: string };
    startTime: Date;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Task execution record
 */
export interface Execution {
  id: string;                      // Execution ID
  taskId: string;                  // Task ID
  browserId: string;               // Browser instance ID
  status: ExecutionStatus;         // Execution status
  parameters: Record<string, any>; // Execution parameters
  startTime: Date;                 // Start timestamp
  endTime?: Date;                  // End timestamp
  duration?: number;               // Execution duration in milliseconds
  progress: number;                // Progress percentage (0-100)
  progressMessage?: string;        // Progress message
  logs: LogEntry[];                // Log entries
  result?: ExecutionResult;        // Execution result
  error?: string;                  // Error message
  memoryUsage?: number;            // Peak memory usage in MB
  cpuUsage?: number;               // CPU usage percentage
}

/**
 * Task execution request
 */
export interface ExecutionRequest {
  taskId: string;                  // Task to execute
  browserId?: string;              // Browser instance to use
  parameters?: Record<string, any>; // Task parameters
  debug?: boolean;                 // Enable debug mode
  priority?: number;               // Execution priority
  timeout?: number;                // Execution timeout in milliseconds
}

// ============================================================================
// BROWSER API INTERFACES
// ============================================================================

/**
 * Navigation options for browser operations
 */
export interface NavigationOptions {
  timeout?: number;                // Navigation timeout
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  referer?: string;                // Referer header
}

/**
 * Click options for element interaction
 */
export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;             // Number of clicks
  delay?: number;                  // Delay between clicks
  force?: boolean;                 // Force click even if element is not visible
  timeout?: number;                // Timeout for waiting for element
}

/**
 * Type options for text input
 */
export interface TypeOptions {
  delay?: number;                  // Delay between keystrokes
  clear?: boolean;                 // Clear existing text first
  timeout?: number;                // Timeout for waiting for element
}

/**
 * Select options for dropdown selection
 */
export interface SelectOptions {
  timeout?: number;                // Timeout for waiting for element
}

/**
 * Element information
 */
export interface ElementInfo {
  selector: string;                // Element selector
  found: boolean;                  // Whether element was found
  visible: boolean;                // Whether element is visible
  duration: number;                // Time taken to find element
}

/**
 * Interaction result
 */
export interface InteractionResult {
  success: boolean;                // Whether interaction was successful
  selector: string;                // Element selector
  duration: number;                // Time taken for interaction
  action: string;                  // Action performed
  data?: any;                      // Additional data from interaction
}

/**
 * Wait options for element waiting
 */
export interface WaitOptions {
  timeout?: number;                // Wait timeout
  visible?: boolean;               // Wait for element to be visible
  hidden?: boolean;                // Wait for element to be hidden
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  path?: string;                   // File path to save
  type?: 'png' | 'jpeg';          // Image format
  quality?: number;                // JPEG quality (0-100)
  fullPage?: boolean;              // Capture full page
  clip?: {                         // Clip area
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
  success: boolean;                // Whether navigation was successful
  url: string;                     // Final URL after navigation
  duration: number;                // Time taken for navigation
  redirected: boolean;             // Whether the navigation was redirected
  status: {                        // Page status information
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
  // String utilities
  formatString(template: string, data: Record<string, any>): string;
  slugify(text: string): string;
  truncate(text: string, length: number): string;
  
  // Data utilities
  validateEmail(email: string): boolean;
  validateUrl(url: string): boolean;
  parseJson(json: string): any;
  
  // File utilities
  saveFile(path: string, data: Buffer | string): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  fileExists(path: string): Promise<boolean>;
  
  // Date utilities
  formatDate(date: Date, format: string): string;
  parseDate(dateString: string): Date;
  addDays(date: Date, days: number): Date;
  
  // Async utilities
  sleep(ms: number): Promise<void>;
  timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
  retry<T>(fn: () => Promise<T>, attempts: number): Promise<T>;
}

/**
 * Task execution context provided to tasks
 */
export interface TaskContext {
  page: any;                       // Browser page object (Playwright/Puppeteer)
  params: Record<string, any>;     // User input parameters
  log: (message: string, level?: 'debug' | 'info' | 'warn' | 'error') => void;
  progress: (percent: number, message?: string) => void;
  browser: BrowserAPI;             // Browser operation API
  utils: TaskUtils;                // Utility functions
  executionId: string;             // Current execution ID
  taskId: string;                  // Current task ID
  config: TaskConfig;              // Task configuration
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Error codes for different types of errors
 */
export enum ErrorCode {
  // Parse errors
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_FORMAT = 'INVALID_FORMAT',
  MISSING_METADATA = 'MISSING_METADATA',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // Dependency errors
  DEPENDENCY_NOT_FOUND = 'DEPENDENCY_NOT_FOUND',
  DEPENDENCY_INSTALL_FAILED = 'DEPENDENCY_INSTALL_FAILED',
  DEPENDENCY_VERSION_CONFLICT = 'DEPENDENCY_VERSION_CONFLICT',
  
  // Execution errors
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',
  BROWSER_ERROR = 'BROWSER_ERROR',
  BROWSER_NOT_FOUND = 'BROWSER_NOT_FOUND',
  BROWSER_NOT_AVAILABLE = 'BROWSER_NOT_AVAILABLE',
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  QUEUE_FULL = 'QUEUE_FULL',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR'
}

/**
 * Custom error class for task system
 */
export class TaskError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details?: any,
    public taskId?: string,
    public executionId?: string
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

// ============================================================================
// TASK FILE FORMAT
// ============================================================================

/**
 * Task file metadata extracted from JSDoc comments
 */
export interface TaskFileMetadata {
  name: string;                    // @name
  description: string;             // @description
  version: string;                 // @version
  author: string;                  // @author
  category: string;                // @category
  tags: string[];                  // @tags (comma-separated)
  icon?: string;                   // @icon
  license?: string;                // @license
  homepage?: string;               // @homepage
  repository?: string;             // @repository
}

/**
 * Parsed task file structure
 */
export interface TaskFile {
  metadata: TaskFileMetadata;      // Extracted metadata
  parameters: Parameter[];         // Parameter definitions
  dependencies: string[];          // Dependency list
  config: TaskConfig;              // Task configuration
  code: string;                    // Task execution code
  executeFunction: string;         // Extracted execute function code
}

/**
 * Task file validation result
 */
export interface TaskFileValidation {
  valid: boolean;                  // Whether file is valid
  errors: string[];                // Validation errors
  warnings: string[];              // Validation warnings
  metadata?: TaskFileMetadata;     // Extracted metadata (if valid)
}

// ============================================================================
// IMPORT/EXPORT INTERFACES
// ============================================================================

/**
 * Task export options
 */
export interface TaskExportOptions {
  includeMetadata?: boolean;       // Include metadata
  includeDependencies?: boolean;   // Include dependency information
  includeExecutionHistory?: boolean; // Include execution history
  format?: 'js' | 'json' | 'zip';  // Export format
  prettify?: boolean;              // Prettify the output
  compress?: boolean;              // Compress the output
}

/**
 * Task import options
 */
export interface TaskImportOptions {
  overwrite?: boolean;             // Overwrite existing tasks
  validateDependencies?: boolean;  // Validate dependencies during import
  skipInvalid?: boolean;           // Skip invalid tasks
}

/**
 * Task import result
 */
export interface TaskImportResult {
  success: boolean;                // Overall success
  imported: string[];              // Successfully imported task IDs
  failed: Array<{                  // Failed imports
    filename: string;
    error: string;
  }>;
  warnings: string[];              // Import warnings
}

// ============================================================================
// MANAGER INTERFACES
// ============================================================================

/**
 * Task filter options for querying
 */
export interface TaskFilter {
  category?: string;               // Filter by category
  tags?: string[];                 // Filter by tags
  status?: TaskStatus;             // Filter by status
  author?: string;                 // Filter by author
  search?: string;                 // Search in name/description
  limit?: number;                  // Result limit
  offset?: number;                 // Result offset
}

/**
 * Task manager interface
 */
export interface TaskManager {
  // Task CRUD operations
  uploadTask(file: Buffer, filename: string): Promise<Task>;
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  getTask(taskId: string): Promise<Task | null>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;
  
  // Task execution
  executeTask(request: ExecutionRequest): Promise<Execution>;
  stopExecution(executionId: string): Promise<void>;
  getExecution(executionId: string): Promise<Execution | null>;
  getExecutions(taskId?: string): Promise<Execution[]>;
  
  // Dependency management
  checkDependencies(taskId: string): Promise<DependencyStatus>;
  installDependencies(request: DependencyInstallRequest): Promise<DependencyInstallResult>;
  cleanupDependencies(): Promise<void>;
  
  // Import/Export
  exportTask(taskId: string, options?: TaskExportOptions): Promise<Buffer>;
  importTask(data: Buffer, options?: TaskImportOptions): Promise<TaskImportResult>;
  importTaskFromUrl(url: string, options?: TaskImportOptions): Promise<TaskImportResult>;
}

// ============================================================================
// EVENT SYSTEM
// ============================================================================

/**
 * Task system event types
 */
export enum TaskEventType {
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  EXECUTION_STARTED = 'execution:started',
  EXECUTION_PROGRESS = 'execution:progress',
  EXECUTION_COMPLETED = 'execution:completed',
  EXECUTION_FAILED = 'execution:failed',
  EXECUTION_CANCELLED = 'execution:cancelled',
  DEPENDENCY_INSTALLED = 'dependency:installed',
  DEPENDENCY_FAILED = 'dependency:failed'
}

/**
 * Task system event data
 */
export interface TaskEvent {
  type: TaskEventType;             // Event type
  timestamp: Date;                 // Event timestamp
  taskId?: string;                 // Related task ID
  executionId?: string;            // Related execution ID
  data?: any;                      // Event-specific data
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