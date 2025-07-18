/**
 * JavaScript Task File Parser
 * 
 * This module implements the core functionality for parsing JavaScript task files
 * in the plugin task system. It extracts JSDoc metadata, validates exports,
 * and provides comprehensive error handling.
 */

import { 
  TaskFile, 
  TaskFileMetadata, 
  TaskFileValidationResult, 
  TaskFileValidationContext,
  TaskFileParserConfig,
  JSDocMetadata,
  ValidationStep,
  ValidationStepResult,
  SecurityScanResult,
  REQUIRED_JSDOC_TAGS,
  OPTIONAL_JSDOC_TAGS,
  REQUIRED_EXPORTS,
  OPTIONAL_EXPORTS,
  FORBIDDEN_PATTERNS,
  isValidJSDocMetadata,
  isValidParameterArray,
  isValidDependencyArray,
  isValidTaskConfig
} from '../types/task-file-format';

import { 
  Parameter, 
  TaskConfig, 
  TaskError, 
  ErrorCode 
} from '../types/plugin-task-system';

import { 
  TaskParseError, 
  ParseErrorDetails 
} from '../types/errors';

// ============================================================================
// PARSER CLASS
// ============================================================================

/**
 * Main task file parser class
 */
export class TaskFileParser {
  private config: TaskFileParserConfig;

  constructor(config?: Partial<TaskFileParserConfig>) {
    this.config = {
      jsdoc: {
        strict: true,
        allowUnknownTags: false,
        requireAllTags: true,
        validateValues: true,
        ...config?.jsdoc
      },
      code: {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowReturnOutsideFunction: false,
        allowImportExportEverywhere: false,
        allowHashBang: false,
        ...config?.code
      },
      security: {
        enableScan: true,
        strictMode: true,
        allowedPatterns: [],
        forbiddenPatterns: [...FORBIDDEN_PATTERNS],
        ...config?.security
      },
      validation: {
        enableStrictValidation: true,
        maxFileSize: 1024 * 1024, // 1MB
        maxComplexity: 100,
        timeout: 10000, // 10 seconds
        ...config?.validation
      }
    };
  }

  /**
   * Parse a task file and return the parsed structure
   */
  async parseTaskFile(context: TaskFileValidationContext): Promise<TaskFile> {
    const validationResult = await this.validateTaskFile(context);
    
    if (!validationResult.valid) {
      throw new TaskParseError(
        `Task file validation failed: ${validationResult.errors.join(', ')}`,
        {
          context: `Expected valid task file format, got invalid format in ${context.filename}`,
          suggestion: 'Check the file format and fix the validation errors'
        }
      );
    }

    return {
      metadata: validationResult.metadata!,
      parameters: validationResult.parameters || [],
      dependencies: validationResult.dependencies || [],
      config: validationResult.config || {},
      code: context.content,
      executeFunction: validationResult.executeFunction || ''
    };
  }

  /**
   * Validate a task file and return detailed validation results
   */
  async validateTaskFile(context: TaskFileValidationContext): Promise<TaskFileValidationResult> {
    const startTime = Date.now();
    const steps: ValidationStepResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    let metadata: JSDocMetadata | undefined;
    let parameters: Parameter[] | undefined;
    let dependencies: string[] | undefined;
    let config: TaskConfig | undefined;
    let executeFunction: string | undefined;

    try {
      // Step 1: Basic syntax check
      const syntaxResult = await this.validateSyntax(context);
      steps.push(syntaxResult);
      if (!syntaxResult.success) {
        errors.push(...syntaxResult.errors);
      }

      // Step 2: Extract and validate metadata
      const metadataResult = await this.extractMetadata(context);
      steps.push(metadataResult);
      if (metadataResult.success && metadataResult.data) {
        metadata = metadataResult.data;
      } else {
        errors.push(...metadataResult.errors);
      }

      // Step 3: Validate exports
      const exportsResult = await this.validateExports(context);
      steps.push(exportsResult);
      if (!exportsResult.success) {
        errors.push(...exportsResult.errors);
      }

      // Step 4: Validate parameters
      const parametersResult = await this.validateParameters(context);
      steps.push(parametersResult);
      if (parametersResult.success && parametersResult.data) {
        parameters = parametersResult.data;
      } else if (parametersResult.errors.length > 0) {
        errors.push(...parametersResult.errors);
      }
      warnings.push(...parametersResult.warnings);

      // Step 5: Validate dependencies
      const dependenciesResult = await this.validateDependencies(context);
      steps.push(dependenciesResult);
      if (dependenciesResult.success && dependenciesResult.data) {
        dependencies = dependenciesResult.data;
      } else if (dependenciesResult.errors.length > 0) {
        errors.push(...dependenciesResult.errors);
      }
      warnings.push(...dependenciesResult.warnings);

      // Step 6: Validate configuration
      const configResult = await this.validateConfig(context);
      steps.push(configResult);
      if (configResult.success && configResult.data) {
        config = configResult.data;
      } else if (configResult.errors.length > 0) {
        errors.push(...configResult.errors);
      }
      warnings.push(...configResult.warnings);

      // Step 7: Validate execute function
      const executeFunctionResult = await this.validateExecuteFunction(context);
      steps.push(executeFunctionResult);
      if (executeFunctionResult.success && executeFunctionResult.data) {
        executeFunction = executeFunctionResult.data;
      } else {
        errors.push(...executeFunctionResult.errors);
      }

      // Step 8: Security scan
      if (this.config.security.enableScan) {
        const securityResult = await this.performSecurityScan(context);
        steps.push(securityResult);
        if (securityResult.data) {
          const scanResult = securityResult.data as SecurityScanResult;
          securityIssues.push(...scanResult.issues.map(issue => issue.message));
          if (!scanResult.safe) {
            errors.push('Security scan failed: potentially unsafe code detected');
          }
        }
      }

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
      metadata,
      parameters,
      dependencies,
      config,
      executeFunction,
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
  // VALIDATION STEPS
  // ============================================================================

  /**
   * Validate JavaScript syntax
   */
  private async validateSyntax(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Check file size
      if (context.size > this.config.validation.maxFileSize) {
        errors.push(`File size (${context.size} bytes) exceeds maximum allowed size (${this.config.validation.maxFileSize} bytes)`);
      }

      // Basic syntax validation using Function constructor
      try {
        new Function(context.content);
      } catch (syntaxError) {
        const error = syntaxError as SyntaxError;
        errors.push(`Syntax error: ${error.message}`);
      }

      // Check for basic structure
      if (!context.content.includes('function execute')) {
        errors.push('Missing execute function');
      }

      if (!context.content.includes('module.exports')) {
        errors.push('Missing module.exports statement');
      }

    } catch (error) {
      errors.push(`Syntax validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.SYNTAX_CHECK,
      success: errors.length === 0,
      errors,
      warnings: [],
      duration: Date.now() - startTime
    };
  } 
 /**
   * Extract and validate JSDoc metadata
   */
  private async extractMetadata(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let metadata: JSDocMetadata | undefined;

    try {
      // Extract JSDoc comment block
      const jsdocMatch = context.content.match(/\/\*\*\s*([\s\S]*?)\s*\*\//);
      if (!jsdocMatch) {
        errors.push('No JSDoc comment block found');
        return {
          step: ValidationStep.METADATA_EXTRACTION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      const jsdocContent = jsdocMatch[1];
      const extractedMetadata: Partial<JSDocMetadata> = {};

      // Extract all JSDoc tags
      const lines = jsdocContent.split('\n');
      const tags: Record<string, string> = {};
      
      for (const line of lines) {
        const trimmedLine = line.replace(/^\s*\*\s?/, '').trim();
        if (trimmedLine.startsWith('@')) {
          const spaceIndex = trimmedLine.indexOf(' ');
          if (spaceIndex > 0) {
            const tagName = trimmedLine.substring(1, spaceIndex);
            const tagValue = trimmedLine.substring(spaceIndex + 1).trim();
            tags[tagName] = tagValue;
          }
        }
      }

      // Process extracted tags
      for (const [tagName, tagValue] of Object.entries(tags)) {
        const cleanValue = tagValue.trim();

        switch (tagName) {
          case 'name':
            extractedMetadata.name = cleanValue;
            break;
          case 'description':
            extractedMetadata.description = cleanValue;
            break;
          case 'version':
            extractedMetadata.version = cleanValue;
            break;
          case 'author':
            extractedMetadata.author = cleanValue;
            break;
          case 'category':
            extractedMetadata.category = cleanValue;
            break;
          case 'tags':
            extractedMetadata.tags = cleanValue.split(',').map(tag => tag.trim());
            break;
          case 'icon':
            extractedMetadata.icon = cleanValue;
            break;
          case 'license':
            extractedMetadata.license = cleanValue;
            break;
          case 'homepage':
            extractedMetadata.homepage = cleanValue;
            break;
          case 'repository':
            extractedMetadata.repository = cleanValue;
            break;
          case 'since':
            extractedMetadata.since = cleanValue;
            break;
          case 'deprecated':
            extractedMetadata.deprecated = cleanValue;
            break;
          default:
            if (!this.config.jsdoc.allowUnknownTags) {
              warnings.push(`Unknown JSDoc tag: @${tagName}`);
            }
        }
      }

      // Validate required tags
      for (const requiredTag of REQUIRED_JSDOC_TAGS) {
        const tagName = requiredTag.substring(1); // Remove @
        if (!extractedMetadata[tagName as keyof JSDocMetadata]) {
          errors.push(`Missing required JSDoc tag: ${requiredTag}`);
        }
      }

      // Validate metadata values
      if (this.config.jsdoc.validateValues && extractedMetadata.name) {
        // Validate name
        if (extractedMetadata.name.length < 3) {
          errors.push('Task name must be at least 3 characters long');
        }
        if (extractedMetadata.name.length > 100) {
          errors.push('Task name must be less than 100 characters');
        }

        // Validate version format
        if (extractedMetadata.version && !/^\d+\.\d+\.\d+/.test(extractedMetadata.version)) {
          errors.push('Version must follow semantic versioning format (e.g., 1.0.0)');
        }

        // Validate URLs
        if (extractedMetadata.homepage && !this.isValidUrl(extractedMetadata.homepage)) {
          warnings.push('Homepage URL appears to be invalid');
        }
        if (extractedMetadata.repository && !this.isValidUrl(extractedMetadata.repository)) {
          warnings.push('Repository URL appears to be invalid');
        }
      }

      // Check if metadata is valid
      if (isValidJSDocMetadata(extractedMetadata)) {
        metadata = extractedMetadata as JSDocMetadata;
      } else {
        errors.push('Extracted metadata is incomplete or invalid');
      }

    } catch (error) {
      errors.push(`Metadata extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.METADATA_EXTRACTION,
      success: errors.length === 0,
      errors,
      warnings,
      data: metadata,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate module exports
   */
  private async validateExports(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for module.exports
      if (!context.content.includes('module.exports')) {
        errors.push('Missing module.exports statement');
      }

      // Extract exports using regex
      const exportsMatch = context.content.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
      if (!exportsMatch) {
        errors.push('Invalid module.exports format - must be an object');
        return {
          step: ValidationStep.EXPORTS_VALIDATION,
          success: false,
          errors,
          warnings: [],
          duration: Date.now() - startTime
        };
      }

      const exportsContent = exportsMatch[1];
      const foundExports: string[] = [];

      // Check for required exports
      for (const requiredExport of REQUIRED_EXPORTS) {
        if (exportsContent.includes(requiredExport)) {
          foundExports.push(requiredExport);
        } else {
          errors.push(`Missing required export: ${requiredExport}`);
        }
      }

      // Check for optional exports
      for (const optionalExport of OPTIONAL_EXPORTS) {
        if (exportsContent.includes(optionalExport)) {
          foundExports.push(optionalExport);
        }
      }

      // Validate that execute function exists
      if (!context.content.includes('function execute') && !context.content.includes('execute:')) {
        errors.push('Execute function not found in file');
      }

    } catch (error) {
      errors.push(`Exports validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.EXPORTS_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate parameters definition
   */
  private async validateParameters(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let parameters: Parameter[] | undefined;

    try {
      // Extract parameters definition
      const parametersMatch = context.content.match(/const\s+parameters\s*=\s*(\[[\s\S]*?\]);/);
      if (!parametersMatch) {
        // Parameters are optional, so this is just a warning
        warnings.push('No parameters definition found');
        return {
          step: ValidationStep.PARAMETER_VALIDATION,
          success: true,
          errors: [],
          warnings,
          duration: Date.now() - startTime
        };
      }

      try {
        // Safely evaluate the parameters array
        const parametersCode = parametersMatch[1];
        const evaluatedParameters = this.safeEvaluate(parametersCode);

        if (!Array.isArray(evaluatedParameters)) {
          errors.push('Parameters must be an array');
        } else if (isValidParameterArray(evaluatedParameters)) {
          parameters = evaluatedParameters;
          
          // Validate individual parameters
          for (let i = 0; i < parameters.length; i++) {
            const param = parameters[i];
            
            // Validate parameter name
            if (!param.name || typeof param.name !== 'string') {
              errors.push(`Parameter ${i}: name is required and must be a string`);
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
              errors.push(`Parameter ${i}: name must be a valid identifier`);
            }

            // Validate parameter type
            const validTypes = ['string', 'number', 'boolean', 'url', 'email', 'select', 'multiselect', 'file', 'textarea', 'password', 'date', 'time', 'datetime'];
            if (!validTypes.includes(param.type)) {
              errors.push(`Parameter ${i}: invalid type '${param.type}'`);
            }

            // Validate select options
            if ((param.type === 'select' || param.type === 'multiselect') && !param.options) {
              errors.push(`Parameter ${i}: select/multiselect type requires options array`);
            }

            // Validate numeric constraints
            if (param.type === 'number') {
              if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
                errors.push(`Parameter ${i}: min value cannot be greater than max value`);
              }
            }
          }
        } else {
          errors.push('Parameters array contains invalid parameter definitions');
        }

      } catch (evalError) {
        errors.push(`Failed to parse parameters: ${evalError instanceof Error ? evalError.message : String(evalError)}`);
      }

    } catch (error) {
      errors.push(`Parameters validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.PARAMETER_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      data: parameters,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate dependencies definition
   */
  private async validateDependencies(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let dependencies: string[] | undefined;

    try {
      // Extract dependencies definition
      const dependenciesMatch = context.content.match(/const\s+dependencies\s*=\s*(\[[\s\S]*?\]);/);
      if (!dependenciesMatch) {
        // Dependencies are optional
        warnings.push('No dependencies definition found');
        return {
          step: ValidationStep.DEPENDENCY_VALIDATION,
          success: true,
          errors: [],
          warnings,
          duration: Date.now() - startTime
        };
      }

      try {
        // Safely evaluate the dependencies array
        const dependenciesCode = dependenciesMatch[1];
        const evaluatedDependencies = this.safeEvaluate(dependenciesCode);

        if (!Array.isArray(evaluatedDependencies)) {
          errors.push('Dependencies must be an array');
        } else if (isValidDependencyArray(evaluatedDependencies)) {
          dependencies = evaluatedDependencies;
          
          // Validate individual dependencies
          for (let i = 0; i < dependencies.length; i++) {
            const dep = dependencies[i];
            
            if (typeof dep !== 'string' || dep.trim().length === 0) {
              errors.push(`Dependency ${i}: must be a non-empty string`);
              continue;
            }

            // Validate dependency format
            const depValidation = this.validateDependencyString(dep);
            if (!depValidation.valid) {
              errors.push(`Dependency ${i}: ${depValidation.error}`);
            }
          }
        } else {
          errors.push('Dependencies array contains invalid dependency definitions');
        }

      } catch (evalError) {
        errors.push(`Failed to parse dependencies: ${evalError instanceof Error ? evalError.message : String(evalError)}`);
      }

    } catch (error) {
      errors.push(`Dependencies validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.DEPENDENCY_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      data: dependencies,
      duration: Date.now() - startTime
    };
  }  
/**
   * Validate configuration definition
   */
  private async validateConfig(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let config: TaskConfig | undefined;

    try {
      // Extract config definition
      const configMatch = context.content.match(/const\s+config\s*=\s*(\{[\s\S]*?\});/);
      if (!configMatch) {
        // Config is optional, provide default
        warnings.push('No config definition found, using defaults');
        config = {};
        return {
          step: ValidationStep.CONFIG_VALIDATION,
          success: true,
          errors: [],
          warnings,
          data: config,
          duration: Date.now() - startTime
        };
      }

      try {
        // Safely evaluate the config object
        const configCode = configMatch[1];
        const evaluatedConfig = this.safeEvaluate(configCode);

        if (typeof evaluatedConfig !== 'object' || evaluatedConfig === null) {
          errors.push('Config must be an object');
        } else if (isValidTaskConfig(evaluatedConfig)) {
          config = evaluatedConfig;
          
          // Validate config values
          if (config.timeout !== undefined) {
            if (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 300000) {
              errors.push('Config timeout must be a number between 1000 and 300000 milliseconds');
            }
          }

          if (config.retries !== undefined) {
            if (typeof config.retries !== 'number' || config.retries < 0 || config.retries > 5) {
              errors.push('Config retries must be a number between 0 and 5');
            }
          }

          if (config.permissions !== undefined) {
            if (!Array.isArray(config.permissions)) {
              errors.push('Config permissions must be an array');
            } else {
              const validPermissions = ['network', 'filesystem', 'clipboard', 'notifications'];
              for (const permission of config.permissions) {
                if (typeof permission !== 'string' || !validPermissions.includes(permission)) {
                  errors.push(`Invalid permission: ${permission}. Valid permissions are: ${validPermissions.join(', ')}`);
                }
              }
            }
          }

          if (config.maxMemory !== undefined) {
            if (typeof config.maxMemory !== 'number' || config.maxMemory < 64 || config.maxMemory > 2048) {
              errors.push('Config maxMemory must be a number between 64 and 2048 MB');
            }
          }

          if (config.priority !== undefined) {
            if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
              errors.push('Config priority must be a number between 1 and 10');
            }
          }

        } else {
          errors.push('Config object contains invalid properties');
        }

      } catch (evalError) {
        errors.push(`Failed to parse config: ${evalError instanceof Error ? evalError.message : String(evalError)}`);
      }

    } catch (error) {
      errors.push(`Config validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.CONFIG_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      data: config,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validate execute function
   */
  private async validateExecuteFunction(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let executeFunction: string | undefined;

    try {
      // Extract execute function
      const executeFunctionMatch = context.content.match(/async\s+function\s+execute\s*\(\s*context\s*\)\s*\{([\s\S]*?)\n\}/);
      if (!executeFunctionMatch) {
        errors.push('Execute function not found or has invalid signature. Must be: async function execute(context)');
      } else {
        executeFunction = executeFunctionMatch[0];
        
        // Validate function signature
        if (!context.content.includes('async function execute')) {
          errors.push('Execute function must be async');
        }

        // Check for proper context usage
        const functionBody = executeFunctionMatch[1];
        const contextProperties = ['page', 'params', 'log', 'progress', 'browser', 'utils'];
        let usedProperties = 0;

        for (const prop of contextProperties) {
          if (functionBody.includes(prop)) {
            usedProperties++;
          }
        }

        if (usedProperties === 0) {
          warnings.push('Execute function does not seem to use any context properties');
        }

        // Check for return statement
        if (!functionBody.includes('return')) {
          warnings.push('Execute function should return a result object');
        }

        // Check for error handling
        if (!functionBody.includes('try') && !functionBody.includes('catch')) {
          warnings.push('Execute function should include error handling (try/catch)');
        }
      }

    } catch (error) {
      errors.push(`Execute function validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      step: ValidationStep.EXECUTE_FUNCTION_VALIDATION,
      success: errors.length === 0,
      errors,
      warnings,
      data: executeFunction,
      duration: Date.now() - startTime
    };
  }

  /**
   * Perform security scan on the code
   */
  private async performSecurityScan(context: TaskFileValidationContext): Promise<ValidationStepResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const scanResult: SecurityScanResult = {
        safe: true,
        issues: [],
        recommendations: []
      };

      // Check for forbidden patterns
      for (const pattern of this.config.security.forbiddenPatterns) {
        const matches = context.content.match(pattern);
        if (matches) {
          scanResult.safe = false;
          scanResult.issues.push({
            type: 'forbidden_pattern',
            severity: 'high',
            message: `Forbidden pattern detected: ${pattern.source}`,
            pattern: pattern.source
          });
        }
      }

      // Check for suspicious code patterns
      const suspiciousPatterns = [
        { pattern: /\bwindow\b/, message: 'Direct window object access detected' },
        { pattern: /\bdocument\.cookie\b/, message: 'Cookie access detected' },
        { pattern: /\blocalhost\b/, message: 'Localhost reference detected' },
        { pattern: /\b127\.0\.0\.1\b/, message: 'Loopback IP address detected' },
        { pattern: /\bfile:\/\/\b/, message: 'File protocol URL detected' }
      ];

      for (const { pattern, message } of suspiciousPatterns) {
        if (pattern.test(context.content)) {
          scanResult.issues.push({
            type: 'suspicious_code',
            severity: 'medium',
            message
          });
        }
      }

      // Add security recommendations
      if (context.content.includes('require(')) {
        scanResult.recommendations.push('Consider using import statements instead of require() for better security');
      }

      if (!context.content.includes('try') || !context.content.includes('catch')) {
        scanResult.recommendations.push('Add proper error handling to prevent information leakage');
      }

      return {
        step: ValidationStep.SECURITY_SCAN,
        success: scanResult.safe,
        errors: scanResult.safe ? [] : ['Security scan detected potential issues'],
        warnings: scanResult.issues.filter(i => i.severity === 'medium').map(i => i.message),
        data: scanResult,
        duration: Date.now() - startTime
      };

    } catch (error) {
      errors.push(`Security scan failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        step: ValidationStep.SECURITY_SCAN,
        success: false,
        errors,
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Safely evaluate JavaScript code
   */
  private safeEvaluate(code: string): any {
    try {
      // Create a safe evaluation context
      const safeGlobals = {
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date,
        RegExp,
        JSON,
        Math
      };

      // Use Function constructor with limited scope
      const func = new Function(...Object.keys(safeGlobals), `return ${code}`);
      return func(...Object.values(safeGlobals));
    } catch (error) {
      throw new Error(`Safe evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate URL format
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
   * Validate dependency string format
   */
  private validateDependencyString(dependency: string): { valid: boolean; error?: string } {
    // Basic validation for npm package format
    const patterns = [
      /^[a-z0-9-_]+$/, // simple package name
      /^[a-z0-9-_]+@[\d\w\.\-\^~]+$/, // package with version
      /^@[a-z0-9-_]+\/[a-z0-9-_]+(@[\d\w\.\-\^~]+)?$/ // scoped package
    ];

    const isValid = patterns.some(pattern => pattern.test(dependency));
    
    if (!isValid) {
      return {
        valid: false,
        error: `Invalid dependency format: ${dependency}. Expected format: 'package-name' or 'package-name@version' or '@scope/package-name@version'`
      };
    }

    return { valid: true };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new task file parser with default configuration
 */
export function createTaskFileParser(config?: Partial<TaskFileParserConfig>): TaskFileParser {
  return new TaskFileParser(config);
}

/**
 * Parse a task file with default settings
 */
export async function parseTaskFile(
  filename: string,
  content: string,
  encoding: string = 'utf-8'
): Promise<TaskFile> {
  const parser = createTaskFileParser();
  const context: TaskFileValidationContext = {
    filename,
    content,
    size: Buffer.byteLength(content, encoding as BufferEncoding),
    encoding
  };

  return parser.parseTaskFile(context);
}

/**
 * Validate a task file with default settings
 */
export async function validateTaskFile(
  filename: string,
  content: string,
  encoding: string = 'utf-8'
): Promise<TaskFileValidationResult> {
  const parser = createTaskFileParser();
  const context: TaskFileValidationContext = {
    filename,
    content,
    size: Buffer.byteLength(content, encoding as BufferEncoding),
    encoding
  };

  return parser.validateTaskFile(context);
}