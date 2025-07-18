/**
 * Task File Validator
 *
 * This module provides comprehensive validation for task files, including
 * metadata integrity, parameter definitions, and execute function signatures.
 * It works in conjunction with the task file parser to ensure task quality.
 */
import { TaskFile, TaskFileValidationResult } from '../types/task-file-format';
/**
 * Comprehensive task file validator
 */
export declare class TaskFileValidator {
    private readonly configSchema;
    constructor();
    /**
     * Validate complete task file structure and content
     */
    validateTaskFile(taskFile: TaskFile): Promise<TaskFileValidationResult>;
    /**
     * Validate metadata integrity and format correctness
     */
    private validateMetadataIntegrity;
    /**
     * Validate parameter definitions and constraints
     */
    private validateParameterDefinitions;
    /**
     * Validate parameter by its specific type
     */
    private validateParameterByType;
    /**
     * Validate dependencies format and structure
     */
    private validateDependencies;
    /**
     * Validate task configuration
     */
    private validateConfiguration;
    /**
     * Validate execute function signature and structure
     */
    private validateExecuteFunction;
    /**
     * Perform cross-validation between different parts of the task file
     */
    private performCrossValidation;
    /**
     * Calculate cyclomatic complexity (basic heuristic)
     */
    private calculateCyclomaticComplexity;
    /**
     * Validate dependency format
     */
    private validateDependencyFormat;
    /**
     * Check if URL is valid
     */
    private isValidUrl;
    /**
     * Check if email is valid
     */
    private isValidEmail;
    /**
     * Check if package is known to be problematic
     */
    private isKnownProblematicPackage;
}
/**
 * Create a new task file validator
 */
export declare function createTaskFileValidator(): TaskFileValidator;
/**
 * Validate a task file with default settings
 */
export declare function validateTaskFile(taskFile: TaskFile): Promise<TaskFileValidationResult>;
/**
 * Quick validation check for task file
 */
export declare function quickValidateTaskFile(taskFile: TaskFile): Promise<{
    valid: boolean;
    errors: string[];
}>;
//# sourceMappingURL=task-file-validator.d.ts.map