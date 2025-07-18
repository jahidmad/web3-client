/**
 * JavaScript Task File Parser
 *
 * This module implements the core functionality for parsing JavaScript task files
 * in the plugin task system. It extracts JSDoc metadata, validates exports,
 * and provides comprehensive error handling.
 */
import { TaskFile, TaskFileValidationResult, TaskFileValidationContext, TaskFileParserConfig } from '../types/task-file-format';
/**
 * Main task file parser class
 */
export declare class TaskFileParser {
    private config;
    constructor(config?: Partial<TaskFileParserConfig>);
    /**
     * Parse a task file and return the parsed structure
     */
    parseTaskFile(context: TaskFileValidationContext): Promise<TaskFile>;
    /**
     * Validate a task file and return detailed validation results
     */
    validateTaskFile(context: TaskFileValidationContext): Promise<TaskFileValidationResult>;
    /**
     * Validate JavaScript syntax
     */
    private validateSyntax;
    /**
      * Extract and validate JSDoc metadata
      */
    private extractMetadata;
    /**
     * Validate module exports
     */
    private validateExports;
    /**
     * Validate parameters definition
     */
    private validateParameters;
    /**
     * Validate dependencies definition
     */
    private validateDependencies;
    /**
       * Validate configuration definition
       */
    private validateConfig;
    /**
     * Validate execute function
     */
    private validateExecuteFunction;
    /**
     * Perform security scan on the code
     */
    private performSecurityScan;
    /**
     * Safely evaluate JavaScript code
     */
    private safeEvaluate;
    /**
     * Validate URL format
     */
    private isValidUrl;
    /**
     * Validate dependency string format
     */
    private validateDependencyString;
}
/**
 * Create a new task file parser with default configuration
 */
export declare function createTaskFileParser(config?: Partial<TaskFileParserConfig>): TaskFileParser;
/**
 * Parse a task file with default settings
 */
export declare function parseTaskFile(filename: string, content: string, encoding?: string): Promise<TaskFile>;
/**
 * Validate a task file with default settings
 */
export declare function validateTaskFile(filename: string, content: string, encoding?: string): Promise<TaskFileValidationResult>;
//# sourceMappingURL=task-file-parser.d.ts.map