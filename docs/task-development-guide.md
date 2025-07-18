# 任务开发指南

## 概述

Web3 Client 任务系统允许你创建、上传和执行自定义的浏览器自动化任务。本指南将帮助你了解如何开发自己的任务。

## 任务文件格式

任务文件是标准的 JavaScript 文件，使用 JSDoc 注释定义元数据，并导出必要的组件。

### 基本结构

```javascript
/**
 * @name 任务名称
 * @description 任务描述
 * @version 1.0.0
 * @author 作者名称
 * @category 任务类别
 * @tags 标签1, 标签2, 标签3
 * @icon 📝
 */

// 任务参数定义
const parameters = [
  {
    name: 'url',
    label: '目标URL',
    type: 'url',
    required: true,
    description: '要处理的网页URL'
  }
];

// 任务依赖（可选）
const dependencies = [
  'sharp@0.32.6',
  'pdf-lib@1.17.1'
];

// 任务配置（可选）
const config = {
  timeout: 30000,
  retries: 1,
  concurrent: true,
  permissions: ['network', 'filesystem']
};

// 主执行函数
async function execute(context) {
  const { page, params, log, progress, utils } = context;
  
  // 任务逻辑
  log('开始执行任务...');
  progress(50, '处理中...');
  
  return {
    success: true,
    data: {},
    message: '任务完成'
  };
}

// 导出组件
module.exports = {
  parameters,
  dependencies,
  config,
  execute
};
```

## 元数据字段

### 必需字段
- `@name`: 任务名称
- `@description`: 任务描述
- `@version`: 版本号（建议使用语义化版本）
- `@author`: 作者名称

### 可选字段
- `@category`: 任务类别
- `@tags`: 标签（逗号分隔）
- `@icon`: 图标（emoji）

## 参数定义

参数数组定义了任务需要的用户输入：

```javascript
const parameters = [
  {
    name: 'fieldName',        // 参数名称（必需）
    label: '显示标签',         // 用户界面显示的标签（必需）
    type: 'string',           // 参数类型（必需）
    required: true,           // 是否必需（可选，默认false）
    default: 'defaultValue',  // 默认值（可选）
    placeholder: '提示文本',   // 占位符文本（可选）
    description: '参数描述',   // 参数说明（可选）
    min: 1,                   // 最小值（数字类型）
    max: 100,                 // 最大值（数字类型）
    options: [                // 选项（select类型）
      { label: '选项1', value: 'value1' },
      { label: '选项2', value: 'value2' }
    ]
  }
];
```

### 支持的参数类型

- `string`: 文本输入
- `number`: 数字输入
- `boolean`: 布尔值（复选框）
- `url`: URL输入（带验证）
- `email`: 邮箱输入（带验证）
- `select`: 单选下拉框
- `multiselect`: 多选下拉框
- `file`: 文件选择
- `textarea`: 多行文本
- `password`: 密码输入
- `date`: 日期选择
- `time`: 时间选择
- `datetime`: 日期时间选择

## 依赖管理

如果你的任务需要外部 npm 包，可以在 `dependencies` 数组中声明：

```javascript
const dependencies = [
  'sharp@0.32.6',           // 指定版本
  'lodash@latest',          // 最新版本
  'moment'                  // 默认版本
];
```

系统会在执行任务前自动安装这些依赖。

## 任务配置

`config` 对象定义任务的执行配置：

```javascript
const config = {
  timeout: 30000,           // 超时时间（毫秒）
  retries: 1,               // 重试次数
  concurrent: true,         // 是否允许并发执行
  permissions: [            // 所需权限
    'network',              // 网络访问
    'filesystem'            // 文件系统访问
  ]
};
```

## 执行函数

`execute` 函数是任务的主要逻辑，接收一个 `context` 对象：

```javascript
async function execute(context) {
  const { page, params, log, progress, utils, browser } = context;
  
  // page: Playwright页面对象
  // params: 用户输入的参数
  // log: 日志记录函数
  // progress: 进度报告函数
  // utils: 工具函数库
  // browser: 浏览器对象（高级用法）
  
  // 你的任务逻辑...
  
  return {
    success: true,          // 是否成功
    data: {},              // 返回数据
    message: '任务完成'     // 状态消息
  };
}
```

### 上下文对象详解

#### page
Playwright 页面对象，提供浏览器操作功能：
```javascript
await page.goto('https://example.com');
await page.click('#button');
await page.type('#input', 'text');
const text = await page.textContent('#element');
```

#### params
用户输入的参数对象：
```javascript
console.log(params.url);        // 访问URL参数
console.log(params.maxItems);   // 访问数字参数
```

#### log
日志记录函数：
```javascript
log('信息消息');
log('错误消息', 'error');
log('警告消息', 'warn');
```

#### progress
进度报告函数：
```javascript
progress(50, '处理中...');      // 50%进度，消息
progress(100, '完成');          // 100%进度
```

#### utils
工具函数库，提供常用功能：

```javascript
// 等待和延迟
await utils.wait(1000);                    // 等待1秒
await utils.sleep(2000);                   // 等待2秒

// 页面操作
await utils.waitForSelector('#element');   // 等待元素出现
await utils.click('#button');              // 点击元素
await utils.type('#input', 'text');        // 输入文本
const text = await utils.extractText('#element'); // 提取文本

// 文件操作
const path = await utils.saveFile(content, 'file.txt'); // 保存文件
const screenshot = await utils.screenshot('page.png');  // 截图

// 数据处理
const date = utils.formatDate(new Date());              // 格式化日期
const isValid = utils.isValidEmail('test@example.com'); // 验证邮箱
const unique = utils.unique([1, 2, 2, 3]);             // 数组去重
const csv = utils.parseCSV(csvText);                    // 解析CSV
const json = utils.safeJsonParse(jsonText);             // 安全解析JSON

// 随机和工具
const id = utils.randomString(8);                       // 生成随机字符串
const hash = utils.createHash('content');               // 创建哈希
```

## 错误处理

任务应该正确处理错误：

```javascript
async function execute(context) {
  const { page, params, log } = context;
  
  try {
    // 任务逻辑
    await page.goto(params.url);
    
    return {
      success: true,
      data: {},
      message: '任务完成'
    };
    
  } catch (error) {
    log(`任务执行失败: ${error.message}`);
    throw new Error(`任务失败: ${error.message}`);
  }
}
```

## 最佳实践

### 1. 提供详细的日志
```javascript
log('开始处理...');
log(`正在访问: ${params.url}`);
log('数据提取完成');
```

### 2. 报告进度
```javascript
progress(25, '加载页面');
progress(50, '提取数据');
progress(75, '处理结果');
progress(100, '完成');
```

### 3. 验证参数
```javascript
if (!params.url || !utils.isValidUrl(params.url)) {
  throw new Error('无效的URL参数');
}
```

### 4. 处理异步操作
```javascript
// 等待元素出现
await utils.waitForSelector('#content', 10000);

// 等待网络请求完成
await page.waitForLoadState('networkidle');
```

### 5. 保存结果
```javascript
const results = { /* 你的数据 */ };
const filename = `results_${utils.formatDate(new Date())}.json`;
const savedPath = await utils.saveFile(
  JSON.stringify(results, null, 2),
  filename
);
```

## 示例任务

查看 `data/tasks/` 目录中的示例任务：

- `simple-web-scraper.js` - 基本网页数据抓取
- `form-filler.js` - 自动表单填写
- `page-monitor.js` - 页面内容监控
- `webpage-screenshot-pdf.js` - 网页截图和PDF生成

## 调试技巧

### 1. 使用日志调试
```javascript
log(`当前URL: ${page.url()}`);
log(`页面标题: ${await page.title()}`);
log(`参数值: ${JSON.stringify(params)}`);
```

### 2. 截图调试
```javascript
await utils.screenshot('debug_step1.png');
// 执行一些操作
await utils.screenshot('debug_step2.png');
```

### 3. 元素检查
```javascript
const element = await page.$('#selector');
if (!element) {
  log('元素未找到');
} else {
  log('元素存在');
}
```

## 常见问题

### Q: 如何处理动态加载的内容？
A: 使用等待函数：
```javascript
await utils.waitForSelector('#dynamic-content');
await page.waitForLoadState('networkidle');
```

### Q: 如何处理多个页面？
A: 使用浏览器上下文：
```javascript
const newPage = await browser.newPage();
await newPage.goto('https://example.com');
// 处理新页面
await newPage.close();
```

### Q: 如何保存大量数据？
A: 分批保存或使用流式处理：
```javascript
const batchSize = 100;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await utils.saveFile(
    JSON.stringify(batch),
    `batch_${Math.floor(i / batchSize)}.json`
  );
}
```

## 发布和分享

完成任务开发后，你可以：

1. 将任务文件保存为 `.js` 文件
2. 通过应用界面上传任务
3. 与他人分享任务文件
4. 从远程URL导入任务

任务系统会自动处理依赖安装、参数验证和执行环境设置。

## 获取帮助

如果遇到问题，可以：

1. 查看示例任务代码
2. 检查日志输出
3. 使用调试功能
4. 参考API文档

祝你开发愉快！🚀