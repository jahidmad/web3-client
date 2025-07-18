/**
 * Error Types and Validation
 * 
 * This file defines error types and validation utilities used throughout
 * the plugin task system.
 */

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation types
 */
export enum ValidationType {
  FORMAT = 'format',
  CUSTOM = 'custom',
  REQUIRED = 'required',
  LENGTH = 'length',
  RANGE = 'range'
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

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Validate a value against a set of rules
 */
export function validateValue(value: any, rules: ValidationRule[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case ValidationType.FORMAT:
        if (rule.pattern && typeof value === 'string') {
          const regex = new RegExp(rule.pattern);
          if (!regex.test(value)) {
            errors.push(rule.message);
          }
        }
        break;

      case ValidationType.CUSTOM:
        if (rule.validator && !rule.validator(value)) {
          errors.push(rule.message);
        }
        break;

      case ValidationType.REQUIRED:
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push(rule.message);
        }
        break;

      case ValidationType.LENGTH:
        if (typeof value === 'string' || Array.isArray(value)) {
          if (rule.min !== undefined && value.length < rule.min) {
            errors.push(rule.message);
          }
          if (rule.max !== undefined && value.length > rule.max) {
            errors.push(rule.message);
          }
        }
        break;

      case ValidationType.RANGE:
        if (typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            errors.push(rule.message);
          }
          if (rule.max !== undefined && value > rule.max) {
            errors.push(rule.message);
          }
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a validation rule
 */
export function createValidationRule(
  type: ValidationType,
  message: string,
  options: Partial<ValidationRule> = {}
): ValidationRule {
  return {
    type,
    message,
    ...options
  };
}

// ============================================================================
// TASK SYSTEM ERROR TYPES
// ============================================================================

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
export class TaskParseError extends Error {
  constructor(
    public message: string,
    public details?: ParseErrorDetails,
    public filename?: string
  ) {
    super(message);
    this.name = 'TaskParseError';
  }
}

/**
 * Task dependency error
 */
export class TaskDependencyError extends Error {
  constructor(
    public message: string,
    public dependency?: string,
    public taskId?: string
  ) {
    super(message);
    this.name = 'TaskDependencyError';
  }
}

/**
 * Task execution error
 */
export class TaskExecutionError extends Error {
  constructor(
    public message: string,
    public executionId?: string,
    public taskId?: string
  ) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

/**
 * Task system error
 */
export class TaskSystemError extends Error {
  constructor(
    public message: string,
    public component?: string,
    public operation?: string
  ) {
    super(message);
    this.name = 'TaskSystemError';
  }
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
export enum ExecutionPhase {
  INITIALIZATION = 'initialization',
  DEPENDENCY_CHECK = 'dependency_check',
  DEPENDENCY_INSTALL = 'dependency_install',
  CODE_VALIDATION = 'code_validation',
  EXECUTION = 'execution',
  CLEANUP = 'cleanup',
  COMPLETED = 'completed',
  FAILED = 'failed'
}