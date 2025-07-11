<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>编辑任务: {{ task?.name }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body" v-if="task">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>任务名称 *</label>
            <input 
              type="text" 
              v-model="form.name" 
              placeholder="输入任务名称"
              required
            />
          </div>

          <div class="form-group">
            <label>任务描述</label>
            <textarea 
              v-model="form.description" 
              placeholder="输入任务描述"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>标签</label>
            <input 
              type="text" 
              v-model="tagsInput" 
              placeholder="输入标签，用逗号分隔"
            />
          </div>

          <div class="form-group">
            <label>任务设置</label>
            <div class="settings-grid">
              <div>
                <label>最大重试次数</label>
                <input 
                  type="number" 
                  v-model.number="form.settings.maxRetries" 
                  min="0"
                  max="10"
                />
              </div>
              <div>
                <label>重试延迟 (ms)</label>
                <input 
                  type="number" 
                  v-model.number="form.settings.retryDelay" 
                  min="0"
                />
              </div>
              <div>
                <label>超时时间 (ms)</label>
                <input 
                  type="number" 
                  v-model.number="form.settings.timeout" 
                  min="1000"
                />
              </div>
              <div>
                <label>
                  <input 
                    type="checkbox" 
                    v-model="form.settings.takeScreenshots"
                  />
                  自动截图
                </label>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>任务动作</label>
            <div class="actions-section">
              <div 
                v-for="(action, index) in form.actions" 
                :key="action.id"
                class="action-item"
              >
                <div class="action-header">
                  <span class="action-index">{{ index + 1 }}</span>
                  <span class="action-type">{{ action.type }}</span>
                  <span class="action-name">{{ action.name }}</span>
                  <div class="action-controls">
                    <button 
                      type="button"
                      class="btn-move"
                      @click="moveAction(index, -1)"
                      :disabled="index === 0"
                    >
                      ↑
                    </button>
                    <button 
                      type="button"
                      class="btn-move"
                      @click="moveAction(index, 1)"
                      :disabled="index === form.actions.length - 1"
                    >
                      ↓
                    </button>
                    <button 
                      type="button"
                      class="btn-remove"
                      @click="removeAction(index)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <ActionEditor 
                  :action="action"
                  @update="updateAction(index, $event)"
                />
              </div>
              
              <div class="action-add-buttons">
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('navigate')"
                >
                  添加导航
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('click')"
                >
                  添加点击
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('input')"
                >
                  添加输入
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('wait')"
                >
                  添加等待
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('extract')"
                >
                  添加提取
                </button>
                <button 
                  type="button" 
                  class="btn btn-outline"
                  @click="addAction('screenshot')"
                >
                  添加截图
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn" @click="$emit('close')">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              保存更改
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { 
  AutomationTask,
  AutomationAction,
  AutomationActionType 
} from '../../../main/types/task'
import ActionEditor from './ActionEditor.vue'

const props = defineProps<{
  task: AutomationTask | null
}>()

const emit = defineEmits(['close', 'updated'])

const form = ref({
  name: '',
  description: '',
  actions: [] as AutomationAction[],
  settings: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    takeScreenshots: false,
    saveResults: true
  },
  tags: [] as string[]
})

const tagsInput = ref('')

const initializeForm = () => {
  if (props.task) {
    form.value = {
      name: props.task.name,
      description: props.task.description || '',
      actions: [...props.task.actions],
      settings: { ...props.task.settings },
      tags: [...props.task.tags]
    }
    tagsInput.value = props.task.tags.join(', ')
  }
}

const addAction = (type: AutomationActionType) => {
  const action: AutomationAction = {
    id: uuidv4(),
    type,
    name: `${type}动作`,
    description: '',
    timeout: 10000,
    retryCount: 0,
    continueOnError: false,
    ...getActionDefaults(type)
  }
  
  form.value.actions.push(action)
}

const getActionDefaults = (type: AutomationActionType) => {
  switch (type) {
    case 'navigate':
      return { url: '', waitForLoad: true }
    case 'click':
      return { selector: '', waitForElement: true, clickCount: 1 }
    case 'input':
      return { selector: '', text: '', clear: true, delay: 0 }
    case 'wait':
      return { waitType: 'time', value: 1000 }
    case 'screenshot':
      return { fullPage: false, filename: '' }
    case 'extract':
      return { selector: '', dataType: 'text', variable: '' }
    default:
      return {}
  }
}

const removeAction = (index: number) => {
  form.value.actions.splice(index, 1)
}

const moveAction = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex >= 0 && newIndex < form.value.actions.length) {
    const temp = form.value.actions[index]
    form.value.actions[index] = form.value.actions[newIndex]
    form.value.actions[newIndex] = temp
  }
}

const updateAction = (index: number, updatedAction: AutomationAction) => {
  form.value.actions[index] = updatedAction
}

const handleSubmit = async () => {
  if (!props.task) return

  try {
    // 处理标签
    if (tagsInput.value) {
      form.value.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean)
    }

    const updateData = {
      name: form.value.name,
      description: form.value.description,
      actions: form.value.actions,
      settings: form.value.settings,
      tags: form.value.tags
    }

    const result = await window.electronAPI.taskEngine.updateTask(props.task.id, updateData)
    emit('updated', result)
  } catch (error) {
    console.error('Failed to update task:', error)
    alert('更新任务失败: ' + error)
  }
}

onMounted(() => {
  initializeForm()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.actions-section {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 16px;
}

.action-item {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  margin-bottom: 12px;
  overflow: hidden;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e5e5e5;
}

.action-index {
  width: 24px;
  height: 24px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.action-type {
  background: #e9ecef;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  text-transform: uppercase;
}

.action-name {
  flex: 1;
  font-weight: 500;
}

.action-controls {
  display: flex;
  gap: 4px;
}

.btn-move {
  background: #6c757d;
  color: white;
  border: none;
  padding: 2px 6px;
  border-radius: 2px;
  font-size: 10px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-move:disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}

.btn-remove {
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.action-add-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-outline {
  background: white;
  color: #007bff;
  border-color: #007bff;
}

.btn-outline:hover {
  background: #007bff;
  color: white;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e5e5;
}
</style>