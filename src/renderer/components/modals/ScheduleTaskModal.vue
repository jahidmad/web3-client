<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>调度任务: {{ taskName }}</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>选择浏览器 *</label>
            <select v-model="form.browserId" required>
              <option value="">请选择浏览器</option>
              <option 
                v-for="browser in browsers" 
                :key="browser.id"
                :value="browser.id"
              >
                {{ browser.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>调度类型 *</label>
            <select v-model="form.scheduleType" @change="onScheduleTypeChange" required>
              <option value="immediate">立即执行</option>
              <option value="delayed">延迟执行</option>
              <option value="interval">间隔执行</option>
              <option value="cron">定时执行</option>
            </select>
          </div>

          <!-- 延迟执行配置 -->
          <div v-if="form.scheduleType === 'delayed'" class="form-group">
            <label>延迟时间 (分钟)</label>
            <input 
              type="number" 
              v-model.number="delayMinutes" 
              min="1"
              placeholder="延迟多少分钟后执行"
            />
          </div>

          <!-- 间隔执行配置 -->
          <div v-if="form.scheduleType === 'interval'" class="schedule-config">
            <div class="form-group">
              <label>间隔时间 (分钟)</label>
              <input 
                type="number" 
                v-model.number="intervalMinutes" 
                min="1"
                placeholder="每隔多少分钟执行一次"
              />
            </div>
            <div class="form-group">
              <label>执行次数</label>
              <input 
                type="number" 
                v-model.number="form.iterations" 
                min="1"
                placeholder="总共执行多少次 (留空为无限次)"
              />
            </div>
          </div>

          <!-- 定时执行配置 -->
          <div v-if="form.scheduleType === 'cron'" class="schedule-config">
            <div class="form-group">
              <label>执行时间</label>
              <div class="cron-presets">
                <button 
                  type="button"
                  class="btn btn-outline"
                  @click="setCronPreset('0 * * * *')"
                >
                  每小时
                </button>
                <button 
                  type="button"
                  class="btn btn-outline"
                  @click="setCronPreset('0 0 * * *')"
                >
                  每天
                </button>
                <button 
                  type="button"
                  class="btn btn-outline"
                  @click="setCronPreset('0 0 * * 0')"
                >
                  每周
                </button>
                <button 
                  type="button"
                  class="btn btn-outline"
                  @click="setCronPreset('0 0 1 * *')"
                >
                  每月
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>Cron 表达式</label>
              <input 
                type="text" 
                v-model="form.cronExpression" 
                placeholder="0 * * * * (每小时执行)"
              />
              <small class="help-text">
                格式: 分钟 小时 日 月 星期<br>
                例: "0 9 * * *" = 每天上午9点
              </small>
            </div>
          </div>

          <!-- 时间范围配置 -->
          <div class="form-group">
            <label>执行时间范围 (可选)</label>
            <div class="time-range">
              <div>
                <label>开始时间</label>
                <input 
                  type="datetime-local" 
                  v-model="startTimeLocal"
                />
              </div>
              <div>
                <label>结束时间</label>
                <input 
                  type="datetime-local" 
                  v-model="endTimeLocal"
                />
              </div>
            </div>
          </div>

          <!-- 任务变量 -->
          <div class="form-group">
            <label>任务变量 (可选)</label>
            <div class="variables-section">
              <div 
                v-for="(variable, index) in variables" 
                :key="index"
                class="variable-item"
              >
                <input 
                  type="text" 
                  v-model="variable.key" 
                  placeholder="变量名"
                />
                <input 
                  type="text" 
                  v-model="variable.value" 
                  placeholder="变量值"
                />
                <button 
                  type="button"
                  class="btn-remove"
                  @click="removeVariable(index)"
                >
                  删除
                </button>
              </div>
              <button 
                type="button"
                class="btn btn-outline"
                @click="addVariable"
              >
                添加变量
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn" @click="$emit('close')">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              创建调度
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Browser } from '../../../main/types/browser'

const props = defineProps<{
  taskId: string
}>()

const emit = defineEmits(['close', 'scheduled'])

const browsers = ref<Browser[]>([])
const taskName = ref('')

const form = ref({
  browserId: '',
  scheduleType: 'immediate',
  iterations: undefined as number | undefined,
  cronExpression: ''
})

const delayMinutes = ref(5)
const intervalMinutes = ref(60)
const startTimeLocal = ref('')
const endTimeLocal = ref('')

const variables = ref([
  { key: '', value: '' }
])

const loadBrowsers = async () => {
  try {
    const result = await window.electronAPI.browser.getBrowsers()
    browsers.value = result
  } catch (error) {
    console.error('Failed to load browsers:', error)
  }
}

const loadTaskInfo = async () => {
  try {
    const task = await window.electronAPI.taskEngine.getTask(props.taskId)
    if (task) {
      taskName.value = task.name
    }
  } catch (error) {
    console.error('Failed to load task info:', error)
  }
}

const onScheduleTypeChange = () => {
  // 重置相关配置
  form.value.cronExpression = ''
  form.value.iterations = undefined
}

const setCronPreset = (expression: string) => {
  form.value.cronExpression = expression
}

const addVariable = () => {
  variables.value.push({ key: '', value: '' })
}

const removeVariable = (index: number) => {
  variables.value.splice(index, 1)
}

const buildScheduleConfig = () => {
  const config: any = {
    type: form.value.scheduleType,
    config: {}
  }

  switch (form.value.scheduleType) {
    case 'immediate':
      break
    case 'delayed':
      config.config.delay = delayMinutes.value * 60 * 1000
      break
    case 'interval':
      config.config.interval = intervalMinutes.value * 60 * 1000
      if (form.value.iterations) {
        config.config.iterations = form.value.iterations
      }
      break
    case 'cron':
      config.config.cronExpression = form.value.cronExpression
      break
  }

  if (startTimeLocal.value) {
    config.config.startTime = new Date(startTimeLocal.value)
  }

  if (endTimeLocal.value) {
    config.config.endTime = new Date(endTimeLocal.value)
  }

  return config
}

const buildVariables = () => {
  const vars: Record<string, any> = {}
  
  variables.value.forEach(variable => {
    if (variable.key.trim() && variable.value.trim()) {
      vars[variable.key.trim()] = variable.value.trim()
    }
  })

  return Object.keys(vars).length > 0 ? vars : undefined
}

const handleSubmit = async () => {
  try {
    const scheduleConfig = buildScheduleConfig()
    const taskVariables = buildVariables()

    const request = {
      taskId: props.taskId,
      scheduleConfig,
      browserId: form.value.browserId,
      variables: taskVariables
    }

    await window.electronAPI.taskScheduler.scheduleTask(request)
    emit('scheduled')
  } catch (error) {
    console.error('Failed to schedule task:', error)
    alert('调度任务失败: ' + error)
  }
}

onMounted(() => {
  loadBrowsers()
  loadTaskInfo()
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
  max-width: 600px;
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.schedule-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cron-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.help-text {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  display: block;
}

.time-range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.variables-section {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 16px;
}

.variable-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
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
  font-size: 12px;
  padding: 4px 8px;
}

.btn-outline:hover {
  background: #007bff;
  color: white;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e5e5;
}
</style>