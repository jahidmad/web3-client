<template>
  <div class="browser-manager">
    <div class="header">
      <div class="header-left">
        <h2>浏览器管理</h2>
        <p class="header-subtitle">管理和控制本地浏览器实例</p>
      </div>
      <div class="actions">
        <div class="view-switch">
          <button 
            @click="viewMode = 'list'" 
            :class="['view-btn', { active: viewMode === 'list' }]"
            title="列表视图"
          >
            <i class="icon">☰</i>
          </button>
          <button 
            @click="viewMode = 'grid'" 
            :class="['view-btn', { active: viewMode === 'grid' }]"
            title="卡片视图"
          >
            <i class="icon">⊞</i>
          </button>
        </div>
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

      <div v-else>
        <!-- 卡片视图 -->
        <div v-if="viewMode === 'grid'" class="browser-grid">
          <div 
            v-for="browser in paginatedBrowsers" 
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
              <p v-if="browser.config?.proxy">
                <strong>代理:</strong> {{ browser.config.proxy.protocol || browser.config.proxy.type || 'http' }}://{{ browser.config.proxy.host }}:{{ browser.config.proxy.port }}
                <span v-if="browser.config.proxy.username"> ({{ browser.config.proxy.username }})</span>
              </p>
              <p v-else><strong>代理:</strong> 未设置</p>
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

        <!-- 列表视图 -->
        <div v-else class="browser-table">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>平台</th>
                <th>代理</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后使用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="browser in paginatedBrowsers" 
                :key="browser.id"
                :class="{ 'running': browser.status === 'running' }"
              >
                <td class="browser-name">{{ browser.name }}</td>
                <td>{{ browser.platform }}</td>
                <td class="proxy-info">
                  <span v-if="browser.config?.proxy">
                    {{ browser.config.proxy.protocol || browser.config.proxy.type || 'http' }}://{{ browser.config.proxy.host }}:{{ browser.config.proxy.port }}
                    <br v-if="browser.config.proxy.username">
                    <small v-if="browser.config.proxy.username">{{ browser.config.proxy.username }}</small>
                  </span>
                  <span v-else class="no-proxy">未设置</span>
                </td>
                <td>
                  <span class="status-badge" :class="browser.status">
                    {{ getStatusText(browser.status) }}
                  </span>
                </td>
                <td>{{ formatDate(browser.createdAt) }}</td>
                <td>{{ browser.lastUsedAt ? formatDate(browser.lastUsedAt) : '-' }}</td>
                <td class="table-actions">
                  <button 
                    v-if="browser.status === 'stopped'"
                    @click="openBrowser(browser.id)"
                    class="btn-success btn-sm"
                    :disabled="operating.has(browser.id)"
                  >
                    {{ operating.has(browser.id) ? '启动中...' : '启动' }}
                  </button>
                  
                  <button 
                    v-if="browser.status === 'running'"
                    @click="closeBrowser(browser.id)"
                    class="btn-warning btn-sm"
                    :disabled="operating.has(browser.id)"
                  >
                    {{ operating.has(browser.id) ? '关闭中...' : '关闭' }}
                  </button>
                  
                  <button 
                    @click="showDeleteConfirm(browser)"
                    class="btn-danger btn-sm"
                    :disabled="operating.has(browser.id) || browser.status === 'running'"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div v-if="totalPages > 1" class="pagination">
          <button 
            @click="currentPage = 1" 
            :disabled="currentPage === 1"
            class="page-btn"
          >
            ⟪
          </button>
          <button 
            @click="currentPage--" 
            :disabled="currentPage === 1"
            class="page-btn"
          >
            ⟨
          </button>
          
          <span class="page-info">
            第 {{ currentPage }} 页，共 {{ totalPages }} 页 ({{ browsers.length }} 项)
          </span>
          
          <button 
            @click="currentPage++" 
            :disabled="currentPage === totalPages"
            class="page-btn"
          >
            ⟩
          </button>
          <button 
            @click="currentPage = totalPages" 
            :disabled="currentPage === totalPages"
            class="page-btn"
          >
            ⟫
          </button>
          
          <select v-model="pageSize" class="page-size-select">
            <option :value="10">10/页</option>
            <option :value="20">20/页</option>
            <option :value="50">50/页</option>
          </select>
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
            <div class="proxy-section">
              <div class="proxy-toggle">
                <label class="switch">
                  <input type="checkbox" v-model="createForm.enableProxy">
                  <span class="slider"></span>
                </label>
                <span>启用代理</span>
              </div>
              
              <div v-if="createForm.enableProxy" class="proxy-config">
                <div class="proxy-row">
                  <select v-model="createForm.proxy.protocol" class="proxy-protocol">
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks4">SOCKS4</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                  <input 
                    :value="createForm.proxy.host"
                    @input="createForm.proxy.host = $event.target.value"
                    type="text" 
                    placeholder="代理地址 (如: 127.0.0.1)"
                    class="proxy-input"
                    style="flex: 2; min-width: 200px; background: #1e293b !important; color: #e2e8f0 !important;"
                  />
                  <input 
                    :value="createForm.proxy.port"
                    @input="createForm.proxy.port = $event.target.value"
                    type="text" 
                    placeholder="端口"
                    class="proxy-port"
                  />
                </div>
                
                <div class="proxy-row">
                  <input 
                    :value="createForm.proxy.username"
                    @input="createForm.proxy.username = $event.target.value"
                    type="text" 
                    placeholder="用户名 (可选)"
                    class="proxy-input"
                  />
                  <input 
                    :value="createForm.proxy.password"
                    @input="createForm.proxy.password = $event.target.value"
                    type="password" 
                    placeholder="密码 (可选)"
                    class="proxy-input"
                  />
                </div>
              </div>
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
            此操作不可撤销，浏览器配置和所有用户数据（历史记录、Cookie、书签等）将被永久删除。
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
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'

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

// 视图和分页
const viewMode = ref<'grid' | 'list'>('list')
const currentPage = ref(1)
const pageSize = ref(20)

// 创建表单
const createForm = reactive({
  name: '',
  headless: false,
  enableProxy: false,
  proxy: {
    protocol: 'http' as 'http' | 'https' | 'socks4' | 'socks5',
    host: '',
    port: '',
    username: '',
    password: ''
  }
})

// 计算属性
const totalPages = computed(() => Math.ceil(browsers.value.length / pageSize.value))
const paginatedBrowsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return browsers.value.slice(start, end)
})

// 监听页面大小变化，调整当前页
watch(pageSize, () => {
  currentPage.value = 1
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
      proxy: createForm.enableProxy && createForm.proxy.host && createForm.proxy.port ? {
        protocol: createForm.proxy.protocol,
        host: createForm.proxy.host,
        port: createForm.proxy.port,
        username: createForm.proxy.username || undefined,
        password: createForm.proxy.password || undefined
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
  createForm.enableProxy = false
  createForm.proxy.protocol = 'http'
  createForm.proxy.host = ''
  createForm.proxy.port = ''
  createForm.proxy.username = ''
  createForm.proxy.password = ''
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
        refresh: () => Promise<{ success: boolean; error?: string }>
      }
      events?: {
        onBrowserStatusChange: (callback: (event: any, data: any) => void) => () => void
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
  align-items: center;
}

/* 视图切换按钮 */
.view-switch {
  display: flex;
  border: 1px solid #475569;
  border-radius: 8px;
  overflow: hidden;
  margin-right: 8px;
}

.view-btn {
  background: #475569;
  color: #94a3b8;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}

.view-btn:hover {
  background: #64748b;
  color: #e2e8f0;
}

.view-btn.active {
  background: #667eea;
  color: white;
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

.btn-sm {
  padding: 6px 10px;
  font-size: 11px;
  margin-right: 4px;
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

/* 列表视图样式 */
.browser-table {
  background: #1e293b;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #334155;
}

.browser-table table {
  width: 100%;
  border-collapse: collapse;
}

.browser-table th {
  background: #334155;
  color: #e2e8f0;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
}

.browser-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #334155;
  color: #cbd5e1;
  font-size: 14px;
}

.browser-table tr:last-child td {
  border-bottom: none;
}

.browser-table tr:hover {
  background: rgba(100, 116, 139, 0.1);
}

.browser-table tr.running {
  background: rgba(16, 185, 129, 0.05);
}

.browser-name {
  font-weight: 600;
  color: #e2e8f0;
}

.table-actions {
  white-space: nowrap;
}

/* 状态徽章 */
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

/* 分页样式 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
  padding: 20px;
  border-top: 1px solid #334155;
}

.page-btn {
  background: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  background: #64748b;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #94a3b8;
  font-size: 14px;
  margin: 0 16px;
}

.page-size-select {
  background: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
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
  max-width: 620px;
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

/* 代理设置样式 */
.proxy-section {
  border: 1px solid #475569;
  border-radius: 8px;
  padding: 16px;
  background: #0f172a;
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #475569;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #667eea;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.proxy-config {
  margin-top: 16px;
}

.proxy-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.proxy-row:last-child {
  margin-bottom: 0;
}

.proxy-protocol {
  width: 100px;
  padding: 10px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 14px;
}

.proxy-protocol:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.proxy-input {
  flex: 2;
  min-width: 200px;
  padding: 10px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b !important;
  color: #e2e8f0 !important;
  font-size: 14px;
  outline: none;
}

.proxy-input::placeholder {
  color: #64748b !important;
}

.proxy-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 1px #3b82f6 !important;
}

.proxy-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.proxy-port {
  width: 120px;
  padding: 10px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 14px;
}

.proxy-port::placeholder {
  color: #64748b;
}

.proxy-port:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.proxy-auth {
  border-top: 1px solid #475569;
  padding-top: 16px;
}

.auth-toggle {
  margin-bottom: 12px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox input {
  width: auto;
}

.auth-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.auth-input {
  padding: 10px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 14px;
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

/* 信息提示区域样式 */
.info-section {
  border: 1px solid #475569;
  border-radius: 8px;
  padding: 16px;
  background: #0f172a;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.info-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}

.info-content {
  flex: 1;
}

.info-content p {
  margin: 0 0 8px 0;
  color: #e2e8f0;
  font-size: 14px;
  line-height: 1.4;
}

.info-content strong {
  color: #67e8f9;
  font-weight: 600;
}

.info-content ul {
  margin: 8px 0 0 0;
  padding-left: 16px;
  color: #94a3b8;
  font-size: 13px;
}

.info-content li {
  margin: 4px 0;
  line-height: 1.3;
}

/* 代理信息样式 */
.proxy-info {
  font-size: 13px;
  color: #e2e8f0;
}

.proxy-info small {
  color: #94a3b8;
  font-size: 11px;
}

.no-proxy {
  color: #6b7280;
  font-style: italic;
}

/* 删除选项样式 */
.delete-options {
  margin-top: 16px;
  padding: 16px;
  background: #0f172a;
  border-radius: 8px;
  border: 1px solid #374151;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 8px;
}

.delete-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #ef4444;
}

.checkbox-label {
  color: #e5e7eb;
  font-size: 14px;
  line-height: 1.4;
}

.option-note {
  margin: 8px 0 0 24px;
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.warning {
  color: #f59e0b !important;
}
</style>