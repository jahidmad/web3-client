# Web3 Client

专业浏览器自动化平台 - 基础架构与本地浏览器管理

## 项目规则

📋 **重要**: 本项目包含专门的开发规则文档 [`CLAUDE.md`](./CLAUDE.md)，其中定义了：
- Claude Code 操作规范
- package.json 修改规则
- 依赖管理规则
- 文件操作规则
- 错误预防机制

请在进行任何代码修改前先阅读项目规则文档。

## 项目结构

```
web3-client/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── database/         # 数据库层
│   │   │   ├── schema.prisma # Prisma 数据模型
│   │   │   └── database-service.ts # 数据库服务
│   │   ├── services/         # 业务逻辑层
│   │   │   ├── browser-manager.ts # 浏览器管理服务
│   │   │   └── local-browser.ts   # 本地浏览器实现
│   │   ├── types/            # 类型定义
│   │   │   ├── browser.ts    # 浏览器相关类型
│   │   │   ├── task.ts       # 任务相关类型
│   │   │   ├── account.ts    # 账户相关类型
│   │   │   └── index.ts      # 统一导出
│   │   ├── utils/            # 工具函数
│   │   │   ├── logger.ts     # 日志工具
│   │   │   ├── error-handler.ts # 错误处理
│   │   │   └── index.ts      # 统一导出
│   │   └── index.ts          # 主进程入口
│   ├── preload/              # 预加载脚本
│   │   └── index.ts          # IPC 通信桥接
│   └── renderer/             # 渲染进程 (待实现)
├── data/                     # 数据目录
├── logs/                     # 日志目录
├── package.json
├── tsconfig.json
├── tsconfig.main.json
└── .gitignore
```

## 核心功能

### 1. 浏览器管理系统
- ✅ 支持本地浏览器 (puppeteer-real-browser)
- ✅ 统一的浏览器平台接口
- ✅ 浏览器生命周期管理 (创建、开启、关闭、删除)
- ✅ 浏览器状态监控
- ✅ 批量操作支持
- ✅ 代理配置和指纹伪装

### 2. 数据存储
- ✅ Prisma ORM + SQLite 数据库
- ✅ 完整的数据模型定义
- ✅ 浏览器配置持久化
- ✅ 系统日志记录
- ✅ 配置管理

### 3. 错误处理和日志
- ✅ Winston 日志系统
- ✅ 分级日志记录
- ✅ 异常处理机制
- ✅ 重试机制
- ✅ 日志文件自动轮转

### 4. IPC 通信
- ✅ 前后端通信桥接
- ✅ 类型安全的 API 接口
- ✅ 事件监听机制

## 快速开始

### 安装依赖

```bash
npm install
```

### 数据库初始化

```bash
# 生成 Prisma 客户端
npx prisma generate --schema=src/main/database/schema.prisma

# 推送数据库结构
npx prisma db push --schema=src/main/database/schema.prisma
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

## 技术栈

### 后端技术栈
- **Electron** - 跨平台桌面应用框架
- **TypeScript** - 类型安全的 JavaScript
- **Prisma** - 现代化 ORM
- **SQLite** - 轻量级数据库
- **puppeteer-real-browser** - 浏览器自动化
- **Winston** - 企业级日志系统

### 浏览器自动化
- **puppeteer-real-browser** - 本地浏览器操作引擎
- **Chrome DevTools Protocol** - 底层浏览器控制

## 使用示例

### 创建本地浏览器

```typescript
const browserConfig = {
  name: 'Test Browser',
  platform: 'local',
  headless: false,
  proxy: {
    host: '127.0.0.1',
    port: '8080'
  },
  fingerprint: {
    userAgent: 'Mozilla/5.0...',
    viewport: { width: 1920, height: 1080 }
  }
};

const result = await electronAPI.browser.create(browserConfig);
```

### 操作浏览器

```typescript
// 打开浏览器
await electronAPI.browser.open(browserId);

// 获取浏览器状态
const status = await electronAPI.browser.status(browserId);

// 关闭浏览器
await electronAPI.browser.close(browserId);

// 删除浏览器
await electronAPI.browser.delete(browserId);
```

## 架构特点

### 1. 模块化设计
- 清晰的模块边界
- 松耦合的组件结构
- 便于测试和维护

### 2. 类型安全
- 完整的 TypeScript 类型定义
- 编译时错误检查
- 智能代码提示

### 3. 错误处理
- 统一的错误处理机制
- 详细的错误日志
- 优雅的错误恢复

### 4. 扩展性
- 插件化的浏览器平台
- 可扩展的服务架构
- 灵活的配置系统

## 后续计划

1. **前端界面** - Vue 3 + Element Plus 用户界面
2. **任务系统** - 任务创建、执行、调度
3. **账户管理** - 多平台账户管理
4. **第三方平台** - AdsPower、BitBrowser 集成
5. **高级功能** - 批量操作、数据分析、报表

## 注意事项

- 确保已安装 Chrome/Chromium 浏览器
- 代理配置需要确保网络连通性
- 数据库文件自动创建在 data 目录
- 日志文件保存在 logs 目录

---

基础架构已完成，包含核心的浏览器管理功能和数据存储层。代码结构清晰，具有良好的扩展性和可维护性。