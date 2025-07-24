/**
 * Task File Format Type Constraints
 * 
 * This file defines the strict type constraints and validation rules
 * for the JavaScript task file format used in the plugin task system.
 */

import { Parameter, TaskConfig } from './plugin-task-system';
import { ValidationRule, ValidationResult, ValidationType } from './errors';

// ============================================================================
// JSDOC METADATA CONSTRAINTS
// ============================================================================

/**
 * Required JSDoc tags for task metadata
 */
export const REQUIRED_JSDOC_TAGS = [
  '@name',
  '@description',
  '@version',
  '@author'
] as const;

/**
 * Optional JSDoc tags for task metadata
 */
export const OPTIONAL_JSDOC_TAGS = [
  '@category',
  '@tags',
  '@icon',
  '@license',
  '@homepage',
  '@repository',
  '@since',
  '@deprecated'
] as const;

/**
 * All supported JSDoc tags
 */
export type JSDocTag = typeof REQUIRED_JSDOC_TAGS[number] | typeof OPTIONAL_JSDOC_TAGS[number];

/**
 * JSDoc metadata extraction result
 */
export interface JSDocMetadata {
  name: string;                    // @name - Task name
  description: string;             // @description - Task description
  version: string;                 // @version - Semantic version
  author: string;                  // @author - Author name/email
  category?: string;               // @category - Task category
  tags?: string[];                 // @tags - Comma-separated tags
  icon?: string;                   // @icon - Emoji or icon URL
  license?: string;                // @license - License identifier
  homepage?: string;               // @homepage - Homepage URL
  repository?: string;             // @repository - Repository URL
  since?: string;                  // @since - Version when added
  deprecated?: string;             // @deprecated - Deprecation notice
}

// ============================================================================
// TASK FILE STRUCTURE CONSTRAINTS
// ============================================================================

/**
 * Required exports from task file
 */
export const REQUIRED_EXPORTS = [
  'execute'
] as const;

/**
 * Optional exports from task file
 */
export const OPTIONAL_EXPORTS = [
  'parameters',
  'dependencies',
  'config'
] as const;

/**
 * All supported exports
 */
export type TaskFileExport = typeof REQUIRED_EXPORTS[number] | typeof OPTIONAL_EXPORTS[number];

/**
 * Task file execute function signature constraint
 */
export interface ExecuteFunctionSignature {
  name: 'execute';                 // Function must be named 'execute'
  async: boolean;                  // Must be async function
  parameters: ['context'];         // Must accept single 'context' parameter
  returnType: 'Promise<any>';      // Must return Promise
}

/**
 * Task file structure validation schema
 */
export interface TaskFileSchema {
  metadata: {                      // JSDoc metadata block
    required: typeof REQUIRED_JSDOC_TAGS;
    optional: typeof OPTIONAL_JSDOC_TAGS;
    validation: Record<JSDocTag, ValidationRule[]>;
  };
  exports: {                       // Module exports
    required: typeof REQUIRED_EXPORTS;
    optional: typeof OPTIONAL_EXPORTS;
    validation: Record<TaskFileExport, ValidationRule[]>;
  };
  executeFunction: ExecuteFunctionSignature;
}

// ============================================================================
// PARAMETER DEFINITION CONSTRAINTS
// ============================================================================

/**
 * Parameter type validation rules
 */
export const PARAMETER_TYPE_CONSTRAINTS: Record<string, ValidationRule[]> = {
  string: [
    { type: ValidationType.FORMAT, message: 'Must be a valid string', pattern: '^.*$' }
  ],
  number: [
    { type: ValidationType.FORMAT, message: 'Must be a valid number', pattern: '^-?\\d+(\\.\\d+)?$' }
  ],
  boolean: [
    { type: ValidationType.CUSTOM, message: 'Must be true or false', validator: (v) => typeof v === 'boolean' }
  ],
  url: [
    { type: ValidationType.FORMAT, message: 'Must be a valid URL', pattern: '^https?:\\/\\/.+' }
  ],
  email: [
    { type: ValidationType.FORMAT, message: 'Must be a valid email', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
  ]
};

/**
 * Parameter definition validation schema
 */
export interface ParameterSchema {
  name: ValidationRule[];          // Parameter name constraints
  label: ValidationRule[];         // Display label constraints
  type: ValidationRule[];          // Parameter type constraints
  required: ValidationRule[];      // Required flag constraints
  default: ValidationRule[];       // Default value constraints
  validation: ValidationRule[];    // Custom validation constraints
}

// ============================================================================
// DEPENDENCY CONSTRAINTS
// ============================================================================

/**
 * Supported dependency formats
 */
export enum DependencyFormat {
  SIMPLE = 'simple',               // "package-name"
  VERSIONED = 'versioned',         // "package-name@1.0.0"
  RANGED = 'ranged',              // "package-name@^1.0.0"
  SCOPED = 'scoped'               // "@scope/package-name@1.0.0"
}

/**
 * Dependency string validation patterns
 */
export const DEPENDENCY_PATTERNS: Record<DependencyFormat, string> = {
  [DependencyFormat.SIMPLE]: '^[a-z0-9-_]+$',
  [DependencyFormat.VERSIONED]: '^[a-z0-9-_]+@\\d+\\.\\d+\\.\\d+$',
  [DependencyFormat.RANGED]: '^[a-z0-9-_]+@[~^]?\\d+\\.\\d+\\.\\d+$',
  [DependencyFormat.SCOPED]: '^@[a-z0-9-_]+\\/[a-z0-9-_]+(@[~^]?\\d+\\.\\d+\\.\\d+)?$'
};

/**
 * Dependency validation result
 */
export interface DependencyValidation {
  valid: boolean;                  // Whether dependency string is valid
  format: DependencyFormat;        // Detected format
  packageName: string;             // Extracted package name
  version?: string;                // Extracted version (if specified)
  scope?: string;                  // Extracted scope (if scoped)
  errors: string[];                // Validation errors
}

// ============================================================================
// CONFIG CONSTRAINTS
// ============================================================================

/**
 * Task configuration validation schema
 */
export interface TaskConfigSchema {
  timeout: {
    type: 'number';
    min: 1000;                     // Minimum 1 second
    max: 300000;                   // Maximum 5 minutes
    default: 30000;                // Default 30 seconds
  };
  retries: {
    type: 'number';
    min: 0;                        // No retries
    max: 5;                        // Maximum 5 retries
    default: 2;                    // Default 2 retries
  };
  permissions: {
    type: 'array';
    items: 'string';
    allowed: string[];             // List of allowed permissions
    default: [];                   // No permissions by default
  };
  maxMemory: {
    type: 'number';
    min: 64;                       // Minimum 64MB
    max: 2048;                     // Maximum 2GB
    default: 512;                  // Default 512MB
  };
  concurrent: {
    type: 'boolean';
    default: false;                // Not concurrent by default
  };
  priority: {
    type: 'number';
    min: 1;                        // Lowest priority
    max: 10;                       // Highest priority
    default: 5;                    // Normal priority
  };
  restoreBrowserState: {
    type: 'boolean';
    default: true;                 // Restore browser state by default
  };
}

// ============================================================================
// FILE VALIDATION TYPES
// ============================================================================

/**
 * Task file validation context
 */
export interface TaskFileValidationContext {
  filename: string;                // Original filename
  content: string;                 // File content
  size: number;                    // File size in bytes
  encoding: string;                // File encoding
  mimeType?: string;               // MIME type if available
}

/**
 * Validation step types
 */
export enum ValidationStep {
  SYNTAX_CHECK = 'syntax_check',
  METADATA_EXTRACTION = 'metadata_extraction',
  EXPORTS_VALIDATION = 'exports_validation',
  PARAMETER_VALIDATION = 'parameter_validation',
  DEPENDENCY_VALIDATION = 'dependency_validation',
  CONFIG_VALIDATION = 'config_validation',
  EXECUTE_FUNCTION_VALIDATION = 'execute_function_validation',
  SECURITY_SCAN = 'security_scan'
}

/**
 * Validation step result
 */
export interface ValidationStepResult {
  step: ValidationStep;            // Validation step
  success: boolean;                // Whether step passed
  errors: string[];                // Step-specific errors
  warnings: string[];              // Step-specific warnings
  data?: any;                      // Extracted/validated data
  duration: number;                // Validation duration in ms
}

/**
 * Complete file validation result
 */
export interface TaskFileValidationResult {
  valid: boolean;                  // Overall validation result
  steps: ValidationStepResult[];   // Individual step results
  metadata?: JSDocMetadata;        // Extracted metadata
  parameters?: Parameter[];        // Validated parameters
  dependencies?: string[];         // Validated dependencies
  config?: TaskConfig;             // Validated configuration
  executeFunction?: string;        // Extracted execute function
  errors: string[];                // All validation errors
  warnings: string[];              // All validation warnings
  securityIssues: string[];        // Security-related issues
  performance: {                   // Performance metrics
    totalDuration: number;         // Total validation time
    stepDurations: Record<ValidationStep, number>;
  };
}

// ============================================================================
// SECURITY CONSTRAINTS
// ============================================================================

/**
 * Forbidden patterns in task code
 */
export const FORBIDDEN_PATTERNS = [
  // Dangerous Node.js modules
  /require\s*\(\s*['"`]child_process['"`]\s*\)/,
  /require\s*\(\s*['"`]fs['"`]\s*\)/,
  /require\s*\(\s*['"`]path['"`]\s*\)/,
  /require\s*\(\s*['"`]os['"`]\s*\)/,
  /require\s*\(\s*['"`]crypto['"`]\s*\)/,
  
  // Dangerous global objects
  /\bprocess\b/,
  /\bglobal\b/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\brequire\b/,
  
  // Dangerous functions
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bsetTimeout\s*\(/,
  /\bsetInterval\s*\(/,
  
  // Network access
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  
  // File system access
  /\bfile:\/\//,
  /\blocalStorage\b/,
  /\bsessionStorage\b/
] as const;

/**
 * Security scan result
 */
export interface SecurityScanResult {
  safe: boolean;                   // Whether code is considered safe
  issues: Array<{                  // Security issues found
    type: 'forbidden_pattern' | 'suspicious_code' | 'external_access';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    line?: number;
    column?: number;
    pattern?: string;
  }>;
  recommendations: string[];       // Security recommendations
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * JSDoc comment parser options
 */
export interface JSDocParserOptions {
  strict: boolean;                 // Strict parsing mode
  allowUnknownTags: boolean;       // Allow unknown JSDoc tags
  requireAllTags: boolean;         // Require all mandatory tags
  validateValues: boolean;         // Validate tag values
}

/**
 * JavaScript code parser options
 */
export interface CodeParserOptions {
  ecmaVersion: number;             // ECMAScript version
  sourceType: 'script' | 'module'; // Source type
  allowReturnOutsideFunction: boolean;
  allowImportExportEverywhere: boolean;
  allowHashBang: boolean;
}

/**
 * Task file parser configuration
 */
export interface TaskFileParserConfig {
  jsdoc: JSDocParserOptions;       // JSDoc parsing options
  code: CodeParserOptions;         // Code parsing options
  security: {                      // Security options
    enableScan: boolean;
    strictMode: boolean;
    allowedPatterns: RegExp[];
    forbiddenPatterns: RegExp[];
  };
  validation: {                    // Validation options
    enableStrictValidation: boolean;
    maxFileSize: number;           // Maximum file size in bytes
    maxComplexity: number;         // Maximum code complexity
    timeout: number;               // Parsing timeout in ms
  };
}

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

/**
 * Type guard for JSDoc metadata
 */
export function isValidJSDocMetadata(obj: any): obj is JSDocMetadata {
  return (
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.author === 'string'
  );
}

/**
 * Type guard for parameter array
 */
export function isValidParameterArray(obj: any): obj is Parameter[] {
  return (
    Array.isArray(obj) &&
    obj.every(param => 
      typeof param === 'object' &&
      typeof param.name === 'string' &&
      typeof param.label === 'string' &&
      typeof param.type === 'string'
    )
  );
}

/**
 * Type guard for dependency array
 */
export function isValidDependencyArray(obj: any): obj is string[] {
  return (
    Array.isArray(obj) &&
    obj.every(dep => typeof dep === 'string' && dep.length > 0)
  );
}

/**
 * Type guard for task configuration
 */
export function isValidTaskConfig(obj: any): obj is TaskConfig {
  return (
    typeof obj === 'object' &&
    (obj.timeout === undefined || typeof obj.timeout === 'number') &&
    (obj.retries === undefined || typeof obj.retries === 'number') &&
    (obj.permissions === undefined || Array.isArray(obj.permissions))
  );
}

/**
 * Parsed task file structure
 */
export interface TaskFile {
  metadata: JSDocMetadata;         // Extracted metadata
  parameters: Parameter[];         // Parameter definitions
  dependencies: string[];          // Dependency list
  config: TaskConfig;              // Task configuration
  code: string;                    // Task execution code
  executeFunction: string;         // Extracted execute function code
}

/**
 * Task file metadata extracted from JSDoc comments (re-export for compatibility)
 */
export interface TaskFileMetadata extends JSDocMetadata {}

/**
 * Utility type for task file validation
 */
export type TaskFileValidator = (
  context: TaskFileValidationContext,
  config: TaskFileParserConfig
) => Promise<TaskFileValidationResult>;