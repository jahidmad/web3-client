/**
 * Validation Types
 * 
 * This module defines types for validation results and errors.
 */

/**
 * 验证错误级别
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * 验证错误类型
 */
export enum ValidationErrorType {
  MISSING_FIELD = 'missing_field',
  INVALID_TYPE = 'invalid_type',
  INVALID_FORMAT = 'invalid_format',
  INVALID_VALUE = 'invalid_value',
  MISSING_FUNCTION = 'missing_function',
  MISSING_EXPORT = 'missing_export',
  OTHER = 'other'
}

/**
 * 验证错误
 */
export interface ValidationError {
  type: ValidationErrorType;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  path?: string;
  suggestion?: string;
}

/**
 * 应用的修复
 */
export interface AppliedFix {
  description: string;
  field?: string;
  path?: string;
  before?: string;
  after?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  fixes: AppliedFix[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalInfos: number;
    totalFixes: number;
  };
}