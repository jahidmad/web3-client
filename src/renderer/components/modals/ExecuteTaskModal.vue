<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <i class="modal-icon">▶️</i>
          <h3>执行任务 - {{ task.metadata.name }}</h3>
        </div>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="task-info">
          <div class="task-header">
            <img 
              v-if="task.metadata.logoUrl" 
              :src="task.metadata.logoUrl" 
              class="task-logo" 
              :alt="task.metadata.name"
            />
            <div class="task-logo-fallback" v-else>
              {{ task.metadata.name.charAt(0).toUpperCase() }}
            </div>
            <div class="task-details">
              <h4>{{ task.metadata.name }}</h4>
              <p class="task-description">{{ task.metadata.description }}</p>
              <p class="task-author">作者: {{ task.metadata.author }}</p>
            </div>
          </div>
        </div>

        <form @submit.prevent="executeTask" class="execute-form">
          <div class="form-group">
            <label for="browserId">选择浏览器</label>
            <select 
              id="browserId"
              v-model="selectedBrowser" 
              required
              class="browser-select"
            >
              <option value="">请选择浏览器</option>
              <option 
                v-for="browser in runningBrowsers" 
                :key="browser.id"
                :value="browser.id"
              >
                {{ browser.name }} ({{ getBrowserStatusText(browser.status) }})
              </option>
            </select>
            <p class="form-hint" v-if="runningBrowsers.length === 0">
              没有正在运行的浏览器，请先启动浏览器
            </p>
          </div>

          <!-- 任务参数 -->
          <div v-if="task.parameters && task.parameters.length > 0" class="parameters-section">
            <h4>任务参数</h4>
            <div class="parameters-grid">
              <div 
                v-for="param in task.parameters" 
                :key="param.name"
                class="param-group"
              >
                <label :for="param.name">
                  {{ param.label }}
                  <span v-if="param.required" class="required">*</span>
                </label>
                <p v-if="param.description" class="param-description">
                  {{ param.description }}
                </p>
                
                <!-- 字符串输入 -->
                <input 
                  v-if="param.type === 'string' || param.type === 'url' || param.type === 'email'"
                  :id="param.name"
                  v-model="parameters[param.name]"
                  :type="param.type === 'email' ? 'email' : param.type === 'url' ? 'url' : 'text'"
                  :required="param.required"
                  :placeholder="param.defaultValue"
                  class="param-input"
                />
                
                <!-- 数字输入 -->
                <input 
                  v-else-if="param.type === 'number'"
                  :id="param.name"
                  v-model.number="parameters[param.name]"
                  type="number"
                  :required="param.required"
                  :min="param.validation?.min"
                  :max="param.validation?.max"
                  :placeholder="param.defaultValue"
                  class="param-input"
                />
                
                <!-- 布尔值 -->
                <label v-else-if="param.type === 'boolean'" class="checkbox-label">
                  <input 
                    :id="param.name"
                    v-model="parameters[param.name]"
                    type="checkbox"
                    class="param-checkbox"
                  />
                  <span>{{ param.label }}</span>
                </label>
                
                <!-- 选择框 -->
                <select 
                  v-else-if="param.type === 'select'"
                  :id="param.name"
                  v-model="parameters[param.name]"
                  :required="param.required"
                  class="param-select"
                >
                  <option value="">请选择</option>
                  <option 
                    v-for="option in param.options" 
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                
                <!-- 多选框 -->
                <div 
                  v-else-if="param.type === 'multiselect'"
                  class="multiselect-container"
                >
                  <div 
                    v-for="option in param.options" 
                    :key="option.value"
                    class="multiselect-option"
                  >
                    <label class="checkbox-label">
                      <input 
                        type="checkbox"
                        :value="option.value"
                        v-model="parameters[param.name]"
                        class="param-checkbox"
                      />
                      <span>{{ option.label }}</span>
                    </label>
                  </div>
                </div>
                
                <!-- 文本域 -->
                <textarea 
                  v-else-if="param.type === 'textarea'"
                  :id="param.name"
                  v-model="parameters[param.name]"
                  :required="param.required"
                  :placeholder="param.defaultValue"
                  class="param-textarea"
                  rows="3"
                />
                
                <!-- 密码 -->
                <input 
                  v-else-if="param.type === 'password'"
                  :id="param.name"
                  v-model="parameters[param.name]"
                  type="password"
                  :required="param.required"
                  :placeholder="param.defaultValue"
                  class="param-input"
                />
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="$emit('close')" class="btn-secondary">
              取消
            </button>
            <button 
              type="submit" 
              class="btn-primary" 
              :disabled="executing || !selectedBrowser"
            >
              {{ executing ? '执行中...' : '开始执行' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { LocalTask, Browser } from '../../../main/types/task'

const props = defineProps<{
  task: LocalTask
  browsers: Browser[]
}>()

const emit = defineEmits<{
  close: []
  executed: []
}>()

const selectedBrowser = ref('')
const executing = ref(false)
const parameters = ref<Record<string, any>>({})

const runningBrowsers = computed(() => {
  return props.browsers.filter(browser => browser.status === 'running')
})

const getBrowserStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    error: '错误'
  }
  return statusMap[status] || status
}

const executeTask = async () => {
  if (!selectedBrowser.value) {
    alert('请选择浏览器')
    return
  }

  executing.value = true
  try {
    // 清理参数，确保可序列化
    const cleanParams = JSON.parse(JSON.stringify(parameters.value))
    
    const result = await window.electronAPI.taskManager.executeTask({
      taskId: props.task.id,
      browserId: selectedBrowser.value,
      parameters: cleanParams,
      debug: false
    })
    
    console.log('Task executed successfully:', result)
    emit('executed')
  } catch (error) {
    console.error('Failed to execute task:', error)
    alert('执行任务失败: ' + error)
  } finally {
    executing.value = false
  }
}

onMounted(() => {
  // 自动选择第一个运行中的浏览器
  if (runningBrowsers.value.length > 0) {
    selectedBrowser.value = runningBrowsers.value[0].id
  }
  
  // 初始化参数默认值
  if (props.task.parameters) {
    props.task.parameters.forEach(param => {
      if (param.type === 'multiselect') {
        // 初始化多选参数为空数组或默认值数组
        parameters.value[param.name] = param.default || []
      } else if (param.default !== undefined) {
        parameters.value[param.name] = param.default
      } else if (param.defaultValue !== undefined) {
        // 兼容旧的 defaultValue 字段
        parameters.value[param.name] = param.defaultValue
      }
    })
  }
})
</script>

<style scoped>
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
  max-width: 600px;
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

.modal-body {
  padding: 24px;
}

.task-info {
  margin-bottom: 24px;
  padding: 16px;
  background: #0f172a;
  border-radius: 8px;
  border: 1px solid #334155;
}

.task-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #334155;
}

.task-logo-fallback {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 18px;
}

.task-details {
  flex: 1;
}

.task-details h4 {
  margin: 0 0 4px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.task-description {
  margin: 0 0 4px 0;
  color: #94a3b8;
  font-size: 14px;
}

.task-author {
  margin: 0;
  color: #64748b;
  font-size: 12px;
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

.required {
  color: #ef4444;
  margin-left: 2px;
}

.browser-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #475569;
  border-radius: 8px;
  font-size: 14px;
  background-color: #0f172a;
  color: #e2e8f0;
  transition: all 0.2s ease;
}

.browser-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.parameters-section {
  margin-bottom: 24px;
}

.parameters-section h4 {
  margin: 0 0 16px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.parameters-grid {
  display: grid;
  gap: 16px;
}

.param-group {
  display: flex;
  flex-direction: column;
}

.param-description {
  margin: 4px 0 8px 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.param-input,
.param-select,
.param-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #475569;
  border-radius: 6px;
  font-size: 14px;
  background-color: #0f172a;
  color: #e2e8f0;
  transition: all 0.2s ease;
}

.param-input:focus,
.param-select:focus,
.param-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.param-input::placeholder,
.param-textarea::placeholder {
  color: #64748b;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.param-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #334155;
}

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
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
}

.btn-secondary:hover:not(:disabled) {
  background-color: #64748b;
  border-color: #94a3b8;
}

.multiselect-container {
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 8px;
  background-color: #0f172a;
  max-height: 200px;
  overflow-y: auto;
}

.multiselect-option {
  padding: 4px 0;
}

.multiselect-option:not(:last-child) {
  border-bottom: 1px solid #334155;
  padding-bottom: 8px;
  margin-bottom: 4px;
}
</style>