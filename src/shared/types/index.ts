/**
 * Shared Types Index
 * 
 * This file exports all shared types used across the application.
 */

// Export all plugin task system types
export * from './plugin-task-system';

// Export error types and status enumerations
export * from './errors';

// Export dependency status types (selectively to avoid conflicts)
export type {
  DependencyHealthCheck
} from './dependency-status';

// Export task file format constraints
// Selectively export to avoid conflicts
export {
  REQUIRED_JSDOC_TAGS,
  OPTIONAL_JSDOC_TAGS,
  JSDocTag,
  REQUIRED_EXPORTS,
  OPTIONAL_EXPORTS,
  TaskFileExport,
  ExecuteFunctionSignature,
  TaskFileSchema,
  PARAMETER_TYPE_CONSTRAINTS,
  ParameterSchema,
  DependencyFormat,
  DEPENDENCY_PATTERNS,
  DependencyValidation,
  TaskConfigSchema,
  TaskFileValidationContext,
  ValidationStep,
  ValidationStepResult,
  TaskFileValidationResult,
  FORBIDDEN_PATTERNS,
  SecurityScanResult,
  JSDocParserOptions,
  CodeParserOptions,
  TaskFileParserConfig,
  isValidJSDocMetadata,
  isValidParameterArray,
  isValidDependencyArray,
  isValidTaskConfig,
  TaskFileValidator
} from './task-file-format';

// Re-export commonly used types for convenience
export type {
  // Core types
  Task,
  Parameter,
  Execution,
  TaskContext,
  BrowserAPI,
  TaskManager,
  DependencyStatus,
  ExecutionRequest,
  TaskFilter,
  TaskStatus,
  ExecutionStatus
} from './plugin-task-system';

// Re-export classes and enums (not as types)
export {
  TaskError,
  ErrorCode
} from './plugin-task-system';

export type {
  // Error types
  TaskParseError,
  TaskDependencyError,
  TaskExecutionError,
  TaskSystemError,
  DetailedTaskStatus,
  DependencyInstallStatus,
  ExecutionPhase
} from './errors';

export type {
  // File format types
  JSDocMetadata
} from './task-file-format';