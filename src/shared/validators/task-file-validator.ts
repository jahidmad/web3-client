/**
 * Task File Validator
 * 
 * This module provides comprehensive validation for task files, including
 * metadata integrity, parameter definitions, and execute function signatures.
 * It works in conjunction with the task file parser to ensure task quality.
 */

import {
  TaskFile,
  TaskFileValidationResult,
  TaskFileValidationContext,
  JSDocMetadata,
  ValidationStep,
  ValidationStepResult,
  TaskConfigSchema,
  PARAMETER_TYPE_CONSTRAINTS,
  DEPENDENCY_PATTERNS,
  DependencyFormat,
  DependencyValidation,
  TaskFileParserConfig
} from '../types/task-file-format';

import {
  Parameter,
  TaskConfig,
  ParameterType,
  TaskError,
  ErrorCode
} from '../types/plugin-task-system';

import {
  ValidationRule,
  ValidationResult,
  ValidationType,
  validateValue
} from '../types/errors';

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

/**
 * Comprehensive task file validator
 */
export class TaskFileValidator {
  private readonly configSchema: TaskConfigSchema;

  constructor() {
    this.configSchema = {
      timeout: {
        type: 'number',
        min: 1000,
        max: 300000,
        default: 30000
      },
      retries: {
        type: 'number',
        min: 0,
        max: 5,
        default: 2
      },
      permissions: {
        type: 'array',
        items: 'string',
        allowed: ['network', 'filesystem', 'clipboard', 'notifications', 'camera', 'microphone'],
        default: []
      },
      maxMemory: {
        type: 'number',
        min: 64,
        max: 2048,
        default: 512
      },
      concurrent: {
        type: 'boolean',
        default: false
      },
      priority: {
        type: 'number',
        min: 1,
        max: 10,
        default: 5
      },
      restoreBrowserState: {
        type: 'boolean',
        default: true
      }
    };
  }

  /**
   * Validate complete task file structure and content
   */
  async validateTaskFile(taskFile: TaskFile): Promise<TaskFileValidationResult> {
    const startTime = Date.now();
    const steps: ValidationStepResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    try {
      // Step 1: Validate metadata integrity
      const metadataResult = await this.validateMetadataIntegrity(taskFile.metadata);
      steps.push(metadataResult);
      if (!metadataResult.success) {
        errors.push(...metadataResult.errors);
      }
      warnings.push(...metadataResult.warnings);

      // Step 2: Validate parameter definitions
      const parametersResult = await this.validateParameterDefinitions(taskFile.parameters);
      steps.push(parametersResult);
      if (!parametersResult.success) {
        errors.push(...parametersResult.errors);
      }
      warnings.push(...parametersResult.warnings);

      // Step 3: Validate dependencies
      const dependenciesResult = await this.validateDependencies(taskFile.dependencies);
      steps.push(dependenciesResult);
      if (!dependenciesResult.success) {
        errors.push(...dependenciesResult.errors);
      }
      warnings.push(...dependenciesResult.warnings);

      // Step 4: Validate configuration
      const configResult = await this.validateConfiguration(taskFile.config);
      steps.push(configResult);
      if (!configResult.success) {
        errors.push(...configResult.errors);
      }
      warnings.push(...configResult.warnings);

      // Step 5: Validate execute function
      const executeFunctionResult = await this.validateExecuteFunction(taskFile.executeFunction);
      steps.push(executeFunctionResult);
      if (!executeFunctionResult.success) {
        errors.push(...executeFunctionResult.errors);
      }
      warnings.push(...executeFunctionResult.warnings);

      // Step 6: Cross-validation checks
      const crossValidationResult = await this.performCrossValidation(taskFile);
      steps.push(crossValidationResult);
      if (!crossValidationResult.success) {
        errors.push(...crossValidationResult.errors);
      }
      warnings.push(...crossValidationResult.warnings);

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const totalDuration = Date.now() - startTime;
    const stepDurations: Record<ValidationStep, number> = {
      [ValidationStep.SYNTAX_CHECK]: 0,
      [ValidationStep.METADATA_EXTRACTION]: 0,
      [ValidationStep.EXPORTS_VALIDATION]: 0,
      [ValidationStep.PARAMETER_VALIDATION]: 0,
      [ValidationStep.DEPENDENCY_VALIDATION]: 0,
      [ValidationStep.CONFIG_VALIDATION]: 0,
      [ValidationStep.EXECUTE_FUNCTION_VALIDATION]: 0,
      [ValidationStep.SECURITY_SCAN]: 0
    };
    steps.forEach(step => {
      stepDurations[step.step] = step.duration;
    });

    return {
      valid: errors.length === 0,
      steps,
      metadata: taskFile.metadata,
      parameters: taskFile.parameters,
      dependencies: taskFile.dependencies,
      config: taskFile.config,
      executeFunction: taskFile.executeFunction,
      errors,
      warnings,
      securityIssues,
      performance: {
        totalDuration,
        stepDurations
      }
    };
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate metadata integrity and format correctness
   */
  private async validateMetadataIntegrity(metadata: JSDocMetadata): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      if (!metadata.name || metadata.name.trim().length === 0) {
        errors.push('Task name is required and cannot be empty');
      } else {
        // Validate name format
        if (metadata.name.length < 3) {
          errors.push('Task name must be at least 3 characters long');
        }
        if (metadata.name.length > 100) {
          errors.push('Task name must be less than 100 characters long');
        }
        if (!/^[a-zA-Z0-9\s\-_&()]+$/.test(metadata.name)) {
          warnings.push('Task name contains special characters that may cause issues');
        }
      }

      if (!metadata.description || metadata.description.trim().length === 0) {
        errors.push('Task description is required and cannot be empty');
      } else {
        if (metadata.description.length < 10) {
          warnings.push('Task description is very short, consider adding more details');
        }
        if (metadata.description.length > 500) {
          warnings.push('Task description is very long, consider making it more concise');
        }
      }

      if (!metadata.version || metadata.version.trim().length === 0) {
        errors.push('Task version is required and cannot be empty');
      } else {
        // Validate semantic versioning
        if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9\-\.]+)?(\+[a-zA-Z0-9\-\.]+)?$/.test(metadata.version)) {
          errors.push('Version must follow semantic versioning format (e.g., 1.0.0, 1.0.0-beta.1)');
        }
      }

      if (!metadata.author || metadata.author.trim().length === 0) {
        errors.push('Task author is required and cannot be empty');
      } else {
        if (metadata.author.length > 100) {
          warnings.push('Author name is very long');
        }
      }

      // Validate optional fields
      if (metadata.category) {
        const validCategories = [
          'Data Extraction', 'Document Generation', 'Form Automation', 
          'Testing', 'Monitoring', 'Content Management', 'API Integration',
          'File Processing', 'Web Scraping', 'Utility', 'Other'
        ];
        if (!validCategories.includes(metadata.category)) {
          warnings.push(`Category '${metadata.category}' is not in the recommended list: ${validCategories.join(', ')}`);
        }
      }

      if (metadata.tags && Array.isArray(metadata.tags)) {
        if (metadata.tags.length > 10) {
          warnings.push('Too many tags, consider limiting to 10 or fewer');
        }
        for (const tag of metadata.tags) {
          if (typeof tag !== 'string' || tag.trim().length === 0) {
            errors.push('All tags must be non-empty strings');
          } else if (tag.length > 30) {
            warnings.push(`Tag '${tag}' is very long, consider shortening it`);
          }
        }
      }

      if (metadata.icon) {
        // Check if it's an emoji or URL
        const isEmoji = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(metadata.icon);
        const isUrl = /^https?:\/\/.+/.test(metadata.icon);
        
        if (!isEmoji && !isUrl) {
          warnings.push('Icon should be an emoji or a valid HTTPS URL');
        }
      }

      if (metadata.homepage && !this.isValidUrl(metadata.homepage)) {
        errors.push('Homepage must be a valid URL');
      }

      if (metadata.repository && !this.isValidUrl(metadata.repository)) {
        errors.push('Repository must be a valid URL');
      }

    } catch (error) {
      errors.push(`Metadata validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.METADATA_EXTRACTION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate parameter definitions and constraints
   */
  private async validateParameterDefinitions(parameters: Parameter[]): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!Array.isArray(parameters)) {
        errors.push('Parameters must be an array');
        return {
          step: ValidationStep.PARAMETER_VALIDATION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      const parameterNames = new Set<string>();

      for (let i = 0; i < parameters.length; i++) {
        const param = parameters[i];
        const paramPrefix = `Parameter ${i + 1} (${param.name || 'unnamed'})`;

        // Validate required fields
        if (!param.name || typeof param.name !== 'string') {
          errors.push(`${paramPrefix}: name is required and must be a string`);
        } else {
          // Check for duplicate names
          if (parameterNames.has(param.name)) {
            errors.push(`${paramPrefix}: duplicate parameter name '${param.name}'`);
          } else {
            parameterNames.add(param.name);
          }

          // Validate name format
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
            errors.push(`${paramPrefix}: name must be a valid JavaScript identifier`);
          }
        }

        if (!param.label || typeof param.label !== 'string') {
          errors.push(`${paramPrefix}: label is required and must be a string`);
        } else if (param.label.length > 100) {
          warnings.push(`${paramPrefix}: label is very long, consider shortening it`);
        }

        if (!param.type || typeof param.type !== 'string') {
          errors.push(`${paramPrefix}: type is required and must be a string`);
        } else {
          // Validate parameter type
          const validTypes: ParameterType[] = [
            'string', 'number', 'boolean', 'url', 'email', 'select', 
            'multiselect', 'file', 'textarea', 'password', 'date', 'time', 'datetime'
          ];
          
          if (!validTypes.includes(param.type as ParameterType)) {
            errors.push(`${paramPrefix}: invalid type '${param.type}'. Valid types: ${validTypes.join(', ')}`);
          } else {
            // Type-specific validation
            await this.validateParameterByType(param, paramPrefix, errors, warnings);
          }
        }

        // Validate optional fields
        if (param.description && param.description.length > 500) {
          warnings.push(`${paramPrefix}: description is very long, consider making it more concise`);
        }

        if (param.validation && typeof param.validation === 'string') {
          try {
            new RegExp(param.validation);
          } catch (regexError) {
            errors.push(`${paramPrefix}: validation regex is invalid`);
          }
        }
      }

      // Check for reasonable parameter count
      if (parameters.length > 20) {
        warnings.push('Task has many parameters, consider grouping related parameters or simplifying the interface');
      }

    } catch (error) {
      errors.push(`Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.PARAMETER_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate parameter by its specific type
   */
  private async validateParameterByType(
    param: Parameter, 
    paramPrefix: string, 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    switch (param.type) {
      case 'number':
        if (param.min !== undefined && typeof param.min !== 'number') {
          errors.push(`${paramPrefix}: min must be a number`);
        }
        if (param.max !== undefined && typeof param.max !== 'number') {
          errors.push(`${paramPrefix}: max must be a number`);
        }
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          errors.push(`${paramPrefix}: min value cannot be greater than max value`);
        }
        if (param.default !== undefined && typeof param.default !== 'number') {
          errors.push(`${paramPrefix}: default value must be a number for number type`);
        }
        break;

      case 'boolean':
        if (param.default !== undefined && typeof param.default !== 'boolean') {
          errors.push(`${paramPrefix}: default value must be a boolean for boolean type`);
        }
        break;

      case 'select':
      case 'multiselect':
        if (!param.options || !Array.isArray(param.options)) {
          errors.push(`${paramPrefix}: ${param.type} type requires options array`);
        } else {
          if (param.options.length === 0) {
            errors.push(`${paramPrefix}: options array cannot be empty`);
          }
          
          for (let j = 0; j < param.options.length; j++) {
            const option = param.options[j];
            if (!option || typeof option !== 'object') {
              errors.push(`${paramPrefix}: option ${j + 1} must be an object`);
            } else {
              if (!option.label || typeof option.label !== 'string') {
                errors.push(`${paramPrefix}: option ${j + 1} must have a string label`);
              }
              if (option.value === undefined) {
                errors.push(`${paramPrefix}: option ${j + 1} must have a value`);
              }
            }
          }

          // Validate default value against options
          if (param.default !== undefined) {
            const validValues = param.options.map(opt => opt.value);
            if (param.type === 'select') {
              if (!validValues.includes(param.default)) {
                errors.push(`${paramPrefix}: default value must be one of the option values`);
              }
            } else if (param.type === 'multiselect') {
              if (!Array.isArray(param.default)) {
                errors.push(`${paramPrefix}: default value for multiselect must be an array`);
              } else {
                for (const defaultVal of param.default) {
                  if (!validValues.includes(defaultVal)) {
                    errors.push(`${paramPrefix}: default value '${defaultVal}' is not in options`);
                  }
                }
              }
            }
          }
        }
        break;

      case 'url':
        if (param.default && typeof param.default === 'string' && !this.isValidUrl(param.default)) {
          warnings.push(`${paramPrefix}: default value does not appear to be a valid URL`);
        }
        break;

      case 'email':
        if (param.default && typeof param.default === 'string' && !this.isValidEmail(param.default)) {
          warnings.push(`${paramPrefix}: default value does not appear to be a valid email`);
        }
        break;

      case 'string':
      case 'textarea':
      case 'password':
        if (param.default !== undefined && typeof param.default !== 'string') {
          errors.push(`${paramPrefix}: default value must be a string for ${param.type} type`);
        }
        break;

      case 'file':
        // File type specific validations could be added here
        if (param.default !== undefined) {
          warnings.push(`${paramPrefix}: default values for file type are not recommended`);
        }
        break;

      case 'date':
      case 'time':
      case 'datetime':
        if (param.default !== undefined && typeof param.default !== 'string') {
          errors.push(`${paramPrefix}: default value must be a string for ${param.type} type`);
        }
        break;
    }
  }

  /**
   * Validate dependencies format and structure
   */
  private async validateDependencies(dependencies: string[]): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!Array.isArray(dependencies)) {
        errors.push('Dependencies must be an array');
        return {
          step: ValidationStep.DEPENDENCY_VALIDATION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      const dependencyNames = new Set<string>();

      for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        const depPrefix = `Dependency ${i + 1}`;

        if (typeof dep !== 'string' || dep.trim().length === 0) {
          errors.push(`${depPrefix}: must be a non-empty string`);
          continue;
        }

        // Validate dependency format
        const validation = this.validateDependencyFormat(dep);
        if (!validation.valid) {
          errors.push(`${depPrefix}: ${validation.error}`);
          continue;
        }

        // Check for duplicates
        const packageName = validation.packageName!;
        if (dependencyNames.has(packageName)) {
          errors.push(`${depPrefix}: duplicate dependency '${packageName}'`);
        } else {
          dependencyNames.add(packageName);
        }

        // Security checks
        if (this.isKnownProblematicPackage(packageName)) {
          warnings.push(`${depPrefix}: '${packageName}' is known to have security issues or is deprecated`);
        }

        // Version recommendations
        if (!validation.version) {
          warnings.push(`${depPrefix}: consider specifying a version for '${packageName}' to ensure reproducible builds`);
        }
      }

      // Check for reasonable dependency count
      if (dependencies.length > 10) {
        warnings.push('Task has many dependencies, consider if all are necessary');
      }

    } catch (error) {
      errors.push(`Dependencies validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.DEPENDENCY_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate task configuration
   */
  private async validateConfiguration(config: TaskConfig): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (typeof config !== 'object' || config === null) {
        errors.push('Config must be an object');
        return {
          step: ValidationStep.CONFIG_VALIDATION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      // Validate timeout
      if (config.timeout !== undefined) {
        const timeoutSchema = this.configSchema.timeout;
        if (typeof config.timeout !== 'number') {
          errors.push('Config timeout must be a number');
        } else if (config.timeout < timeoutSchema.min || config.timeout > timeoutSchema.max) {
          errors.push(`Config timeout must be between ${timeoutSchema.min} and ${timeoutSchema.max} milliseconds`);
        } else if (config.timeout > 60000) {
          warnings.push('Long timeout values may impact user experience');
        }
      }

      // Validate retries
      if (config.retries !== undefined) {
        const retriesSchema = this.configSchema.retries;
        if (typeof config.retries !== 'number' || !Number.isInteger(config.retries)) {
          errors.push('Config retries must be an integer');
        } else if (config.retries < retriesSchema.min || config.retries > retriesSchema.max) {
          errors.push(`Config retries must be between ${retriesSchema.min} and ${retriesSchema.max}`);
        }
      }

      // Validate permissions
      if (config.permissions !== undefined) {
        if (!Array.isArray(config.permissions)) {
          errors.push('Config permissions must be an array');
        } else {
          const allowedPermissions = this.configSchema.permissions.allowed;
          for (const permission of config.permissions) {
            if (typeof permission !== 'string') {
              errors.push('All permissions must be strings');
            } else if (!allowedPermissions.includes(permission)) {
              errors.push(`Invalid permission '${permission}'. Allowed: ${allowedPermissions.join(', ')}`);
            }
          }

          // Security warnings
          if (config.permissions.includes('filesystem')) {
            warnings.push('Filesystem permission allows file system access - ensure this is necessary');
          }
          if (config.permissions.includes('network')) {
            warnings.push('Network permission allows external requests - ensure this is necessary');
          }
        }
      }

      // Validate maxMemory
      if (config.maxMemory !== undefined) {
        const memorySchema = this.configSchema.maxMemory;
        if (typeof config.maxMemory !== 'number') {
          errors.push('Config maxMemory must be a number');
        } else if (config.maxMemory < memorySchema.min || config.maxMemory > memorySchema.max) {
          errors.push(`Config maxMemory must be between ${memorySchema.min} and ${memorySchema.max} MB`);
        } else if (config.maxMemory > 1024) {
          warnings.push('High memory limits may impact system performance');
        }
      }

      // Validate concurrent
      if (config.concurrent !== undefined && typeof config.concurrent !== 'boolean') {
        errors.push('Config concurrent must be a boolean');
      }

      // Validate priority
      if (config.priority !== undefined) {
        const prioritySchema = this.configSchema.priority;
        if (typeof config.priority !== 'number' || !Number.isInteger(config.priority)) {
          errors.push('Config priority must be an integer');
        } else if (config.priority < prioritySchema.min || config.priority > prioritySchema.max) {
          errors.push(`Config priority must be between ${prioritySchema.min} and ${prioritySchema.max}`);
        }
      }

    } catch (error) {
      errors.push(`Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.CONFIG_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate execute function signature and structure
   */
  private async validateExecuteFunction(executeFunction: string): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!executeFunction || typeof executeFunction !== 'string') {
        errors.push('Execute function is required');
        return {
          step: ValidationStep.EXECUTE_FUNCTION_VALIDATION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      // Check function signature
      if (!executeFunction.includes('async function execute')) {
        errors.push('Execute function must be declared as "async function execute"');
      }

      if (!executeFunction.includes('(context)') && !executeFunction.includes('( context )')) {
        errors.push('Execute function must accept a single "context" parameter');
      }
      
      // Check for invalid function name
      if (executeFunction.includes('function executeTask') || 
          executeFunction.includes('function run') ||
          (executeFunction.includes('function') && !executeFunction.includes('function execute'))) {
        errors.push('Execute function must be named "execute"');
      }

      // Check for proper structure
      const functionBody = executeFunction.match(/\{([\s\S]*)\}/)?.[1];
      if (!functionBody) {
        errors.push('Execute function must have a proper function body');
        return {
          step: ValidationStep.EXECUTE_FUNCTION_VALIDATION,
          success: false,
          errors,
          warnings,
          duration: Date.now() - startTime
        };
      }

      // Check for context usage
      const contextProperties = ['page', 'params', 'log', 'progress', 'browser', 'utils'];
      const usedProperties = contextProperties.filter(prop => functionBody.includes(prop));
      
      if (usedProperties.length === 0) {
        warnings.push('Execute function does not use any context properties');
      } else if (usedProperties.length === 1 && usedProperties[0] === 'params') {
        warnings.push('Execute function only uses params - consider using other context properties like log or progress');
      }

      // Check for error handling
      if (!functionBody.includes('try') || !functionBody.includes('catch')) {
        warnings.push('Execute function should include try/catch error handling');
      }

      // Check for return statement
      if (!functionBody.includes('return')) {
        warnings.push('Execute function should return a result object');
      } else {
        // Check for proper return structure
        if (functionBody.includes('return {') && functionBody.includes('success:')) {
          // Good - structured return
        } else {
          warnings.push('Execute function should return an object with at least a "success" property');
        }
      }

      // Check for progress reporting
      if (!functionBody.includes('progress(')) {
        warnings.push('Execute function should report progress using progress() function');
      }

      // Check for logging
      if (!functionBody.includes('log(')) {
        warnings.push('Execute function should use log() function for debugging and user feedback');
      }

      // Check for async/await usage
      if (functionBody.includes('await')) {
        // Good - using async operations
      } else {
        warnings.push('Execute function is async but does not use await - consider if async is necessary');
      }

      // Check function complexity (basic heuristic)
      const lineCount = functionBody.split('\n').length;
      if (lineCount > 200) {
        warnings.push('Execute function is very long - consider breaking it into smaller functions');
      }

      const cyclomaticComplexity = this.calculateCyclomaticComplexity(functionBody);
      if (cyclomaticComplexity > 20) {
        warnings.push('Execute function has high complexity - consider simplifying the logic');
      }

    } catch (error) {
      errors.push(`Execute function validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.EXECUTE_FUNCTION_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Perform cross-validation between different parts of the task file
   */
  private async performCrossValidation(taskFile: TaskFile): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check consistency between metadata and parameters
      if (taskFile.parameters.length === 0 && taskFile.executeFunction.includes('params.')) {
        warnings.push('Execute function references params but no parameters are defined');
      }

      // Check if required permissions match function usage
      const functionBody = taskFile.executeFunction;
      const declaredPermissions = taskFile.config.permissions || [];

      if (functionBody.includes('fetch(') || functionBody.includes('axios') || functionBody.includes('request')) {
        if (!declaredPermissions.includes('network')) {
          warnings.push('Execute function appears to make network requests but network permission is not declared');
        }
      }

      if (functionBody.includes('fs.') || 
          functionBody.includes('writeFile') || 
          functionBody.includes('readFile') ||
          functionBody.includes('saveFile') ||
          functionBody.includes('utils.saveFile') ||
          functionBody.includes('utils.readFile') ||
          functionBody.includes('utils.fileExists')) {
        if (!declaredPermissions.includes('filesystem')) {
          warnings.push('Execute function appears to use filesystem but filesystem permission is not declared');
        }
      }

      // Check parameter usage in execute function
      for (const param of taskFile.parameters) {
        if (!functionBody.includes(`params.${param.name}`)) {
          warnings.push(`Parameter '${param.name}' is defined but not used in execute function`);
        }
      }

      // Check for potential security issues
      if (functionBody.includes('eval(') || functionBody.includes('new Function(')) {
        errors.push('Execute function contains potentially unsafe code evaluation');
      }

      // Check for proper browser API usage
      if (functionBody.includes('browser.') && !declaredPermissions.includes('network')) {
        warnings.push('Execute function uses browser API but network permission is not declared');
      }

    } catch (error) {
      errors.push(`Cross-validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.EXPORTS_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Calculate cyclomatic complexity (basic heuristic)
   */
  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const decisionPatterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b\?\b/g, // Ternary operator
      /\|\|/g,   // Logical OR
      /&&/g      // Logical AND
    ];

    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Validate dependency format
   */
  private validateDependencyFormat(dependency: string): { valid: boolean; error?: string; packageName?: string; version?: string } {
    if (!dependency || typeof dependency !== 'string') {
      return { valid: false, error: 'Dependency must be a string' };
    }

    // Check for scoped package
    if (dependency.startsWith('@')) {
      const scopedMatch = dependency.match(/^(@[a-z0-9-_]+\/[a-z0-9-_]+)(?:@([~^]?\d+\.\d+\.\d+))?$/);
      if (!scopedMatch) {
        return { valid: false, error: 'Invalid scoped package format' };
      }
      return { valid: true, packageName: scopedMatch[1], version: scopedMatch[2] };
    }

    // Check for versioned package
    const versionedMatch = dependency.match(/^([a-z0-9-_]+)@([~^]?\d+\.\d+\.\d+)$/);
    if (versionedMatch) {
      return { valid: true, packageName: versionedMatch[1], version: versionedMatch[2] };
    }

    // Check for simple package name
    const simpleMatch = dependency.match(/^([a-z0-9-_]+)$/);
    if (simpleMatch) {
      return { valid: true, packageName: simpleMatch[1] };
    }

    return { valid: false, error: 'Invalid dependency format' };
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if email is valid
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Check if package is known to be problematic
   */
  private isKnownProblematicPackage(packageName: string): boolean {
    const problematicPackages = [
      'event-stream',
      'left-pad',
      'colors',
      'faker',
      'node-ipc',
      'ua-parser-js',
      'coa',
      'rc',
      'npm-run',
      'cross-env'
    ];
    return problematicPackages.includes(packageName);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new task file validator
 */
export function createTaskFileValidator(): TaskFileValidator {
  return new TaskFileValidator();
}

/**
 * Validate a task file with default settings
 */
export async function validateTaskFile(taskFile: TaskFile): Promise<TaskFileValidationResult> {
  const validator = createTaskFileValidator();
  return validator.validateTaskFile(taskFile);
}

/**
 * Quick validation check for task file
 */
export async function quickValidateTaskFile(taskFile: TaskFile): Promise<{ valid: boolean; errors: string[] }> {
  const result = await validateTaskFile(taskFile);
  
  return {
    valid: result.valid,
    errors: result.errors
  };
}