<template>
  <div id="app" class="dark-theme">
    <!-- 侧边栏导航 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">W3</div>
          <div class="logo-text">
            <div class="logo-title">Web3 Client</div>
            <div class="logo-subtitle">浏览器自动化平台</div>
          </div>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">核心功能</div>
          <ul class="nav-menu">
            <li class="nav-item" :class="{ active: activeTab === 'browser' }">
              <button @click="activeTab = 'browser'" class="nav-link">
                <i class="nav-icon">🌐</i>
                <span>浏览器管理</span>
              </button>
            </li>
            <li class="nav-item" :class="{ active: activeTab === 'task' }">
              <button @click="activeTab = 'task'" class="nav-link">
                <i class="nav-icon">⚡</i>
                <span>任务管理</span>
              </button>
            </li>
            <li class="nav-item" :class="{ active: activeTab === 'account' }">
              <button @click="activeTab = 'account'" class="nav-link" disabled>
                <i class="nav-icon">👥</i>
                <span>账户管理</span>
                <span class="coming-soon-badge">Soon</span>
              </button>
            </li>
          </ul>
        </div>
        
        <div class="nav-section">
          <div class="nav-section-title">系统管理</div>
          <ul class="nav-menu">
            <li class="nav-item" :class="{ active: activeTab === 'settings' }">
              <button @click="activeTab = 'settings'" class="nav-link" disabled>
                <i class="nav-icon">⚙️</i>
                <span>系统设置</span>
                <span class="coming-soon-badge">Soon</span>
              </button>
            </li>
            <li class="nav-item" :class="{ active: activeTab === 'logs' }">
              <button @click="activeTab = 'logs'" class="nav-link" disabled>
                <i class="nav-icon">📊</i>
                <span>运行日志</span>
                <span class="coming-soon-badge">Soon</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
      
      <div class="sidebar-footer">
        <div class="status-indicator">
          <div class="status-dot active"></div>
          <span class="status-text">系统运行正常</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 顶部导航栏 -->
      <header class="main-header">
        <div class="breadcrumb">
          <span class="breadcrumb-item">{{ getBreadcrumbText() }}</span>
        </div>
        
        <div class="header-actions">
          <button class="header-btn" title="刷新">
            <i>🔄</i>
          </button>
          <button class="header-btn" title="帮助">
            <i>❓</i>
          </button>
          <div class="theme-toggle">
            <span class="theme-label">暗色主题</span>
          </div>
        </div>
      </header>

      <!-- 内容区域 -->
      <div class="content-area">
        <BrowserManager v-if="activeTab === 'browser'" />
        <TaskManager v-else-if="activeTab === 'task'" />
        
        <div v-else class="coming-soon-content">
          <div class="coming-soon-icon">🚧</div>
          <h3>{{ getTabTitle() }}</h3>
          <p>此功能正在开发中，敬请期待...</p>
          <div class="feature-preview">
            <h4>即将推出的功能：</h4>
            <ul v-if="activeTab === 'account'">
              <li>多平台账户管理</li>
              <li>账户状态验证</li>
              <li>批量导入导出</li>
              <li>安全加密存储</li>
            </ul>
            <ul v-else>
              <li>系统配置管理</li>
              <li>性能监控</li>
              <li>日志查看</li>
              <li>数据统计</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BrowserManager from './renderer/components/BrowserManager.vue'
import TaskManager from './renderer/components/TaskManager.vue'

const activeTab = ref('browser')

const getBreadcrumbText = () => {
  const breadcrumbs: Record<string, string> = {
    browser: '浏览器管理',
    task: '任务管理',
    account: '账户管理',
    settings: '系统设置',
    logs: '运行日志'
  }
  return breadcrumbs[activeTab.value] || '首页'
}

const getTabTitle = () => {
  const titles: Record<string, string> = {
    task: '任务自动化引擎',
    account: '账户管理系统',
    settings: '系统设置',
    logs: '运行日志'
  }
  return titles[activeTab.value] || '功能开发中'
}

onMounted(() => {
  console.log('Web3 Client 已启动')
})
</script>

<style scoped>
/* 全局暗色主题 */
.dark-theme {
  background-color: #0a0e27;
  color: #e2e8f0;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  width: 260px;
  background: linear-gradient(180deg, #1a1d3a 0%, #0f1629 100%);
  border-right: 1px solid #2d3748;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid #2d3748;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  color: white;
}

.logo-text {
  flex: 1;
}

.logo-title {
  font-size: 16px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 2px;
}

.logo-subtitle {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}

/* 导航样式 */
.sidebar-nav {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 32px;
}

.nav-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
  padding: 0 20px;
}

.nav-menu {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  margin-bottom: 4px;
}

.nav-link {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: none;
  border: none;
  color: #94a3b8;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  font-size: 14px;
}

.nav-link:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}

.nav-item.active .nav-link {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.1) 0%, transparent 100%);
  color: #667eea;
  border-right: 3px solid #667eea;
}

.nav-link:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.coming-soon-badge {
  margin-left: auto;
  background: #2563eb;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #2d3748;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  animation: pulse 2s infinite;
}

.status-text {
  font-size: 12px;
  color: #64748b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #0f172a;
  overflow: hidden;
}

/* 顶部导航栏 */
.main-header {
  height: 64px;
  background-color: #1e293b;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.breadcrumb {
  display: flex;
  align-items: center;
}

.breadcrumb-item {
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: none;
  border: 1px solid #334155;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-btn:hover {
  background-color: #334155;
  color: #e2e8f0;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.theme-label::before {
  content: '🌙';
  margin-right: 4px;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow-y: auto;
  background-color: #0f172a;
}

/* 即将推出的内容样式 */
.coming-soon-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 60px 40px;
  text-align: center;
}

.coming-soon-icon {
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.7;
}

.coming-soon-content h3 {
  font-size: 28px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 12px;
}

.coming-soon-content p {
  font-size: 16px;
  color: #94a3b8;
  margin-bottom: 40px;
  max-width: 500px;
}

.feature-preview {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 32px;
  max-width: 600px;
  text-align: left;
}

.feature-preview h4 {
  color: #e2e8f0;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.feature-preview ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-preview li {
  color: #94a3b8;
  margin-bottom: 8px;
  padding-left: 20px;
  position: relative;
}

.feature-preview li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 200px;
  }
  
  .main-header {
    padding: 0 16px;
  }
  
  .coming-soon-content {
    padding: 40px 20px;
  }
}
</style>

<style>
/* 全局样式重置 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #1e293b;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>