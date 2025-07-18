/**
 * Task File Format Type Constraints
 *
 * This file defines the strict type constraints and validation rules
 * for the JavaScript task file format used in the plugin task system.
 */
import { Parameter, TaskConfig } from './plugin-task-system';
import { ValidationRule } from './errors';
/**
 * Required JSDoc tags for task metadata
 */
export declare const REQUIRED_JSDOC_TAGS: readonly ["@name", "@description", "@version", "@author"];
/**
 * Optional JSDoc tags for task metadata
 */
export declare const OPTIONAL_JSDOC_TAGS: readonly ["@category", "@tags", "@icon", "@license", "@homepage", "@repository", "@since", "@deprecated"];
/**
 * All supported JSDoc tags
 */
export type JSDocTag = typeof REQUIRED_JSDOC_TAGS[number] | typeof OPTIONAL_JSDOC_TAGS[number];
/**
 * JSDoc metadata extraction result
 */
export interface JSDocMetadata {
    name: string;
    description: string;
    version: string;
    author: string;
    category?: string;
    tags?: string[];
    icon?: string;
    license?: string;
    homepage?: string;
    repository?: string;
    since?: string;
    deprecated?: string;
}
/**
 * Required exports from task file
 */
export declare const REQUIRED_EXPORTS: readonly ["execute"];
/**
 * Optional exports from task file
 */
export declare const OPTIONAL_EXPORTS: readonly ["parameters", "dependencies", "config"];
/**
 * All supported exports
 */
export type TaskFileExport = typeof REQUIRED_EXPORTS[number] | typeof OPTIONAL_EXPORTS[number];
/**
 * Task file execute function signature constraint
 */
export interface ExecuteFunctionSignature {
    name: 'execute';
    async: boolean;
    parameters: ['context'];
    returnType: 'Promise<any>';
}
/**
 * Task file structure validation schema
 */
export interface TaskFileSchema {
    metadata: {
        required: typeof REQUIRED_JSDOC_TAGS;
        optional: typeof OPTIONAL_JSDOC_TAGS;
        validation: Record<JSDocTag, ValidationRule[]>;
    };
    exports: {
        required: typeof REQUIRED_EXPORTS;
        optional: typeof OPTIONAL_EXPORTS;
        validation: Record<TaskFileExport, ValidationRule[]>;
    };
    executeFunction: ExecuteFunctionSignature;
}
/**
 * Parameter type validation rules
 */
export declare const PARAMETER_TYPE_CONSTRAINTS: Record<string, ValidationRule[]>;
/**
 * Parameter definition validation schema
 */
export interface ParameterSchema {
    name: ValidationRule[];
    label: ValidationRule[];
    type: ValidationRule[];
    required: ValidationRule[];
    default: ValidationRule[];
    validation: ValidationRule[];
}
/**
 * Supported dependency formats
 */
export declare enum DependencyFormat {
    SIMPLE = "simple",// "package-name"
    VERSIONED = "versioned",// "package-name@1.0.0"
    RANGED = "ranged",// "package-name@^1.0.0"
    SCOPED = "scoped"
}
/**
 * Dependency string validation patterns
 */
export declare const DEPENDENCY_PATTERNS: Record<DependencyFormat, string>;
/**
 * Dependency validation result
 */
export interface DependencyValidation {
    valid: boolean;
    format: DependencyFormat;
    packageName: string;
    version?: string;
    scope?: string;
    errors: string[];
}
/**
 * Task configuration validation schema
 */
export interface TaskConfigSchema {
    timeout: {
        type: 'number';
        min: 1000;
        max: 300000;
        default: 30000;
    };
    retries: {
        type: 'number';
        min: 0;
        max: 5;
        default: 2;
    };
    permissions: {
        type: 'array';
        items: 'string';
        allowed: string[];
        default: [];
    };
    maxMemory: {
        type: 'number';
        min: 64;
        max: 2048;
        default: 512;
    };
    concurrent: {
        type: 'boolean';
        default: false;
    };
    priority: {
        type: 'number';
        min: 1;
        max: 10;
        default: 5;
    };
}
/**
 * Task file validation context
 */
export interface TaskFileValidationContext {
    filename: string;
    content: string;
    size: number;
    encoding: string;
    mimeType?: string;
}
/**
 * Validation step types
 */
export declare enum ValidationStep {
    SYNTAX_CHECK = "syntax_check",
    METADATA_EXTRACTION = "metadata_extraction",
    EXPORTS_VALIDATION = "exports_validation",
    PARAMETER_VALIDATION = "parameter_validation",
    DEPENDENCY_VALIDATION = "dependency_validation",
    CONFIG_VALIDATION = "config_validation",
    EXECUTE_FUNCTION_VALIDATION = "execute_function_validation",
    SECURITY_SCAN = "security_scan"
}
/**
 * Validation step result
 */
export interface ValidationStepResult {
    step: ValidationStep;
    success: boolean;
    errors: string[];
    warnings: string[];
    data?: any;
    duration: number;
}
/**
 * Complete file validation result
 */
export interface TaskFileValidationResult {
    valid: boolean;
    steps: ValidationStepResult[];
    metadata?: JSDocMetadata;
    parameters?: Parameter[];
    dependencies?: string[];
    config?: TaskConfig;
    executeFunction?: string;
    errors: string[];
    warnings: string[];
    securityIssues: string[];
    performance: {
        totalDuration: number;
        stepDurations: Record<ValidationStep, number>;
    };
}
/**
 * Forbidden patterns in task code
 */
export declare const FORBIDDEN_PATTERNS: readonly [RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp, RegExp];
/**
 * Security scan result
 */
export interface SecurityScanResult {
    safe: boolean;
    issues: Array<{
        type: 'forbidden_pattern' | 'suspicious_code' | 'external_access';
        severity: 'low' | 'medium' | 'high' | 'critical';
        message: string;
        line?: number;
        column?: number;
        pattern?: string;
    }>;
    recommendations: string[];
}
/**
 * JSDoc comment parser options
 */
export interface JSDocParserOptions {
    strict: boolean;
    allowUnknownTags: boolean;
    requireAllTags: boolean;
    validateValues: boolean;
}
/**
 * JavaScript code parser options
 */
export interface CodeParserOptions {
    ecmaVersion: number;
    sourceType: 'script' | 'module';
    allowReturnOutsideFunction: boolean;
    allowImportExportEverywhere: boolean;
    allowHashBang: boolean;
}
/**
 * Task file parser configuration
 */
export interface TaskFileParserConfig {
    jsdoc: JSDocParserOptions;
    code: CodeParserOptions;
    security: {
        enableScan: boolean;
        strictMode: boolean;
        allowedPatterns: RegExp[];
        forbiddenPatterns: RegExp[];
    };
    validation: {
        enableStrictValidation: boolean;
        maxFileSize: number;
        maxComplexity: number;
        timeout: number;
    };
}
/**
 * Type guard for JSDoc metadata
 */
export declare function isValidJSDocMetadata(obj: any): obj is JSDocMetadata;
/**
 * Type guard for parameter array
 */
export declare function isValidParameterArray(obj: any): obj is Parameter[];
/**
 * Type guard for dependency array
 */
export declare function isValidDependencyArray(obj: any): obj is string[];
/**
 * Type guard for task configuration
 */
export declare function isValidTaskConfig(obj: any): obj is TaskConfig;
/**
 * Parsed task file structure
 */
export interface TaskFile {
    metadata: JSDocMetadata;
    parameters: Parameter[];
    dependencies: string[];
    config: TaskConfig;
    code: string;
    executeFunction: string;
}
/**
 * Task file metadata extracted from JSDoc comments (re-export for compatibility)
 */
export interface TaskFileMetadata extends JSDocMetadata {
}
/**
 * Utility type for task file validation
 */
export type TaskFileValidator = (context: TaskFileValidationContext, config: TaskFileParserConfig) => Promise<TaskFileValidationResult>;
//# sourceMappingURL=task-file-format.d.ts.map