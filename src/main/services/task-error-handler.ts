/**
 * Task Error Handler
 * 
 * This module provides error handling utilities for task parsing and execution.
 */

import { Logger } from '../utils/logger';

/**
 * 任务解析错误类型枚举
 */
export enum TaskParsingErrorType {
  JSON_FORMAT_ERROR = 'json_format_error',
  JSDOC_FORMAT_ERROR = 'jsdoc_format_error',
  YAML_FORMAT_ERROR = 'yaml_format_error',
  MISSING_EXECUTE_FUNCTION = 'missing_execute_function',
  INVALID_METADATA = 'invalid_metadata',
  MISSING_JSDOC_BLOCK = 'missing_jsdoc_block',
  EMPTY_FILE = 'empty_file',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 任务解析错误接口
 */
export interface TaskParsingError {
  type: TaskParsingErrorType;
  message: string;
  details?: string;
  context?: string;
  suggestion?: string;
  originalError?: Error;
}

/**
 * 任务错误处理器
 */
export class TaskErrorHandler {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('TaskErrorHandler');
  }

  /**
   * 处理任务解析错误
   */
  handleParsingError(error: Error, content: string, filename?: string): Error {
    // 记录原始错误
    this.logger.error('Task parsing error:', error);
    
    // 创建结构化的错误对象
    const parsingError: TaskParsingError = this.classifyError(error, content);
    
    // 生成详细的错误信息
    const errorDetails = this.generateErrorDetails(parsingError, content, filename);
    
    // 创建增强的错误消息
    const enhancedMessage = `${parsingError.message}\n\n${errorDetails}`;
    
    return new Error(enhancedMessage);
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error, content: string): TaskParsingError {
    const errorMessage = error.message;
    const parsingError: TaskParsingError = {
      type: TaskParsingErrorType.UNKNOWN_ERROR,
      message: errorMessage,
      originalError: error
    };

    // 根据错误消息分类
    if (errorMessage.includes('JSON')) {
      parsingError.type = TaskParsingErrorType.JSON_FORMAT_ERROR;
      parsingError.suggestion = '请确保您的JSON格式正确，包含必要的metadata和parameters字段。';
    } else if (errorMessage.includes('JSDoc') || errorMessage.includes('@metadata') || errorMessage.includes('@parameters')) {
      parsingError.type = TaskParsingErrorType.JSDOC_FORMAT_ERROR;
      parsingError.suggestion = '请确保您的任务文件包含正确格式的@metadata和@parameters标签。';
    } else if (errorMessage.includes('YAML')) {
      parsingError.type = TaskParsingErrorType.YAML_FORMAT_ERROR;
      parsingError.suggestion = '请检查您的YAML语法，确保缩进正确且不包含非法字符。';
    } else if (errorMessage.includes('execute function')) {
      parsingError.type = TaskParsingErrorType.MISSING_EXECUTE_FUNCTION;
      parsingError.suggestion = '任务文件必须包含一个名为execute的异步函数。';
    } else if (errorMessage.includes('metadata')) {
      parsingError.type = TaskParsingErrorType.INVALID_METADATA;
      parsingError.suggestion = '请确保元数据包含必要的字段，如id、name、version和author。';
    } else if (errorMessage.includes('No JSDoc comment blocks found')) {
      parsingError.type = TaskParsingErrorType.MISSING_JSDOC_BLOCK;
      parsingError.suggestion = '请确保您的任务文件包含正确格式的JSDoc注释块。';
    } else if (errorMessage.includes('too short') || errorMessage.includes('empty')) {
      parsingError.type = TaskParsingErrorType.EMPTY_FILE;
      parsingError.suggestion = '任务文件不能为空，请确保文件包含完整的任务定义。';
    }

    return parsingError;
  }

  /**
   * 生成详细的错误信息
   */
  private generateErrorDetails(error: TaskParsingError, content: string, filename?: string): string {
    let details = '';

    // 根据错误类型生成详细信息
    switch (error.type) {
      case TaskParsingErrorType.JSON_FORMAT_ERROR:
        details = '检测到JSON格式错误。' + error.suggestion;
        
        // 尝试定位JSON错误位置
        const match = error.message.match(/position\s+(\d+)/);
        if (match) {
          const position = parseInt(match[1]);
          const context = content.substring(Math.max(0, position - 20), Math.min(content.length, position + 20));
          details += `\n\n错误位置附近的内容: "...${context}..."`;
        }
        break;

      case TaskParsingErrorType.JSDOC_FORMAT_ERROR:
        details = '检测到JSDoc格式错误。' + error.suggestion;
        
        // 检查是否缺少特定标签
        if (error.message.includes('@metadata')) {
          details += '\n\n缺少@metadata标签或格式不正确。';
        }
        if (error.message.includes('@parameters')) {
          details += '\n\n缺少@parameters标签或格式不正确。';
        }
        
        // 提供JSDoc格式示例
        details += '\n\n正确的JSDoc格式示例:\n```\n/**\n * @metadata\n * @name 任务名称\n * @description 任务描述\n * @version 1.0.0\n * @author 作者\n * \n * @parameters\n */\n```';
        break;

      case TaskParsingErrorType.YAML_FORMAT_ERROR:
        details = '检测到YAML格式错误。' + error.suggestion;
        
        // 尝试提供更具体的YAML错误信息
        if (error.message.includes('line')) {
          const lineMatch = error.message.match(/line\s+(\d+)/);
          if (lineMatch) {
            const lineNum = parseInt(lineMatch[1]);
            const lines = content.split('\n');
            if (lineNum > 0 && lineNum <= lines.length) {
              const problemLine = lines[lineNum - 1];
              const prevLine = lineNum > 1 ? lines[lineNum - 2] : '';
              const nextLine = lineNum < lines.length ? lines[lineNum] : '';
              
              details += `\n\n问题可能出在第${lineNum}行附近:\n`;
              if (prevLine) details += `${lineNum - 1}: ${prevLine}\n`;
              details += `${lineNum}: ${problemLine} <- 可能的问题行\n`;
              if (nextLine) details += `${lineNum + 1}: ${nextLine}\n`;
            }
          }
        }
        break;

      case TaskParsingErrorType.MISSING_EXECUTE_FUNCTION:
        details = error.suggestion || '任务文件必须包含一个名为execute的异步函数。';
        details += '\n\n正确的execute函数格式示例:\n```\nasync function execute(context) {\n  const { page, params, log, progress, browser, utils } = context;\n  \n  // 执行任务...\n  \n  return { success: true, data: {} };\n}\n```';
        
        // 检查是否有类似的函数名
        const functionMatches = content.match(/function\s+(\w+)\s*\(/g);
        if (functionMatches && functionMatches.length > 0) {
          details += '\n\n在您的文件中找到了以下函数定义:';
          functionMatches.forEach(match => {
            details += `\n- ${match.trim()}`;
          });
          details += '\n\n请确保有一个名为execute的函数。';
        }
        break;

      case TaskParsingErrorType.INVALID_METADATA:
        details = error.suggestion || '任务元数据不完整或格式不正确。请确保包含必要的id和name字段。';
        
        // 尝试提取现有的元数据
        const metadataMatch = content.match(/@metadata\s*\{([^}]*)\}/);
        if (metadataMatch) {
          details += `\n\n找到的元数据内容:\n${metadataMatch[1].trim()}\n\n请确保元数据包含必要的字段，并且格式正确。`;
        }
        break;

      case TaskParsingErrorType.MISSING_JSDOC_BLOCK:
        details = error.suggestion || '未找到JSDoc注释块。请确保您的任务文件包含正确格式的JSDoc注释。';
        details += '\n\n正确的JSDoc注释格式示例:\n```\n/**\n * @metadata\n * @name 任务名称\n * @description 任务描述\n * @version 1.0.0\n * @author 作者\n * \n * @parameters\n */\n```';
        
        // 检查是否有类似的注释块
        if (content.includes('/*') || content.includes('*/')) {
          details += '\n\n在您的文件中找到了注释块，但格式可能不正确。JSDoc注释块应以/**开始，以*/结束。';
        }
        break;

      case TaskParsingErrorType.EMPTY_FILE:
        details = error.suggestion || '任务文件过短或为空。请确保文件包含完整的任务定义。';
        break;

      default:
        details = '解析任务文件时遇到未知错误。请检查文件格式是否符合要求。';
        
        // 尝试提供更多上下文
        if (content.length > 0) {
          const firstLines = content.split('\n').slice(0, 5).join('\n');
          details += `\n\n文件开头内容:\n${firstLines}\n...`;
        }
        break;
    }
    
    // 添加文件名信息（如果有）
    if (filename) {
      details += `\n\n文件名: ${filename}`;
    }
    
    // 添加格式指南链接
    details += '\n\n请参考任务文件格式指南获取更多信息: docs/task-format-guide.md';
    
    return details;
  }

  /**
   * 尝试恢复解析错误
   * 根据错误类型尝试修复常见问题
   */
  tryRecoverFromError(error: TaskParsingError, content: string): string | null {
    this.logger.info(`Attempting to recover from ${error.type} error`);
    
    switch (error.type) {
      case TaskParsingErrorType.JSON_FORMAT_ERROR:
        return this.tryFixJsonFormat(content);
        
      case TaskParsingErrorType.JSDOC_FORMAT_ERROR:
        return this.tryFixJSDocFormat(content);
        
      case TaskParsingErrorType.MISSING_EXECUTE_FUNCTION:
        return this.tryAddExecuteFunction(content);
        
      case TaskParsingErrorType.INVALID_METADATA:
        return this.tryFixMetadata(content);
        
      default:
        this.logger.warn(`No recovery strategy for ${error.type}`);
        return null;
    }
  }

  /**
   * 尝试修复JSON格式
   */
  private tryFixJsonFormat(content: string): string | null {
    try {
      // 尝试修复常见的JSON格式问题
      let fixedContent = content
        // 修复没有引号的键名
        .replace(/(\{|\,)\s*([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
        // 修复单引号字符串
        .replace(/'([^']*?)'/g, '"$1"')
        // 修复没有引号的字符串值
        .replace(/:\s*([a-zA-Z0-9_$]+)(\s*[,}])/g, ':"$1"$2')
        // 移除尾随逗号
        .replace(/,(\s*[}\]])/g, '$1');
      
      // 验证修复后的JSON是否有效
      JSON.parse(fixedContent);
      
      this.logger.info('Successfully fixed JSON format');
      return fixedContent;
    } catch (error) {
      this.logger.warn('Failed to fix JSON format:', error);
      return null;
    }
  }

  /**
   * 尝试修复JSDoc格式
   */
  private tryFixJSDocFormat(content: string): string | null {
    // 检查是否有JSDoc注释块
    if (!content.includes('/**') || !content.includes('*/')) {
      // 尝试添加JSDoc注释块
      if (content.includes('function execute(')) {
        const fixedContent = `/**
 * @metadata
 * @name Unnamed Task
 * @description Auto-generated description
 * @version 1.0.0
 * @author System
 * 
 * @parameters
 */

${content}`;
        
        this.logger.info('Added JSDoc comment block');
        return fixedContent;
      }
      
      return null;
    }
    
    // 检查是否缺少@metadata标签
    if (!content.includes('@metadata')) {
      // 尝试添加@metadata标签
      const fixedContent = content.replace(/\/\*\*/, '/**\n * @metadata');
      this.logger.info('Added @metadata tag');
      return fixedContent;
    }
    
    // 检查是否缺少@parameters标签
    if (!content.includes('@parameters')) {
      // 尝试添加@parameters标签
      const fixedContent = content.replace(/\*\//, '* @parameters\n */');
      this.logger.info('Added @parameters tag');
      return fixedContent;
    }
    
    return null;
  }

  /**
   * 尝试添加execute函数
   */
  private tryAddExecuteFunction(content: string): string | null {
    // 检查是否有类似的函数
    const functionMatch = content.match(/function\s+(\w+)\s*\(/);
    if (functionMatch && functionMatch[1] !== 'execute') {
      // 尝试重命名函数
      const fixedContent = content.replace(
        new RegExp(`function\\s+${functionMatch[1]}\\s*\\(`), 
        'function execute('
      );
      
      this.logger.info(`Renamed function ${functionMatch[1]} to execute`);
      return fixedContent;
    }
    
    // 如果没有任何函数，添加一个基本的execute函数
    if (!content.includes('function')) {
      const fixedContent = `${content}

// 主执行函数
async function execute(context) {
  const { page, params, log, progress, browser, utils } = context;
  
  // 任务逻辑
  log('任务开始执行');
  progress(50, '执行中');
  
  // 执行任务逻辑...
  
  progress(100, '完成');
  return { success: true, data: {} };
}

module.exports = { parameters, dependencies, config, execute };`;
      
      this.logger.info('Added basic execute function');
      return fixedContent;
    }
    
    return null;
  }

  /**
   * 尝试修复元数据
   */
  private tryFixMetadata(content: string): string | null {
    // 检查是否有@metadata标签
    const metadataMatch = content.match(/@metadata\s*\{([^}]*)\}/);
    if (metadataMatch) {
      try {
        // 解析现有元数据
        const metadataStr = metadataMatch[1];
        let metadata: any = {};
        
        try {
          // 尝试解析为JSON
          metadata = JSON.parse(`{${metadataStr}}`);
        } catch (error) {
          // 如果解析失败，尝试提取键值对
          const keyValuePairs = metadataStr.match(/([a-zA-Z0-9_$]+)\s*:\s*(['"]?[^,}]*['"]?)/g) || [];
          keyValuePairs.forEach(pair => {
            const [key, ...valueParts] = pair.split(':');
            const value = valueParts.join(':').trim();
            if (key && value) {
              metadata[key.trim()] = value.replace(/^['"]|['"]$/g, '');
            }
          });
        }
        
        // 确保必要的字段存在
        if (!metadata.name) metadata.name = 'Unnamed Task';
        if (!metadata.id) metadata.id = `task_${Date.now()}`;
        if (!metadata.description) metadata.description = 'Auto-generated description';
        if (!metadata.version) metadata.version = '1.0.0';
        if (!metadata.author) metadata.author = 'System';
        
        // 创建修复后的元数据字符串
        const fixedMetadata = JSON.stringify(metadata, null, 2);
        
        // 替换原始元数据
        const fixedContent = content.replace(
          /@metadata\s*\{[^}]*\}/,
          `@metadata ${fixedMetadata}`
        );
        
        this.logger.info('Fixed metadata');
        return fixedContent;
      } catch (error) {
        this.logger.warn('Failed to fix metadata:', error);
      }
    }
    
    return null;
  }
}