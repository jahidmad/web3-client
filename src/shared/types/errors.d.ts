/**
 * Error Types and Validation
 *
 * This file defines error types and validation utilities used throughout
 * the plugin task system.
 */
/**
 * Validation types
 */
export declare enum ValidationType {
    FORMAT = "format",
    CUSTOM = "custom",
    REQUIRED = "required",
    LENGTH = "length",
    RANGE = "range"
}
/**
 * Validation rule definition
 */
export interface ValidationRule {
    type: ValidationType;
    message: string;
    pattern?: string;
    validator?: (value: any) => boolean;
    min?: number;
    max?: number;
    required?: boolean;
}
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Validate a value against a set of rules
 */
export declare function validateValue(value: any, rules: ValidationRule[]): ValidationResult;
/**
 * Create a validation rule
 */
export declare function createValidationRule(type: ValidationType, message: string, options?: Partial<ValidationRule>): ValidationRule;
/**
 * Task parse error details
 */
export interface ParseErrorDetails {
    line?: number;
    column?: number;
    context?: string;
    suggestion?: string;
}
/**
 * Task parse error
 */
export declare class TaskParseError extends Error {
    message: string;
    details?: ParseErrorDetails | undefined;
    filename?: string | undefined;
    constructor(message: string, details?: ParseErrorDetails | undefined, filename?: string | undefined);
}
/**
 * Task dependency error
 */
export declare class TaskDependencyError extends Error {
    message: string;
    dependency?: string | undefined;
    taskId?: string | undefined;
    constructor(message: string, dependency?: string | undefined, taskId?: string | undefined);
}
/**
 * Task execution error
 */
export declare class TaskExecutionError extends Error {
    message: string;
    executionId?: string | undefined;
    taskId?: string | undefined;
    constructor(message: string, executionId?: string | undefined, taskId?: string | undefined);
}
/**
 * Task system error
 */
export declare class TaskSystemError extends Error {
    message: string;
    component?: string | undefined;
    operation?: string | undefined;
    constructor(message: string, component?: string | undefined, operation?: string | undefined);
}
/**
 * Detailed task status
 */
export interface DetailedTaskStatus {
    status: string;
    message?: string;
    progress?: number;
    timestamp: Date;
    details?: Record<string, any>;
}
/**
 * Dependency install status
 */
export interface DependencyInstallStatus {
    dependency: string;
    status: 'pending' | 'installing' | 'installed' | 'failed';
    version?: string;
    error?: string;
    progress?: number;
}
/**
 * Execution phase
 */
export declare enum ExecutionPhase {
    INITIALIZATION = "initialization",
    DEPENDENCY_CHECK = "dependency_check",
    DEPENDENCY_INSTALL = "dependency_install",
    CODE_VALIDATION = "code_validation",
    EXECUTION = "execution",
    CLEANUP = "cleanup",
    COMPLETED = "completed",
    FAILED = "failed"
}
//# sourceMappingURL=errors.d.ts.map