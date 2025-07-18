/**
 * Shared Types Index
 *
 * This file exports all shared types used across the application.
 */
export * from './plugin-task-system';
export * from './errors';
export type { DependencyHealthCheck } from './dependency-status';
export { REQUIRED_JSDOC_TAGS, OPTIONAL_JSDOC_TAGS, JSDocTag, REQUIRED_EXPORTS, OPTIONAL_EXPORTS, TaskFileExport, ExecuteFunctionSignature, TaskFileSchema, PARAMETER_TYPE_CONSTRAINTS, ParameterSchema, DependencyFormat, DEPENDENCY_PATTERNS, DependencyValidation, TaskConfigSchema, TaskFileValidationContext, ValidationStep, ValidationStepResult, TaskFileValidationResult, FORBIDDEN_PATTERNS, SecurityScanResult, JSDocParserOptions, CodeParserOptions, TaskFileParserConfig, isValidJSDocMetadata, isValidParameterArray, isValidDependencyArray, isValidTaskConfig, TaskFileValidator } from './task-file-format';
export type { Task, Parameter, Execution, TaskContext, BrowserAPI, TaskManager, DependencyStatus, ExecutionRequest, TaskFilter, TaskStatus, ExecutionStatus } from './plugin-task-system';
export { TaskError, ErrorCode } from './plugin-task-system';
export type { TaskParseError, TaskDependencyError, TaskExecutionError, TaskSystemError, DetailedTaskStatus, DependencyInstallStatus, ExecutionPhase } from './errors';
export type { JSDocMetadata } from './task-file-format';
//# sourceMappingURL=index.d.ts.map