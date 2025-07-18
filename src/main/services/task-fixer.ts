/**
 * Task Fixer
 * 
 * This module provides utilities for automatically fixing common issues in task files.
 */

import { Logger } from '../utils/logger';
import { TaskFile } from '../types/task';

/**
 * 修复结果接口
 */
export interface FixResult {
  fixed: boolean;
  taskFile: TaskFile;
  appliedFixes: string[];
}

/**
 * 任务修复器
 */
export class TaskFixer {
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger('TaskFixer');
  }
  
  /**
   * 尝试修复任务文件中的常见问题
   */
  fixTaskFile(taskFile: TaskFile): FixResult {
    this.logger.info('Attempting to fix task file issues');
    
    const result: FixResult = {
      fixed: false,
      taskFile: JSON.parse(JSON.stringify(taskFile)), // 创建深拷贝
      appliedFixes: []
    };
    
    // 修复元数据
    this.fixMetadata(result);
    
    // 修复参数
    this.fixParameters(result);
    
    // 修复代码
    this.fixCode(result);
    
    // 修复示例
    this.fixExamples(result);
    
    // 设置修复状态
    result.fixed = result.appliedFixes.length > 0;
    
    if (result.fixed) {
      this.logger.info(`Applied ${result.appliedFixes.length} fixes to task file`);
    } else {
      this.logger.info('No fixes needed for task file');
    }
    
    return result;
  }
  
  /**
   * 修复元数据
   */
  private fixMetadata(result: FixResult): void {
    const taskFile = result.taskFile;
    
    // 确保元数据存在
    if (!taskFile.metadata) {
      taskFile.metadata = {
        id: `task_${Date.now()}`,
        name: 'Unnamed Task',
        description: 'Auto-generated description',
        version: '1.0.0',
        author: 'System',
        category: 'general',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      result.appliedFixes.push('创建了缺失的元数据对象');
      return;
    }
    
    // 修复ID
    if (!taskFile.metadata.id) {
      taskFile.metadata.id = `task_${Date.now()}`;
      result.appliedFixes.push('生成了缺失的任务ID');
    }
    
    // 修复名称
    if (!taskFile.metadata.name) {
      taskFile.metadata.name = 'Unnamed Task';
      result.appliedFixes.push('添加了默认任务名称');
    }
    
    // 修复描述
    if (!taskFile.metadata.description) {
      taskFile.metadata.description = `Task ${taskFile.metadata.name}`;
      result.appliedFixes.push('添加了默认任务描述');
    }
    
    // 修复版本
    if (!taskFile.metadata.version) {
      taskFile.metadata.version = '1.0.0';
      result.appliedFixes.push('添加了默认版本号');
    } else if (typeof taskFile.metadata.version !== 'string') {
      taskFile.metadata.version = String(taskFile.metadata.version);
      result.appliedFixes.push('将版本号转换为字符串');
    }
    
    // 修复作者
    if (!taskFile.metadata.author) {
      taskFile.metadata.author = 'Unknown';
      result.appliedFixes.push('添加了默认作者');
    }
    
    // 修复标签
    if (!taskFile.metadata.tags) {
      taskFile.metadata.tags = [];
      result.appliedFixes.push('创建了空标签数组');
    } else if (!Array.isArray(taskFile.metadata.tags)) {
      if (typeof taskFile.metadata.tags === 'string') {
        taskFile.metadata.tags = (taskFile.metadata.tags as string).split(',').map((tag: string) => tag.trim());
        result.appliedFixes.push('将标签字符串转换为数组');
      } else {
        taskFile.metadata.tags = [];
        result.appliedFixes.push('将无效的标签替换为空数组');
      }
    }
    
    // 修复依赖
    if (taskFile.metadata.dependencies && !Array.isArray(taskFile.metadata.dependencies)) {
      taskFile.metadata.dependencies = [];
      result.appliedFixes.push('将无效的依赖替换为空数组');
    }
  }
  
  /**
   * 修复参数
   */
  private fixParameters(result: FixResult): void {
    const taskFile = result.taskFile;
    
    // 确保参数是数组
    if (!Array.isArray(taskFile.parameters)) {
      taskFile.parameters = [];
      result.appliedFixes.push('创建了空参数数组');
      return;
    }
    
    // 修复每个参数
    for (let i = 0; i < taskFile.parameters.length; i++) {
      const param = taskFile.parameters[i];
      
      // 确保参数是对象
      if (!param || typeof param !== 'object') {
        taskFile.parameters[i] = {
          name: `param${i+1}`,
          label: `Parameter ${i+1}`,
          type: 'string',
          required: false,
          description: 'Auto-generated parameter'
        };
        result.appliedFixes.push(`替换了无效的参数${i+1}`);
        continue;
      }
      
      // 修复名称
      if (!param.name) {
        param.name = `param${i+1}`;
        result.appliedFixes.push(`为参数${i+1}添加了默认名称`);
      }
      
      // 修复标签
      if (!param.label) {
        param.label = param.name.charAt(0).toUpperCase() + param.name.slice(1);
        result.appliedFixes.push(`为参数${param.name}添加了默认标签`);
      }
      
      // 修复类型
      if (!param.type) {
        param.type = 'string';
        result.appliedFixes.push(`为参数${param.name}添加了默认类型`);
      } else if (typeof param.type !== 'string') {
        param.type = 'string';
        result.appliedFixes.push(`将参数${param.name}的无效类型替换为string`);
      }
      
      // 修复描述
      if (!param.description) {
        param.description = `Parameter ${param.name}`;
        result.appliedFixes.push(`为参数${param.name}添加了默认描述`);
      }
      
      // 修复required字段
      if (param.required === undefined) {
        param.required = false;
        result.appliedFixes.push(`为参数${param.name}添加了默认required值`);
      } else if (typeof param.required !== 'boolean') {
        param.required = Boolean(param.required);
        result.appliedFixes.push(`将参数${param.name}的required值转换为布尔值`);
      }
      
      // 修复select和multiselect类型的参数
      if (param.type === 'select' || param.type === 'multiselect') {
        if (!param.validation) {
          param.validation = {};
        }
        if (!param.validation.options || !Array.isArray(param.validation.options) || param.validation.options.length === 0) {
          param.validation.options = [
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
            { label: 'Option 3', value: 'option3' }
          ];
          result.appliedFixes.push(`为${param.type}类型的参数${param.name}添加了默认选项`);
        }
      }
    }
  }
  
  /**
   * 修复代码
   */
  private fixCode(result: FixResult): void {
    const taskFile = result.taskFile;
    
    // 确保代码存在
    if (!taskFile.code) {
      taskFile.code = `
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
`;
      result.appliedFixes.push('添加了默认执行函数');
      return;
    }
    
    // 确保代码是字符串
    if (typeof taskFile.code !== 'string') {
      taskFile.code = String(taskFile.code);
      result.appliedFixes.push('将代码转换为字符串');
    }
    
    // 检查是否有execute函数
    const hasExecuteFunction = taskFile.code.includes('function execute(') || 
                             taskFile.code.includes('execute = function(') || 
                             taskFile.code.includes('execute=function(');
    
    if (!hasExecuteFunction) {
      // 尝试查找其他函数并重命名
      const functionMatch = taskFile.code.match(/function\s+(\w+)\s*\(/);
      if (functionMatch && functionMatch[1] !== 'execute') {
        taskFile.code = taskFile.code.replace(
          new RegExp(`function\\s+${functionMatch[1]}\\s*\\(`), 
          'function execute('
        );
        result.appliedFixes.push(`将函数${functionMatch[1]}重命名为execute`);
      } else {
        // 添加默认execute函数
        taskFile.code += `
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
`;
        result.appliedFixes.push('添加了默认execute函数');
      }
    }
    
    // 检查是否是异步函数
    if (!taskFile.code.includes('async function execute(') && 
        !taskFile.code.includes('execute = async function(') && 
        !taskFile.code.includes('execute=async function(')) {
      // 将函数转换为异步函数
      taskFile.code = taskFile.code
        .replace(/function\s+execute\s*\(/, 'async function execute(')
        .replace(/execute\s*=\s*function\s*\(/, 'execute = async function(')
        .replace(/execute\s*=\s*function\s*\(/, 'execute=async function(');
      result.appliedFixes.push('将execute函数转换为异步函数');
    }
    
    // 确保代码导出了必要的对象
    if (!taskFile.code.includes('module.exports') && !taskFile.code.includes('export')) {
      taskFile.code += `
// 导出任务组件
module.exports = { parameters, dependencies, config, execute };
`;
      result.appliedFixes.push('添加了缺失的模块导出');
    }
  }
  
  /**
   * 修复示例
   */
  private fixExamples(result: FixResult): void {
    const taskFile = result.taskFile;
    
    // 确保示例是数组
    if (taskFile.examples && !Array.isArray(taskFile.examples)) {
      taskFile.examples = [];
      result.appliedFixes.push('将无效的示例替换为空数组');
    }
    
    // 如果没有示例，不需要修复
    if (!taskFile.examples || taskFile.examples.length === 0) {
      return;
    }
    
    // 修复每个示例
    for (let i = 0; i < taskFile.examples.length; i++) {
      const example = taskFile.examples[i];
      
      // 确保示例是对象
      if (!example || typeof example !== 'object') {
        taskFile.examples[i] = {
          name: `Example ${i+1}`,
          description: `Example ${i+1} description`,
          parameters: {}
        };
        result.appliedFixes.push(`替换了无效的示例${i+1}`);
        continue;
      }
      
      // 修复名称
      if (!example.name) {
        example.name = `Example ${i+1}`;
        result.appliedFixes.push(`为示例${i+1}添加了默认名称`);
      }
      
      // 修复参数
      if (!example.parameters || typeof example.parameters !== 'object' || Array.isArray(example.parameters)) {
        example.parameters = {};
        result.appliedFixes.push(`为示例${example.name}添加了空参数对象`);
      }
    }
  }
}