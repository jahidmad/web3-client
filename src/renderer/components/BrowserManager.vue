<template>
  <div class="browser-manager">
    <div class="header">
      <div class="header-left">
        <h2>浏览器管理</h2>
        <p class="header-subtitle">管理和控制本地浏览器实例</p>
      </div>
      <div class="actions">
        <button @click="refreshBrowsers" class="btn-secondary">
          <i class="icon">🔄</i>
          刷新
        </button>
        <button @click="showCreateDialog = true" class="btn-primary">
          <i class="icon">➕</i>
          创建浏览器
        </button>
      </div>
    </div>

    <!-- 浏览器列表 -->
    <div class="browser-list">
      <div v-if="loading" class="loading">加载中...</div>
      
      <div v-else-if="browsers.length === 0" class="empty-state">
        <div class="empty-icon">🌐</div>
        <h3>还没有创建任何浏览器</h3>
        <p>创建您的第一个浏览器实例，开始您的自动化之旅</p>
        <div class="empty-actions">
          <button @click="showCreateDialog = true" class="btn-primary btn-large">
            <i class="icon">🚀</i>
            创建第一个浏览器
          </button>
        </div>
      </div>

      <div v-else class="browser-grid">
        <div 
          v-for="browser in browsers" 
          :key="browser.id"
          class="browser-card"
          :class="{ 'running': browser.status === 'running' }"
        >
          <div class="browser-header">
            <h3>{{ browser.name }}</h3>
            <span class="status-badge" :class="browser.status">
              {{ getStatusText(browser.status) }}
            </span>
          </div>
          
          <div class="browser-info">
            <p><strong>平台:</strong> {{ browser.platform }}</p>
            <p><strong>创建时间:</strong> {{ formatDate(browser.createdAt) }}</p>
            <p v-if="browser.lastUsedAt">
              <strong>最后使用:</strong> {{ formatDate(browser.lastUsedAt) }}
            </p>
          </div>

          <div class="browser-actions">
            <button 
              v-if="browser.status === 'stopped'"
              @click="openBrowser(browser.id)"
              class="btn-success"
              :disabled="operating.has(browser.id)"
            >
              {{ operating.has(browser.id) ? '启动中...' : '启动' }}
            </button>
            
            <button 
              v-if="browser.status === 'running'"
              @click="closeBrowser(browser.id)"
              class="btn-warning"
              :disabled="operating.has(browser.id)"
            >
              {{ operating.has(browser.id) ? '关闭中...' : '关闭' }}
            </button>
            
            <button 
              @click="showDeleteConfirm(browser)"
              class="btn-danger"
              :disabled="operating.has(browser.id) || browser.status === 'running'"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建浏览器对话框 -->
    <div v-if="showCreateDialog" class="modal-overlay" @click="closeCreateDialog">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <div class="modal-title">
            <i class="modal-icon">🚀</i>
            <h3>创建新浏览器</h3>
          </div>
          <button @click="closeCreateDialog" class="close-btn">&times;</button>
        </div>
        
        <form @submit.prevent="createBrowser" class="create-form">
          <div class="form-group">
            <label for="browserName">浏览器名称</label>
            <input 
              id="browserName"
              v-model="createForm.name" 
              type="text" 
              required 
              placeholder="请输入浏览器名称"
            />
          </div>

          <div class="form-group">
            <label for="headless">运行模式</label>
            <select id="headless" v-model="createForm.headless">
              <option :value="false">有界面模式</option>
              <option :value="true">无界面模式</option>
            </select>
          </div>

          <div class="form-group">
            <label>代理设置 (可选)</label>
            <div class="proxy-config">
              <input 
                v-model="createForm.proxy.host" 
                type="text" 
                placeholder="代理主机"
              />
              <input 
                v-model="createForm.proxy.port" 
                type="text" 
                placeholder="端口"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeCreateDialog" class="btn-secondary">
              取消
            </button>
            <button type="submit" class="btn-primary" :disabled="creating">
              {{ creating ? '创建中...' : '创建' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click="cancelDelete">
      <div class="modal confirm-modal" @click.stop>
        <div class="modal-header">
          <div class="modal-title">
            <i class="modal-icon warning">⚠️</i>
            <h3>确认删除</h3>
          </div>
        </div>
        
        <div class="modal-body">
          <p class="confirm-message">
            您确定要删除浏览器 <strong>"{{ deleteTargetName }}"</strong> 吗？
          </p>
          <p class="confirm-warning">
            此操作不可撤销，所有相关数据将被永久删除。
          </p>
        </div>
        
        <div class="modal-footer">
          <button @click="cancelDelete" class="btn-secondary">
            取消
          </button>
          <button @click="confirmDelete" class="btn-danger">
            <i class="icon">🗑️</i>
            确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'

interface Browser {
  id: string
  name: string
  platform: string
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  createdAt: string
  lastUsedAt?: string
  config: any
}

// 响应式数据
const browsers = ref<Browser[]>([])
const loading = ref(true)
const showCreateDialog = ref(false)
const creating = ref(false)
const operating = ref(new Set<string>())
const showDeleteDialog = ref(false)
const deleteTargetId = ref('')
const deleteTargetName = ref('')

// 创建表单
const createForm = reactive({
  name: '',
  headless: false,
  proxy: {
    host: '',
    port: ''
  }
})

// 生命周期
onMounted(() => {
  refreshBrowsers()
  
  // 监听浏览器状态变化
  if (window.electronAPI?.events?.onBrowserStatusChange) {
    const unsubscribe = window.electronAPI.events.onBrowserStatusChange((event: any, data: any) => {
      console.log('Browser status changed:', data)
      
      // 更新本地浏览器状态
      const browserIndex = browsers.value.findIndex(b => b.id === data.browserId)
      if (browserIndex !== -1) {
        browsers.value[browserIndex] = data.browser
      }
      
      // 清除操作状态
      if (operating.value.has(data.browserId)) {
        operating.value.delete(data.browserId)
      }
    })
    
    // 组件卸载时清理监听器
    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe()
      }
    })
  }
})

// 方法
async function refreshBrowsers() {
  loading.value = true
  try {
    if (window.electronAPI) {
      // 先进行手动状态刷新
      await window.electronAPI.browser.refresh()
      
      // 然后获取更新后的列表
      const result = await window.electronAPI.browser.list()
      browsers.value = result || []
    } else {
      // 开发环境模拟数据
      browsers.value = []
    }
  } catch (error) {
    console.error('获取浏览器列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function createBrowser() {
  if (!createForm.name.trim()) return
  
  creating.value = true
  try {
    const config = {
      name: createForm.name,
      platform: 'local' as const,
      headless: createForm.headless,
      proxy: createForm.proxy.host && createForm.proxy.port ? {
        host: createForm.proxy.host,
        port: createForm.proxy.port,
        type: 'http' as const
      } : undefined
    }

    if (window.electronAPI) {
      const result = await window.electronAPI.browser.create(config)
      if (result.success) {
        await refreshBrowsers()
        closeCreateDialog()
      } else {
        alert('创建失败: ' + (result.error || '未知错误'))
      }
    } else {
      // 开发环境模拟
      console.log('模拟创建浏览器:', config)
      closeCreateDialog()
    }
  } catch (error) {
    console.error('创建浏览器失败:', error)
    alert('创建失败: ' + (error as Error).message)
  } finally {
    creating.value = false
  }
}

async function openBrowser(id: string) {
  operating.value.add(id)
  try {
    if (window.electronAPI) {
      const result = await window.electronAPI.browser.open(id)
      if (result.success) {
        await refreshBrowsers()
      } else {
        alert('启动失败: ' + (result.error || '未知错误'))
      }
    } else {
      console.log('模拟启动浏览器:', id)
    }
  } catch (error) {
    console.error('启动浏览器失败:', error)
    alert('启动失败: ' + (error as Error).message)
  } finally {
    operating.value.delete(id)
  }
}

async function closeBrowser(id: string) {
  operating.value.add(id)
  try {
    if (window.electronAPI) {
      const result = await window.electronAPI.browser.close(id)
      if (result.success) {
        await refreshBrowsers()
      } else {
        alert('关闭失败: ' + (result.error || '未知错误'))
      }
    } else {
      console.log('模拟关闭浏览器:', id)
    }
  } catch (error) {
    console.error('关闭浏览器失败:', error)
    alert('关闭失败: ' + (error as Error).message)
  } finally {
    operating.value.delete(id)
  }
}

function showDeleteConfirm(browser: Browser) {
  deleteTargetId.value = browser.id
  deleteTargetName.value = browser.name
  showDeleteDialog.value = true
}

async function confirmDelete() {
  const id = deleteTargetId.value
  showDeleteDialog.value = false
  
  operating.value.add(id)
  try {
    if (window.electronAPI) {
      const result = await window.electronAPI.browser.delete(id)
      if (result.success) {
        await refreshBrowsers()
      } else {
        alert('删除失败: ' + (result.error || '未知错误'))
      }
    } else {
      console.log('模拟删除浏览器:', id)
    }
  } catch (error) {
    console.error('删除浏览器失败:', error)
    alert('删除失败: ' + (error as Error).message)
  } finally {
    operating.value.delete(id)
  }
}

function cancelDelete() {
  showDeleteDialog.value = false
  deleteTargetId.value = ''
  deleteTargetName.value = ''
}

function closeCreateDialog() {
  showCreateDialog.value = false
  // 重置表单
  createForm.name = ''
  createForm.headless = false
  createForm.proxy.host = ''
  createForm.proxy.port = ''
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    stopped: '已停止',
    starting: '启动中',
    running: '运行中',
    stopping: '停止中',
    error: '错误'
  }
  return statusMap[status] || status
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN')
}

// 类型声明
declare global {
  interface Window {
    electronAPI?: {
      browser: {
        list: () => Promise<Browser[]>
        create: (config: any) => Promise<{ success: boolean; error?: string; data?: Browser }>
        open: (id: string) => Promise<{ success: boolean; error?: string }>
        close: (id: string) => Promise<{ success: boolean; error?: string }>
        delete: (id: string) => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
</script>

<style scoped>
.browser-manager {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  background-color: #0f172a;
  min-height: 100%;
  color: #e2e8f0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid #334155;
}

.header-left h2 {
  margin: 0 0 4px 0;
  color: #e2e8f0;
  font-size: 24px;
  font-weight: 600;
}

.header-subtitle {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 400;
}

.actions {
  display: flex;
  gap: 12px;
}

.icon {
  margin-right: 6px;
  font-size: 14px;
}

/* 按钮样式 - 暗色主题 */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background-color: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #64748b;
  border-color: #94a3b8;
}

.btn-success {
  background-color: #10b981;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

.btn-warning {
  background-color: #f59e0b;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-warning:hover:not(:disabled) {
  background-color: #d97706;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-success:disabled,
.btn-warning:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 浏览器列表样式 - 暗色主题 */
.loading {
  text-align: center;
  padding: 60px;
  color: #94a3b8;
  font-size: 16px;
}

.empty-state {
  text-align: center;
  padding: 80px 40px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.7;
}

.empty-state h3 {
  color: #e2e8f0;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.empty-state p {
  color: #94a3b8;
  font-size: 14px;
  margin: 0 0 32px 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

.empty-actions {
  display: flex;
  justify-content: center;
}

.btn-large {
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
}

.browser-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.browser-card {
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.browser-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border-color: #475569;
}

.browser-card.running {
  border-color: #10b981;
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.1), 0 0 0 1px rgba(16, 185, 129, 0.1);
}

.browser-card.running:hover {
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2);
}

.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.browser-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.stopped {
  background: rgba(100, 116, 139, 0.2);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.status-badge.running {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  animation: pulse-green 2s infinite;
}

.status-badge.starting {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.browser-info {
  margin-bottom: 20px;
}

.browser-info p {
  margin: 6px 0;
  font-size: 13px;
  color: #94a3b8;
}

.browser-info strong {
  color: #cbd5e1;
  font-weight: 500;
}

.browser-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #334155;
}

/* 模态框样式 - 暗色主题 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 90%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #334155;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  font-size: 20px;
}

.modal-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid #475569;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  color: #94a3b8;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.create-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #e2e8f0;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #475569;
  border-radius: 8px;
  font-size: 14px;
  background-color: #0f172a;
  color: #e2e8f0;
  transition: all 0.2s ease;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input::placeholder {
  color: #64748b;
}

.proxy-config {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #334155;
}

/* 确认对话框特殊样式 */
.confirm-modal {
  max-width: 420px;
}

.modal-body {
  padding: 24px;
}

.confirm-message {
  color: #e2e8f0;
  font-size: 16px;
  margin: 0 0 12px 0;
  line-height: 1.5;
}

.confirm-message strong {
  color: #f59e0b;
  font-weight: 600;
}

.confirm-warning {
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
  line-height: 1.4;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px 24px;
  border-top: 1px solid #334155;
}

.warning {
  color: #f59e0b !important;
}
</style>