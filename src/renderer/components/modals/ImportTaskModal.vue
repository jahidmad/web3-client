<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <i class="modal-icon">🔗</i>
          <h3>导入任务</h3>
        </div>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>
      
      <form @submit.prevent="importTask" class="import-form">
        <div class="form-group">
          <label for="taskUrl">任务URL</label>
          <input 
            id="taskUrl"
            v-model="taskUrl" 
            type="url" 
            required 
            placeholder="https://example.com/task.json"
            class="url-input"
          />
          <p class="form-hint">
            输入任务文件的URL地址，支持 .json 和 .js 格式
          </p>
        </div>

        <div class="form-actions">
          <button type="button" @click="$emit('close')" class="btn-secondary">
            取消
          </button>
          <button type="submit" class="btn-primary" :disabled="importing">
            {{ importing ? '导入中...' : '导入任务' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  close: []
  imported: []
}>()

const taskUrl = ref('')
const importing = ref(false)

const importTask = async () => {
  if (!taskUrl.value.trim()) return
  
  importing.value = true
  try {
    const result = await window.electronAPI.taskManager.importTask({
      url: taskUrl.value
    })
    
    console.log('Task imported successfully:', result)
    emit('imported')
  } catch (error) {
    console.error('Failed to import task:', error)
    alert('导入任务失败: ' + error)
  } finally {
    importing.value = false
  }
}
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
  max-width: 500px;
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

.import-form {
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

.url-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #475569;
  border-radius: 8px;
  font-size: 14px;
  background-color: #0f172a;
  color: #e2e8f0;
  transition: all 0.2s ease;
}

.url-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.url-input::placeholder {
  color: #64748b;
}

.form-hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
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
</style>