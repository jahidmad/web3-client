/**
 * Task Validator
 * 
 * This module provides utilities for validating task files and generating validation reports.
 */

import { Logger } from '../utils/logger';
import { TaskFile } from '../types/task';
import { 
  ValidationResult, 
  ValidationError, 
  ValidationSeverity, 
  ValidationErrorType,
  AppliedFix
} from '../types/validation';

/**
 * 任务验证器
 */
export class TaskValidator {
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger('TaskValidator');
  }
  
  /**
   * 验证任务文件
   */
  validateTaskFile(taskFile: TaskFile): ValidationResult {
    this.logger.info('Validating task file');
    
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      infos: [],
      fixes: [],
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalInfos: 0,
        totalFixes: 0
      }
    };
    
    // 验证元数据（使用宽松的验证规则）
    this.validateMetadata(taskFile, result);
    
    // 验证参数（允许空数组）
    this.validateParameters(taskFile, result);
    
    // 验证代码
    this.validateCode(taskFile, result);
    
    // 验证示例（可选）
    this.validateExamples(taskFile, result);
    
    // 更新验证结果
    result.valid = result.errors.length === 0;
    result.summary = {
      totalErrors: result.errors.length,
      totalWarnings: result.warnings.length,
      totalInfos: result.infos.length,
      totalFixes: result.fixes.length
    };
    
    // 记录验证结果
    if (result.valid) {
      this.logger.info(`Task file validation successful with ${result.warnings.length} warnings`);
    } else {
      this.logger.error(`Task file validation failed with ${result.errors.length} errors`);
    }
    
    return result;
  }
  
  /**
   * 验证元数据
   */
  private validateMetadata(taskFile: TaskFile, result: ValidationResult): void {
    // 检查元数据是否存在
    if (!taskFile.metadata) {
      this.addError(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.ERROR,
        message: '缺少任务元数据',
        path: 'metadata',
        suggestion: '添加包含必要字段的metadata对象'
      });
      return;
    }
    
    // 验证必需字段
    if (!taskFile.metadata.id) {
      this.addError(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.ERROR,
        message: '缺少任务ID',
        field: 'id',
        path: 'metadata.id',
        suggestion: '添加唯一的任务ID'
      });
    } else if (typeof taskFile.metadata.id !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务ID必须是字符串',
        field: 'id',
        path: 'metadata.id',
        suggestion: '将ID转换为字符串'
      });
    }
    
    if (!taskFile.metadata.name) {
      this.addError(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.ERROR,
        message: '缺少任务名称',
        field: 'name',
        path: 'metadata.name',
        suggestion: '添加描述性的任务名称'
      });
    } else if (typeof taskFile.metadata.name !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务名称必须是字符串',
        field: 'name',
        path: 'metadata.name',
        suggestion: '将名称转换为字符串'
      });
    } else if (taskFile.metadata.name.length < 3) {
      this.addWarning(result, {
        type: ValidationErrorType.INVALID_VALUE,
        severity: ValidationSeverity.WARNING,
        message: '任务名称过短',
        field: 'name',
        path: 'metadata.name',
        suggestion: '使用更具描述性的名称'
      });
    }
    
    if (!taskFile.metadata.description) {
      this.addWarning(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.WARNING,
        message: '缺少任务描述',
        field: 'description',
        path: 'metadata.description',
        suggestion: '添加描述以便用户了解任务功能'
      });
    } else if (typeof taskFile.metadata.description !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务描述必须是字符串',
        field: 'description',
        path: 'metadata.description',
        suggestion: '将描述转换为字符串'
      });
    }
    
    if (!taskFile.metadata.version) {
      this.addWarning(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.WARNING,
        message: '缺少任务版本',
        field: 'version',
        path: 'metadata.version',
        suggestion: '添加版本号，如1.0.0'
      });
    } else if (typeof taskFile.metadata.version !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务版本必须是字符串',
        field: 'version',
        path: 'metadata.version',
        suggestion: '将版本转换为字符串'
      });
    } else if (!taskFile.metadata.version.match(/^\d+\.\d+\.\d+$/)) {
      this.addWarning(result, {
        type: ValidationErrorType.INVALID_FORMAT,
        severity: ValidationSeverity.WARNING,
        message: '任务版本格式不符合语义化版本规范',
        field: 'version',
        path: 'metadata.version',
        suggestion: '使用语义化版本格式，如1.0.0'
      });
    }
    
    if (!taskFile.metadata.author) {
      this.addWarning(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.WARNING,
        message: '缺少任务作者',
        field: 'author',
        path: 'metadata.author',
        suggestion: '添加作者信息'
      });
    } else if (typeof taskFile.metadata.author !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务作者必须是字符串',
        field: 'author',
        path: 'metadata.author',
        suggestion: '将作者转换为字符串'
      });
    }
    
    // 验证可选字段
    if (taskFile.metadata.tags) {
      if (!Array.isArray(taskFile.metadata.tags)) {
        if (typeof taskFile.metadata.tags === 'string') {
          this.addWarning(result, {
            type: ValidationErrorType.INVALID_TYPE,
            severity: ValidationSeverity.WARNING,
            message: '任务标签应该是数组',
            field: 'tags',
            path: 'metadata.tags',
            suggestion: '将标签字符串转换为数组'
          });
        } else {
          this.addError(result, {
            type: ValidationErrorType.INVALID_TYPE,
            severity: ValidationSeverity.ERROR,
            message: '任务标签必须是数组',
            field: 'tags',
            path: 'metadata.tags',
            suggestion: '将标签转换为数组'
          });
        }
      }
    }
    
    if (taskFile.metadata.category && typeof taskFile.metadata.category !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务类别必须是字符串',
        field: 'category',
        path: 'metadata.category',
        suggestion: '将类别转换为字符串'
      });
    }
    
    if (taskFile.metadata.dependencies) {
      if (!Array.isArray(taskFile.metadata.dependencies)) {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: '任务依赖必须是数组',
          field: 'dependencies',
          path: 'metadata.dependencies',
          suggestion: '将依赖转换为数组'
        });
      } else {
        // 验证依赖格式
        for (let i = 0; i < taskFile.metadata.dependencies.length; i++) {
          const dep = taskFile.metadata.dependencies[i];
          
          // 检查是否是正确的TaskDependency对象格式
          if (typeof dep === 'object' && dep !== null) {
            // 验证TaskDependency对象的必需属性
            if (!dep.name || typeof dep.name !== 'string') {
              this.addError(result, {
                type: ValidationErrorType.INVALID_TYPE,
                severity: ValidationSeverity.ERROR,
                message: `依赖项缺少name属性: ${JSON.stringify(dep)}`,
                field: 'dependencies',
                path: `metadata.dependencies[${i}].name`,
                suggestion: '为依赖项添加name属性'
              });
            }
            if (!dep.version || typeof dep.version !== 'string') {
              this.addError(result, {
                type: ValidationErrorType.INVALID_TYPE,
                severity: ValidationSeverity.ERROR,
                message: `依赖项缺少version属性: ${JSON.stringify(dep)}`,
                field: 'dependencies',
                path: `metadata.dependencies[${i}].version`,
                suggestion: '为依赖项添加version属性'
              });
            }
            if (!dep.type || !['npm', 'browser-api', 'system', 'builtin'].includes(dep.type)) {
              this.addError(result, {
                type: ValidationErrorType.INVALID_TYPE,
                severity: ValidationSeverity.ERROR,
                message: `依赖项type属性无效: ${JSON.stringify(dep)}`,
                field: 'dependencies',
                path: `metadata.dependencies[${i}].type`,
                suggestion: '使用有效的type值: npm, browser-api, system, builtin'
              });
            }
          } else if (typeof dep === 'string') {
            // 处理旧格式的字符串依赖（向后兼容）
            const depStr = dep as string;
            if (!depStr.match(/^[a-zA-Z0-9\-_]+(@[0-9]+\.[0-9]+\.[0-9]+)?$/)) {
              this.addWarning(result, {
                type: ValidationErrorType.INVALID_FORMAT,
                severity: ValidationSeverity.WARNING,
                message: `依赖项格式可能不正确: ${dep}`,
                field: 'dependencies',
                path: `metadata.dependencies[${i}]`,
                suggestion: '使用"package@version"格式或TaskDependency对象格式'
              });
            }
          } else {
            this.addError(result, {
              type: ValidationErrorType.INVALID_TYPE,
              severity: ValidationSeverity.ERROR,
              message: `依赖项必须是TaskDependency对象或字符串: ${JSON.stringify(dep)}`,
              field: 'dependencies',
              path: `metadata.dependencies[${i}]`,
              suggestion: '使用正确的依赖项格式'
            });
          }
        }
      }
    }
  }
  
  /**
   * 验证参数
   */
  private validateParameters(taskFile: TaskFile, result: ValidationResult): void {
    // 检查参数是否是数组
    if (!Array.isArray(taskFile.parameters)) {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务参数必须是数组',
        path: 'parameters',
        suggestion: '将参数转换为数组'
      });
      return;
    }
    
    // 如果参数数组为空，只给出信息提示，不报错
    if (taskFile.parameters.length === 0) {
      this.addInfo(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.INFO,
        message: '任务没有定义参数',
        path: 'parameters',
        suggestion: '如果任务需要用户输入，请在代码中定义parameters数组'
      });
      return;
    }
    
    // 验证每个参数
    for (let i = 0; i < taskFile.parameters.length; i++) {
      const param = taskFile.parameters[i];
      
      // 检查参数是否是对象
      if (!param || typeof param !== 'object') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${i+1}必须是对象`,
          path: `parameters[${i}]`,
          suggestion: '将参数转换为对象'
        });
        continue;
      }
      
      // 验证必需字段
      if (!param.name) {
        this.addError(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.ERROR,
          message: `参数${i+1}缺少name字段`,
          field: 'name',
          path: `parameters[${i}].name`,
          suggestion: '添加参数名称'
        });
      } else if (typeof param.name !== 'string') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${i+1}的name字段必须是字符串`,
          field: 'name',
          path: `parameters[${i}].name`,
          suggestion: '将参数名称转换为字符串'
        });
      }
      
      if (!param.type) {
        this.addError(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.ERROR,
          message: `参数${param.name || i+1}缺少type字段`,
          field: 'type',
          path: `parameters[${i}].type`,
          suggestion: '添加参数类型'
        });
      } else if (typeof param.type !== 'string') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${param.name || i+1}的type字段必须是字符串`,
          field: 'type',
          path: `parameters[${i}].type`,
          suggestion: '将参数类型转换为字符串'
        });
      } else {
        // 验证参数类型是否有效
        const validTypes = ['string', 'number', 'boolean', 'url', 'email', 'select', 'multiselect', 'file', 'textarea', 'password', 'date', 'time', 'datetime'];
        if (!validTypes.includes(param.type)) {
          this.addWarning(result, {
            type: ValidationErrorType.INVALID_VALUE,
            severity: ValidationSeverity.WARNING,
            message: `参数${param.name || i+1}的类型"${param.type}"不是标准类型`,
            field: 'type',
            path: `parameters[${i}].type`,
            suggestion: `使用标准类型: ${validTypes.join(', ')}`
          });
        }
      }
      
      if (param.required !== undefined && typeof param.required !== 'boolean') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${param.name || i+1}的required字段必须是布尔值`,
          field: 'required',
          path: `parameters[${i}].required`,
          suggestion: '将required转换为布尔值'
        });
      }
      
      if (!param.label) {
        this.addWarning(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.WARNING,
          message: `参数${param.name || i+1}缺少label字段`,
          field: 'label',
          path: `parameters[${i}].label`,
          suggestion: '添加参数标签以提高用户体验'
        });
      } else if (typeof param.label !== 'string') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${param.name || i+1}的label字段必须是字符串`,
          field: 'label',
          path: `parameters[${i}].label`,
          suggestion: '将参数标签转换为字符串'
        });
      }
      
      if (!param.description) {
        this.addWarning(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.WARNING,
          message: `参数${param.name || i+1}缺少description字段`,
          field: 'description',
          path: `parameters[${i}].description`,
          suggestion: '添加参数描述以提高用户体验'
        });
      } else if (typeof param.description !== 'string') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `参数${param.name || i+1}的description字段必须是字符串`,
          field: 'description',
          path: `parameters[${i}].description`,
          suggestion: '将参数描述转换为字符串'
        });
      }
      
      // 检查select和multiselect类型的参数是否有options
      if (param.type === 'select' || param.type === 'multiselect') {
        if (!param.validation || !param.validation.options || !Array.isArray(param.validation.options) || param.validation.options.length === 0) {
          this.addError(result, {
            type: ValidationErrorType.MISSING_FIELD,
            severity: ValidationSeverity.ERROR,
            message: `参数${param.name || i+1}是${param.type}类型，但缺少validation.options数组或数组为空`,
            field: 'validation.options',
            path: `parameters[${i}].validation.options`,
            suggestion: '在validation对象中添加options数组'
          });
        }
      }
    }
  }
  
  /**
   * 验证代码
   */
  private validateCode(taskFile: TaskFile, result: ValidationResult): void {
    // 检查代码是否存在
    if (!taskFile.code) {
      this.addError(result, {
        type: ValidationErrorType.MISSING_FIELD,
        severity: ValidationSeverity.ERROR,
        message: '缺少任务代码',
        path: 'code',
        suggestion: '添加包含execute函数的代码'
      });
      return;
    }
    
    // 检查代码是否是字符串
    if (typeof taskFile.code !== 'string') {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务代码必须是字符串',
        path: 'code',
        suggestion: '将代码转换为字符串'
      });
      return;
    }
    
    // 检查execute函数
    const hasExecuteFunction = taskFile.code.includes('function execute(') || 
                             taskFile.code.includes('execute = function(') || 
                             taskFile.code.includes('execute=function(') ||
                             taskFile.code.includes('async function execute(') ||
                             taskFile.code.includes('execute = async function(') ||
                             taskFile.code.includes('execute=async function(');
    
    if (!hasExecuteFunction) {
      this.addError(result, {
        type: ValidationErrorType.MISSING_FUNCTION,
        severity: ValidationSeverity.ERROR,
        message: '任务代码必须包含execute函数',
        path: 'code',
        suggestion: '添加名为execute的函数'
      });
    } else if (!taskFile.code.includes('async')) {
      this.addWarning(result, {
        type: ValidationErrorType.INVALID_FORMAT,
        severity: ValidationSeverity.WARNING,
        message: 'execute函数应该是异步函数',
        path: 'code',
        suggestion: '使用async关键字声明execute函数'
      });
    }
    
    // 检查代码长度
    if (taskFile.code.length < 50) {
      this.addWarning(result, {
        type: ValidationErrorType.INVALID_VALUE,
        severity: ValidationSeverity.WARNING,
        message: '任务代码过短',
        path: 'code',
        suggestion: '添加更多功能代码'
      });
    }
    
    // 检查常见错误
    if (taskFile.code.includes('console.log')) {
      this.addWarning(result, {
        type: ValidationErrorType.INVALID_FORMAT,
        severity: ValidationSeverity.WARNING,
        message: '任务代码包含console.log语句',
        path: 'code',
        suggestion: '使用context.log代替console.log'
      });
    }
    
    // 检查模块导出
    if (!taskFile.code.includes('module.exports') && !taskFile.code.includes('export')) {
      this.addWarning(result, {
        type: ValidationErrorType.MISSING_EXPORT,
        severity: ValidationSeverity.WARNING,
        message: '任务代码缺少模块导出',
        path: 'code',
        suggestion: '添加module.exports = { parameters, dependencies, config, execute };'
      });
    }
  }
  
  /**
   * 验证示例
   */
  private validateExamples(taskFile: TaskFile, result: ValidationResult): void {
    // 如果没有示例，不需要验证
    if (!taskFile.examples) {
      return;
    }
    
    // 检查示例是否是数组
    if (!Array.isArray(taskFile.examples)) {
      this.addError(result, {
        type: ValidationErrorType.INVALID_TYPE,
        severity: ValidationSeverity.ERROR,
        message: '任务示例必须是数组',
        path: 'examples',
        suggestion: '将示例转换为数组'
      });
      return;
    }
    
    // 验证每个示例
    for (let i = 0; i < taskFile.examples.length; i++) {
      const example = taskFile.examples[i];
      
      // 检查示例是否是对象
      if (!example || typeof example !== 'object') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `示例${i+1}必须是对象`,
          path: `examples[${i}]`,
          suggestion: '将示例转换为对象'
        });
        continue;
      }
      
      // 验证必需字段
      if (!example.name) {
        this.addWarning(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.WARNING,
          message: `示例${i+1}缺少name字段`,
          field: 'name',
          path: `examples[${i}].name`,
          suggestion: '添加示例名称'
        });
      } else if (typeof example.name !== 'string') {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `示例${i+1}的name字段必须是字符串`,
          field: 'name',
          path: `examples[${i}].name`,
          suggestion: '将示例名称转换为字符串'
        });
      }
      
      if (!example.parameters) {
        this.addWarning(result, {
          type: ValidationErrorType.MISSING_FIELD,
          severity: ValidationSeverity.WARNING,
          message: `示例${i+1}缺少parameters字段`,
          field: 'parameters',
          path: `examples[${i}].parameters`,
          suggestion: '添加示例参数'
        });
      } else if (typeof example.parameters !== 'object' || Array.isArray(example.parameters)) {
        this.addError(result, {
          type: ValidationErrorType.INVALID_TYPE,
          severity: ValidationSeverity.ERROR,
          message: `示例${i+1}的parameters字段必须是对象`,
          field: 'parameters',
          path: `examples[${i}].parameters`,
          suggestion: '将示例参数转换为对象'
        });
      }
    }
  }
  
  /**
   * 添加错误
   */
  private addError(result: ValidationResult, error: ValidationError): void {
    error.severity = ValidationSeverity.ERROR;
    result.errors.push(error);
  }
  
  /**
   * 添加警告
   */
  private addWarning(result: ValidationResult, warning: ValidationError): void {
    warning.severity = ValidationSeverity.WARNING;
    result.warnings.push(warning);
  }
  
  /**
   * 添加信息
   */
  private addInfo(result: ValidationResult, info: ValidationError): void {
    info.severity = ValidationSeverity.INFO;
    result.infos.push(info);
  }
  
  /**
   * 添加修复
   */
  private addFix(result: ValidationResult, fix: AppliedFix): void {
    result.fixes.push(fix);
  }
  
  /**
   * 生成验证结果摘要
   */
  generateValidationSummary(result: ValidationResult): string {
    let summary = '';
    
    if (result.valid) {
      summary += '✅ 任务文件验证通过\n\n';
    } else {
      summary += '❌ 任务文件验证失败\n\n';
    }
    
    summary += `错误: ${result.errors.length} | 警告: ${result.warnings.length} | 信息: ${result.infos.length}\n\n`;
    
    if (result.errors.length > 0) {
      summary += '错误:\n';
      result.errors.forEach((error, index) => {
        summary += `${index + 1}. ${error.message}${error.path ? ` (${error.path})` : ''}\n`;
        if (error.suggestion) {
          summary += `   建议: ${error.suggestion}\n`;
        }
      });
      summary += '\n';
    }
    
    if (result.warnings.length > 0) {
      summary += '警告:\n';
      result.warnings.forEach((warning, index) => {
        summary += `${index + 1}. ${warning.message}${warning.path ? ` (${warning.path})` : ''}\n`;
        if (warning.suggestion) {
          summary += `   建议: ${warning.suggestion}\n`;
        }
      });
      summary += '\n';
    }
    
    if (result.fixes.length > 0) {
      summary += '应用的修复:\n';
      result.fixes.forEach((fix, index) => {
        summary += `${index + 1}. ${fix.description}${fix.path ? ` (${fix.path})` : ''}\n`;
      });
    }
    
    return summary;
  }
}