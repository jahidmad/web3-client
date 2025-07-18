<template>
  <div class="task-manager">
    <!-- 头部区域 -->
    <div class="header">
      <div class="header-left">
        <h2>任务自动化</h2>
        <p class="header-subtitle">上传和管理浏览器自动化任务</p>
      </div>
      <div class="actions">
        <div class="view-switch">
          <button 
            :class="['view-btn', { active: activeTab === 'tasks' }]"
            @click="activeTab = 'tasks'"
          >
            <span class="icon">📋</span>
            我的任务
          </button>
          <button 
            :class="['view-btn', { active: activeTab === 'store' }]"
            @click="activeTab = 'store'"
          >
            <span class="icon">🏪</span>
            任务商店
          </button>
          <button 
            :class="['view-btn', { active: activeTab === 'dependencies' }]"
            @click="activeTab = 'dependencies'"
          >
            <span class="icon">📦</span>
            依赖管理
          </button>
          <button 
            :class="['view-btn', { active: activeTab === 'executions' }]"
            @click="activeTab = 'executions'"
          >
            <span class="icon">⚡</span>
            执行历史
          </button>
        </div>
        <div class="upload-actions">
          <button class="btn-secondary" @click="showImportTask = true">
            <span class="icon">🌐</span>
            从URL导入
          </button>
          <button class="btn-primary" @click="triggerFileUpload">
            <span class="icon">📁</span>
            上传任务文件
          </button>
          <input 
            ref="fileInput" 
            type="file" 
            accept=".json,.js,.yaml,.yml" 
            @change="handleFileUpload" 
            style="display: none;"
          />
        </div>
      </div>
    </div>

    <!-- 浏览器选择 -->
    <div class="browser-selector">
      <div class="selector-label">
        <span class="icon">🌐</span>
        执行浏览器:
      </div>
      <select v-model="selectedBrowser" class="browser-select">
        <option value="">请选择浏览器</option>
        <option 
          v-for="browser in browsers" 
          :key="browser.id"
          :value="browser.id"
        >
          {{ browser.name }} ({{ getBrowserStatusText(browser.status) }})
        </option>
      </select>
    </div>

    <!-- 任务列表 -->
    <div v-if="activeTab === 'tasks'" class="content-section">
      <div class="section-header">
        <div class="search-filters">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="搜索任务..." 
              v-model="taskSearchQuery"
              class="search-input"
            />
          </div>
          <select v-model="taskCategoryFilter" class="filter-select">
            <option value="">所有分类</option>
            <option value="web-scraping">网页抓取</option>
            <option value="automation">自动化</option>
            <option value="testing">测试</option>
            <option value="monitoring">监控</option>
            <option value="other">其他</option>
          </select>
          <select v-model="taskStatusFilter" class="filter-select">
            <option value="">所有状态</option>
            <option value="active">活跃</option>
            <option value="disabled">禁用</option>
          </select>
        </div>
      </div>

      <div class="tasks-grid">
        <div 
          v-for="task in filteredTasks" 
          :key="task.id"
          class="task-card"
        >
          <div class="task-header">
            <div class="task-info">
              <div class="task-title-row">
                <img 
                  v-if="task.metadata.logoUrl" 
                  :src="task.metadata.logoUrl" 
                  class="task-logo" 
                  :alt="task.metadata.name"
                />
                <div class="task-logo-fallback" v-else>
                  {{ task.metadata.name.charAt(0).toUpperCase() }}
                </div>
                <div class="task-name-info">
                  <h3 class="task-name">{{ task.metadata.name }}</h3>
                  <p class="task-author">作者: {{ task.metadata.author }}</p>
                </div>
              </div>
              <p class="task-description">{{ task.metadata.description || '暂无描述' }}</p>
            </div>
            <div class="task-status">
              <span :class="['status-badge', task.status]">{{ getTaskStatusText(task.status) }}</span>
            </div>
          </div>
          
          <div class="task-details">
            <div class="task-meta">
              <span class="meta-item">
                <span class="icon">📦</span>
                {{ task.metadata.version }}
              </span>
              <span class="meta-item">
                <span class="icon">🏷️</span>
                {{ task.metadata.category }}
              </span>
              <span class="meta-item">
                <span class="icon">📅</span>
                {{ formatDate(task.addedAt) }}
              </span>
              <span class="meta-item" v-if="task.lastUsed">
                <span class="icon">⚡</span>
                {{ task.usageCount }} 次使用
              </span>
            </div>
            <div class="task-tags" v-if="task.metadata.tags && task.metadata.tags.length > 0">
              <span v-for="tag in task.metadata.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="task-actions">
            <button 
              class="btn-success btn-sm"
              @click="showExecuteTask(task)"
              :disabled="!selectedBrowser"
              title="执行任务"
            >
              <span class="icon">▶️</span>
              执行
            </button>
            <button 
              class="btn-secondary btn-sm"
              @click="viewTaskDetails(task)"
              title="查看详情"
            >
              <span class="icon">👁️</span>
              详情
            </button>
            <button 
              class="btn-danger btn-sm"
              @click="deleteTask(task.id)"
              title="删除任务"
            >
              <span class="icon">🗑️</span>
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredTasks.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>暂无任务</h3>
        <p>还没有上传任何自动化任务，点击上方"上传任务"按钮开始。</p>
        <div class="empty-actions">
          <button class="btn-primary btn-large" @click="triggerFileUpload">
            <span class="icon">📁</span>
            上传第一个任务
          </button>
        </div>
      </div>
    </div>

    <!-- 任务商店 -->
    <div v-if="activeTab === 'store'" class="content-section">
      <TaskStore />
    </div>

    <!-- 依赖管理 -->
    <div v-if="activeTab === 'dependencies'" class="content-section">
      <div class="section-header">
        <h3>依赖管理</h3>
        <div class="dependency-actions">
          <button class="btn-secondary" @click="loadDependencySummary">
            <span class="icon">🔄</span>
            刷新状态
          </button>
          <button class="btn-danger" @click="cleanupAllDependencies">
            <span class="icon">🧹</span>
            清理所有依赖
          </button>
        </div>
      </div>

      <!-- 依赖概览 -->
      <div class="dependency-summary" v-if="dependencySummary">
        <div class="summary-cards">
          <div class="summary-card">
            <div class="card-icon">📦</div>
            <div class="card-content">
              <div class="card-title">总任务数</div>
              <div class="card-value">{{ dependencySummary.totalTasks }}</div>
            </div>
          </div>
          <div class="summary-card">
            <div class="card-icon">🔗</div>
            <div class="card-content">
              <div class="card-title">有依赖的任务</div>
              <div class="card-value">{{ dependencySummary.tasksWithDependencies }}</div>
            </div>
          </div>
          <div class="summary-card success">
            <div class="card-icon">✅</div>
            <div class="card-content">
              <div class="card-title">依赖满足</div>
              <div class="card-value">{{ dependencySummary.satisfiedTasks }}</div>
            </div>
          </div>
          <div class="summary-card warning">
            <div class="card-icon">⚠️</div>
            <div class="card-content">
              <div class="card-title">依赖缺失</div>
              <div class="card-value">{{ dependencySummary.unsatisfiedTasks }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务依赖详情 -->
      <div class="tasks-dependencies">
        <div 
          v-for="task in tasksWithDependencies" 
          :key="task.id"
          class="task-dependency-card"
        >
          <div class="task-header">
            <div class="task-info">
              <h4>{{ task.metadata.name }}</h4>
              <p class="task-version">v{{ task.metadata.version }}</p>
            </div>
            <div class="dependency-status">
              <span 
                :class="['status-badge', task.dependencyStatus?.satisfied ? 'success' : 'warning']"
              >
                {{ task.dependencyStatus?.satisfied ? '✅ 已满足' : '⚠️ 未满足' }}
              </span>
            </div>
          </div>
          
          <div class="dependencies-list" v-if="task.metadata.dependencies">
            <h5>依赖列表：</h5>
            <div class="dependency-items">
              <div 
                v-for="dep in task.metadata.dependencies" 
                :key="dep.name"
                class="dependency-item"
              >
                <div class="dep-info">
                  <span class="dep-name">{{ dep.name }}</span>
                  <span class="dep-version">{{ dep.version }}</span>
                  <span class="dep-type">{{ dep.type }}</span>
                </div>
                <div class="dep-status">
                  <span 
                    :class="['dep-status-badge', getDependencyStatus(task, dep.name)]"
                  >
                    {{ getDependencyStatusText(task, dep.name) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="task-actions" v-if="task.dependencyStatus && !task.dependencyStatus.satisfied">
            <button 
              class="btn-primary"
              @click="installTaskDependencies(task.id)"
              :disabled="installingDependencies.has(task.id)"
            >
              <span class="icon">📦</span>
              {{ installingDependencies.has(task.id) ? '安装中...' : '安装依赖' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行历史 -->
    <div v-if="activeTab === 'executions'" class="content-section">
      <div class="section-header">
        <div class="search-filters">
          <select v-model="executionStatusFilter" class="filter-select">
            <option value="">所有状态</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="running">运行中</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      <div class="executions-list">
        <div 
          v-for="execution in filteredExecutions" 
          :key="execution.id"
          class="execution-card"
        >
          <div class="execution-header">
            <div class="execution-info">
              <h4 class="execution-task">{{ getTaskName(execution.taskId) }}</h4>
              <div class="execution-meta">
                <span class="meta-item">
                  <span class="icon">📅</span>
                  {{ formatDate(execution.startTime) }}
                </span>
                <span v-if="execution.endTime" class="meta-item">
                  <span class="icon">⏱️</span>
                  {{ getDuration(execution.startTime, execution.endTime) }}
                </span>
              </div>
            </div>
            <div class="execution-status">
              <span :class="['status-badge', execution.status]">{{ getExecutionStatusText(execution.status) }}</span>
            </div>
          </div>
          
          <div class="execution-progress" v-if="execution.progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: execution.progress.percentage + '%' }"
              ></div>
            </div>
            <span class="progress-text">{{ execution.progress.completed }} / {{ execution.progress.total }}</span>
          </div>
          
          <div v-if="execution.error" class="execution-error">
            <span class="icon">⚠️</span>
            {{ execution.error }}
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredExecutions.length === 0" class="empty-state">
        <div class="empty-icon">⚡</div>
        <h3>暂无执行记录</h3>
        <p>还没有任务执行记录，执行任务后这里会显示历史记录。</p>
      </div>
    </div>


    <!-- 导入任务模态框 -->
    <ImportTaskModal 
      v-if="showImportTask"
      @close="showImportTask = false"
      @imported="handleTaskImported"
    />

    <!-- 执行任务模态框 -->
    <ExecuteTaskModal 
      v-if="showExecuteTaskModal"
      :task="executingTask"
      :browsers="browsers"
      @close="showExecuteTaskModal = false"
      @executed="handleTaskExecuted"
    />

    <!-- 任务详情模态框 -->
    <TaskDetailsModal 
      v-if="showTaskDetails"
      :task="selectedTask"
      @close="showTaskDetails = false"
      @install="handleDependencyInstall"
    />

    <!-- 删除确认模态框 -->
    <ConfirmDeleteModal 
      v-if="showConfirmDelete"
      :task-name="taskToDelete?.metadata.name"
      @confirm="confirmDeleteTask"
      @cancel="cancelDeleteTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { 
  LocalTask, 
  TaskExecution
} from '../../main/types/task'
import type { Browser } from '../../main/types/browser'
import ImportTaskModal from './modals/ImportTaskModal.vue'
import ExecuteTaskModal from './modals/ExecuteTaskModal.vue'
import TaskDetailsModal from './modals/TaskDetailsModal.vue'
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.vue'
import TaskStore from './TaskStore.vue'

// 响应式数据
const activeTab = ref<'tasks' | 'store' | 'dependencies' | 'executions'>('tasks')
const tasks = ref<LocalTask[]>([])
const executions = ref<TaskExecution[]>([])
const browsers = ref<Browser[]>([])
const selectedBrowser = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)

// 依赖管理相关状态
const dependencySummary = ref<any>(null)
const installingDependencies = ref<Set<string>>(new Set())

// 过滤条件
const taskSearchQuery = ref('')
const taskCategoryFilter = ref('')
const taskStatusFilter = ref('')
const executionStatusFilter = ref('')

// 模态框状态
const showImportTask = ref(false)
const showExecuteTaskModal = ref(false)
const showTaskDetails = ref(false)
const showConfirmDelete = ref(false)
const executingTask = ref<LocalTask | null>(null)
const selectedTask = ref<LocalTask | null>(null)
const taskToDelete = ref<LocalTask | null>(null)

// 计算属性
const filteredTasks = computed(() => {
  let filtered = tasks.value

  if (taskSearchQuery.value) {
    const query = taskSearchQuery.value.toLowerCase()
    filtered = filtered.filter(task => 
      task.metadata.name.toLowerCase().includes(query) ||
      task.metadata.description.toLowerCase().includes(query)
    )
  }

  if (taskCategoryFilter.value) {
    filtered = filtered.filter(task => task.metadata.category === taskCategoryFilter.value)
  }

  if (taskStatusFilter.value) {
    filtered = filtered.filter(task => task.status === taskStatusFilter.value)
  }

  return filtered
})

const tasksWithDependencies = computed(() => {
  return tasks.value.filter(task => 
    task.metadata.dependencies && task.metadata.dependencies.length > 0
  )
})

const filteredExecutions = computed(() => {
  let filtered = executions.value

  if (executionStatusFilter.value) {
    filtered = filtered.filter(execution => 
      execution.status === executionStatusFilter.value
    )
  }

  return filtered.sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
})

// 方法
const loadTasks = async () => {
  try {
    const result = await window.electronAPI.taskManager.getTasks()
    tasks.value = result || []
  } catch (error) {
    console.error('Failed to load tasks:', error)
  }
}

const loadExecutions = async () => {
  try {
    const result = await window.electronAPI.taskManager.getAllExecutions()
    executions.value = result || []
  } catch (error) {
    console.error('Failed to load executions:', error)
  }
}

const loadBrowsers = async () => {
  try {
    const result = await window.electronAPI.browser.getBrowsers()
    browsers.value = result || []
    // 自动选择浏览器：优先选择正在运行的，否则选择第一个可用的
    if (!selectedBrowser.value && browsers.value.length > 0) {
      const runningBrowser = browsers.value.find(b => b.status === 'running')
      if (runningBrowser) {
        selectedBrowser.value = runningBrowser.id
      } else {
        // 如果没有正在运行的浏览器，选择第一个可用的浏览器
        selectedBrowser.value = browsers.value[0].id
      }
    }
  } catch (error) {
    console.error('Failed to load browsers:', error)
  }
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return
  
  try {
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const fileContent = new Uint8Array(arrayBuffer)
    
    const result = await window.electronAPI.taskManager.uploadTask({
      file: fileContent,
      filename: file.name
    })
    
    await loadTasks()
    console.log('Task uploaded successfully:', result)
  } catch (error) {
    console.error('Failed to upload task:', error)
    alert('上传任务失败: ' + error)
  }
  
  // 重置文件输入
  if (target) {
    target.value = ''
  }
}

const showExecuteTask = (task: LocalTask) => {
  executingTask.value = task
  showExecuteTaskModal.value = true
}

const viewTaskDetails = (task: LocalTask) => {
  selectedTask.value = task
  showTaskDetails.value = true
}

const deleteTask = (taskId: string) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    taskToDelete.value = task
    showConfirmDelete.value = true
  }
}

const confirmDeleteTask = async () => {
  if (!taskToDelete.value) return

  try {
    await window.electronAPI.taskManager.deleteTask(taskToDelete.value.id)
    await loadTasks()
    showConfirmDelete.value = false
    taskToDelete.value = null
  } catch (error) {
    console.error('Failed to delete task:', error)
    alert('删除任务失败: ' + error)
  }
}

const cancelDeleteTask = () => {
  showConfirmDelete.value = false
  taskToDelete.value = null
}

const handleTaskImported = async () => {
  await loadTasks()
  showImportTask.value = false
}

const handleTaskExecuted = async () => {
  await loadExecutions()
  showExecuteTaskModal.value = false
  executingTask.value = null
  // 切换到执行历史页面
  activeTab.value = 'executions'
}

const handleDependencyInstall = async (task: LocalTask) => {
  // Refresh task data after dependency installation
  await loadTasks()
  await loadDependencySummary()
}

// 依赖管理相关方法
const loadDependencySummary = async () => {
  try {
    dependencySummary.value = await window.electronAPI.taskManager.getDependencySummary()
  } catch (error) {
    console.error('Failed to load dependency summary:', error)
  }
}

const installTaskDependencies = async (taskId: string) => {
  try {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task?.metadata.dependencies) {
      return
    }

    installingDependencies.value.add(taskId)
    
    const result = await window.electronAPI.taskManager.installDependencies({
      taskId,
      dependencies: task.metadata.dependencies
    })
    
    if (result.success) {
      // 重新加载任务和依赖摘要
      await loadTasks()
      await loadDependencySummary()
    }
  } catch (error) {
    console.error('Failed to install dependencies:', error)
  } finally {
    installingDependencies.value.delete(taskId)
  }
}

const cleanupAllDependencies = async () => {
  if (!confirm('确定要清理所有任务依赖吗？这将删除所有已安装的依赖包。')) {
    return
  }
  
  try {
    await window.electronAPI.taskManager.cleanupDependencies()
    await loadTasks()
    await loadDependencySummary()
  } catch (error) {
    console.error('Failed to cleanup dependencies:', error)
  }
}

const getDependencyStatus = (task: any, depName: string): string => {
  if (!task.dependencyStatus) return 'unknown'
  
  const depStatus = task.dependencyStatus.dependencies.find((d: any) => d.name === depName)
  if (!depStatus) return 'unknown'
  
  if (depStatus.installed && depStatus.compatible) return 'success'
  if (depStatus.installed && !depStatus.compatible) return 'warning'
  return 'error'
}

const getDependencyStatusText = (task: any, depName: string): string => {
  const status = getDependencyStatus(task, depName)
  const statusMap = {
    success: '✅ 已安装',
    warning: '⚠️ 版本不兼容',
    error: '❌ 未安装',
    unknown: '❓ 未知'
  }
  return statusMap[status] || '❓ 未知'
}

const getTaskName = (taskId: string): string => {
  const task = tasks.value.find(t => t.id === taskId)
  return task?.metadata.name || 'Unknown Task'
}

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleString('zh-CN')
}

const getBrowserStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    error: '错误'
  }
  return statusMap[status] || status
}

const getTaskStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: '活跃',
    disabled: '禁用'
  }
  return statusMap[status] || status
}

const getExecutionStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}


const getDuration = (start: Date | string, end: Date | string): string => {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  const duration = endTime - startTime
  
  if (duration < 1000) {
    return `${duration}ms`
  } else if (duration < 60000) {
    return `${Math.round(duration / 1000)}s`
  } else {
    return `${Math.round(duration / 60000)}m`
  }
}

// 生命周期
onMounted(() => {
  loadTasks()
  loadExecutions()
  loadBrowsers()
  loadDependencySummary()
})
</script>

<style scoped>
/* 基础样式 - 继承项目风格 */
.task-manager {
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
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
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
  font-size: 12px;
}

/* 按钮样式 - 继承项目风格 */
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
  gap: 6px;
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
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  display: flex;
  align-items: center;
  gap: 4px;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-sm {
  padding: 6px 10px !important;
  font-size: 11px !important;
  margin-right: 4px;
  min-width: 60px;
  justify-content: center;
}

.btn-large {
  padding: 14px 24px;
  font-size: 16px;
}

.btn-primary:disabled,
.btn-secondary:disabled,
.btn-success:disabled,
.btn-warning:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 浏览器选择器 */
.browser-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background-color: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
}

.selector-label {
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.browser-select {
  background-color: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  min-width: 200px;
  cursor: pointer;
}

.browser-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

/* 内容区域 */
.content-section {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 20px;
}

.search-filters {
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: #94a3b8;
}

.search-input {
  background-color: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px 8px 36px;
  font-size: 14px;
  min-width: 300px;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.filter-select {
  background-color: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
}

/* 任务卡片网格 */
.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
}

/* 任务标题行 */
.task-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.task-logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #334155;
}

.task-logo-fallback {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.task-name-info {
  flex: 1;
  min-width: 0;
}

.task-author {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

/* 上传操作按钮 */
.upload-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.task-card, .execution-card, .schedule-card {
  background: #1e293b;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;
  transition: all 0.2s ease;
}

.task-card:hover, .execution-card:hover, .schedule-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.task-header, .execution-header, .schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.task-info, .execution-info, .schedule-info {
  flex: 1;
}

.task-name, .execution-task, .schedule-task {
  margin: 0 0 6px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.task-description {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.4;
}

.task-status, .execution-status, .schedule-status {
  margin-left: 12px;
}

/* 状态徽章 */
.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-badge.paused {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.status-badge.draft {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.status-badge.completed {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.status-badge.running {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  animation: pulse 2s infinite;
}

.status-badge.pending {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.status-badge.cancelled {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

/* 任务详情 */
.task-details {
  margin-bottom: 16px;
}

.task-meta, .execution-meta, .schedule-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.task-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

/* 任务操作按钮 */
.task-actions, .schedule-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 执行列表 */
.executions-list, .schedules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 进度条 */
.execution-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #94a3b8;
  min-width: 60px;
  text-align: right;
}

/* 执行错误 */
.execution-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 空状态 */
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

/* 动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 依赖管理样式 */
.dependency-actions {
  display: flex;
  gap: 12px;
}

.dependency-summary {
  margin-bottom: 24px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s ease;
}

.summary-card:hover {
  border-color: #64748b;
  transform: translateY(-2px);
}

.summary-card.success {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.summary-card.warning {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.card-icon {
  font-size: 24px;
  opacity: 0.8;
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.card-value {
  font-size: 24px;
  font-weight: 600;
  color: #f8fafc;
}

.tasks-dependencies {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-dependency-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.2s ease;
}

.task-dependency-card:hover {
  border-color: #64748b;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.task-info h4 {
  margin: 0;
  color: #f8fafc;
  font-size: 16px;
}

.task-version {
  margin: 4px 0 0 0;
  color: #94a3b8;
  font-size: 12px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.dependencies-list h5 {
  margin: 0 0 12px 0;
  color: #f8fafc;
  font-size: 14px;
}

.dependency-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dependency-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border-radius: 4px;
  border: 1px solid #334155;
}

.dep-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dep-name {
  font-weight: 500;
  color: #f8fafc;
}

.dep-version {
  color: #94a3b8;
  font-size: 12px;
}

.dep-type {
  background: #374151;
  color: #d1d5db;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  text-transform: uppercase;
}

.dep-status-badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
}

.dep-status-badge.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.dep-status-badge.warning {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.dep-status-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.dep-status-badge.unknown {
  background: rgba(107, 114, 128, 0.2);
  color: #94a3b8;
}

.task-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .task-manager {
    padding: 16px;
  }
  
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .view-switch {
    margin-right: 0;
  }
  
  .tasks-grid {
    grid-template-columns: 1fr;
  }
  
  .search-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input {
    min-width: auto;
    width: 100%;
  }
  
  .browser-selector {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .browser-select {
    width: 100%;
    min-width: auto;
  }
}
</style>