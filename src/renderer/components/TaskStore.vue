<template>
  <div class="task-store">
    <!-- 商店头部 -->
    <div class="store-header">
      <div class="store-title">
        <span class="icon">🏪</span>
        <h2>任务商店</h2>
        <span class="beta-badge">Beta</span>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-section">
        <div class="search-bar">
          <input 
            v-model="searchQuery"
            @input="debouncedSearch"
            placeholder="搜索任务插件..."
            class="search-input"
          />
          <button @click="searchTasks" class="search-btn">
            <span class="icon">🔍</span>
          </button>
        </div>
        
        <!-- 筛选器 -->
        <div class="filters">
          <select v-model="selectedCategory" @change="searchTasks" class="filter-select">
            <option value="">所有分类</option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
          
          <select v-model="sortBy" @change="searchTasks" class="filter-select">
            <option value="downloads">下载量</option>
            <option value="rating">评分</option>
            <option value="updated">更新时间</option>
            <option value="name">名称</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 商店统计 -->
    <div class="store-stats" v-if="storeStats">
      <div class="stat-item">
        <span class="stat-number">{{ storeStats.totalTasks }}</span>
        <span class="stat-label">可用任务</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ formatNumber(storeStats.totalDownloads) }}</span>
        <span class="stat-label">总下载量</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ storeStats.categories.length }}</span>
        <span class="stat-label">分类</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在加载任务...</p>
    </div>

    <!-- 任务列表 -->
    <div v-else class="tasks-grid">
      <div v-for="task in tasks" :key="task.id" class="task-card">
        <div class="task-header">
          <div class="task-icon">
            <span class="icon">⚡</span>
          </div>
          <div class="task-info">
            <h3 class="task-name">{{ task.displayName }}</h3>
            <p class="task-publisher">{{ task.publisher }}</p>
          </div>
          <div class="task-verified" v-if="task.isVerified">
            <span class="icon" title="已验证">✅</span>
          </div>
        </div>

        <p class="task-description">{{ task.description }}</p>

        <div class="task-tags">
          <span v-for="category in task.categories.slice(0, 2)" :key="category" class="tag">
            {{ category }}
          </span>
        </div>

        <div class="task-stats">
          <div class="stat">
            <span class="icon">⭐</span>
            <span>{{ task.rating ? task.rating.toFixed(1) : 'N/A' }}</span>
            <span class="count">({{ task.reviewCount }})</span>
          </div>
          <div class="stat">
            <span class="icon">📥</span>
            <span>{{ formatNumber(task.downloadCount) }}</span>
          </div>
          <div class="stat">
            <span class="version">v{{ task.version }}</span>
          </div>
        </div>

        <div class="task-actions">
          <button 
            v-if="!task.isInstalled"
            @click="installTask(task)"
            :disabled="installingTasks.has(task.taskId)"
            class="btn-primary btn-sm"
          >
            <span class="icon">📥</span>
            {{ installingTasks.has(task.taskId) ? '安装中...' : '安装' }}
          </button>
          
          <button 
            v-else
            @click="uninstallTask(task)"
            class="btn-secondary btn-sm"
          >
            <span class="icon">🗑️</span>
            已安装
          </button>
          
          <button @click="viewTaskDetails(task)" class="btn-outline btn-sm">
            <span class="icon">👁️</span>
            详情
          </button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button 
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage <= 1"
        class="btn-secondary btn-sm"
      >
        上一页
      </button>
      
      <span class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页
      </span>
      
      <button 
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage >= totalPages"
        class="btn-secondary btn-sm"
      >
        下一页
      </button>
    </div>

    <!-- 任务详情模态框 -->
    <TaskDetailsModal 
      v-if="showTaskDetails"
      :task="selectedTask"
      @close="showTaskDetails = false"
      @install="installTask"
      @uninstall="uninstallTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { debounce } from 'lodash-es'
import TaskDetailsModal from './modals/TaskDetailsModal.vue'

interface TaskStoreItem {
  id: string
  taskId: string
  name: string
  displayName: string
  description: string
  publisher: string
  version: string
  categories: string[]
  downloadCount: number
  rating?: number
  reviewCount: number
  isInstalled: boolean
  isVerified: boolean
}

interface StoreStats {
  totalTasks: number
  totalDownloads: number
  categories: Array<{ name: string; count: number }>
}

const searchQuery = ref('')
const selectedCategory = ref('')
const sortBy = ref('downloads')
const currentPage = ref(1)
const loading = ref(false)

const tasks = ref<TaskStoreItem[]>([])
const totalPages = ref(1)
const storeStats = ref<StoreStats | null>(null)
const installingTasks = ref(new Set<string>())

const showTaskDetails = ref(false)
const selectedTask = ref<TaskStoreItem | null>(null)

const categories = computed(() => {
  if (!storeStats.value) return []
  return storeStats.value.categories.slice(0, 10).map(c => c.name)
})

const debouncedSearch = debounce(() => {
  currentPage.value = 1
  searchTasks()
}, 300)

const searchTasks = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.taskStore.searchTasks({
      query: searchQuery.value,
      category: selectedCategory.value,
      sortBy: sortBy.value,
      sortOrder: 'desc',
      page: currentPage.value,
      limit: 12
    })
    
    tasks.value = result.tasks
    totalPages.value = result.totalPages
  } catch (error) {
    console.error('Failed to search tasks:', error)
  } finally {
    loading.value = false
  }
}

const installTask = async (task: TaskStoreItem) => {
  if (installingTasks.value.has(task.taskId)) return
  
  installingTasks.value.add(task.taskId)
  try {
    await window.electronAPI.taskStore.installTask({
      taskId: task.taskId,
      version: task.version
    })
    
    task.isInstalled = true
    console.log(`Task installed: ${task.displayName}`)
  } catch (error) {
    console.error('Failed to install task:', error)
    alert(`安装失败: ${error}`)
  } finally {
    installingTasks.value.delete(task.taskId)
  }
}

const uninstallTask = async (task: TaskStoreItem) => {
  if (confirm(`确定要卸载 "${task.displayName}" 吗？`)) {
    try {
      await window.electronAPI.taskStore.uninstallTask(task.taskId)
      task.isInstalled = false
      console.log(`Task uninstalled: ${task.displayName}`)
    } catch (error) {
      console.error('Failed to uninstall task:', error)
      alert(`卸载失败: ${error}`)
    }
  }
}

const viewTaskDetails = (task: TaskStoreItem) => {
  selectedTask.value = task
  showTaskDetails.value = true
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    searchTasks()
  }
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const loadStoreStats = async () => {
  try {
    storeStats.value = await window.electronAPI.taskStore.getStoreStats()
  } catch (error) {
    console.error('Failed to load store stats:', error)
  }
}

onMounted(() => {
  loadStoreStats()
  searchTasks()
})
</script>

<style scoped>
.task-store {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.store-header {
  margin-bottom: 32px;
}

.store-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.store-title h2 {
  margin: 0;
  color: #e2e8f0;
  font-size: 28px;
  font-weight: 600;
}

.beta-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-bar {
  display: flex;
  gap: 8px;
  max-width: 500px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #475569;
  border-radius: 8px;
  background-color: #0f172a;
  color: #e2e8f0;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-btn {
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.filters {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  background-color: #0f172a;
  color: #e2e8f0;
  font-size: 14px;
}

.store-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
  padding: 20px;
  background: #0f172a;
  border-radius: 12px;
  border: 1px solid #334155;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #667eea;
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #334155;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.task-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
}

.task-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.task-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.task-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.task-info {
  flex: 1;
}

.task-name {
  margin: 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.task-publisher {
  margin: 2px 0 0 0;
  color: #94a3b8;
  font-size: 12px;
}

.task-description {
  color: #cbd5e1;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-tags {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.task-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 0;
  border-top: 1px solid #334155;
  border-bottom: 1px solid #334155;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.count {
  color: #64748b;
}

.version {
  background: #334155;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.btn-outline {
  background: transparent;
  color: #94a3b8;
  border: 1px solid #475569;
}

.btn-outline:hover {
  background: #475569;
  color: #e2e8f0;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-info {
  color: #94a3b8;
  font-size: 14px;
}
</style>