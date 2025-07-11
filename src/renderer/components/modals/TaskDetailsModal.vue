<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <i class="modal-icon">👁️</i>
          <h3>任务详情</h3>
        </div>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
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
          <div class="task-info">
            <h4>{{ task.metadata.name }}</h4>
            <p class="task-description">{{ task.metadata.description }}</p>
            <div class="task-meta">
              <span class="meta-item">
                <strong>作者:</strong> {{ task.metadata.author }}
              </span>
              <span class="meta-item">
                <strong>版本:</strong> {{ task.metadata.version }}
              </span>
              <span class="meta-item">
                <strong>分类:</strong> {{ task.metadata.category }}
              </span>
            </div>
          </div>
        </div>

        <div class="task-sections">
          <!-- 基本信息 -->
          <div class="section">
            <h5>基本信息</h5>
            <div class="info-grid">
              <div class="info-item">
                <label>创建时间</label>
                <span>{{ formatDate(task.metadata.createdAt) }}</span>
              </div>
              <div class="info-item">
                <label>更新时间</label>
                <span>{{ formatDate(task.metadata.updatedAt) }}</span>
              </div>
              <div class="info-item">
                <label>添加时间</label>
                <span>{{ formatDate(task.addedAt) }}</span>
              </div>
              <div class="info-item" v-if="task.lastUsed">
                <label>最后使用</label>
                <span>{{ formatDate(task.lastUsed) }}</span>
              </div>
              <div class="info-item">
                <label>使用次数</label>
                <span>{{ task.usageCount }} 次</span>
              </div>
              <div class="info-item">
                <label>状态</label>
                <span :class="['status-badge', task.status]">
                  {{ getStatusText(task.status) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 标签 -->
          <div v-if="task.metadata.tags && task.metadata.tags.length > 0" class="section">
            <h5>标签</h5>
            <div class="tags-list">
              <span v-for="tag in task.metadata.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 参数 -->
          <div v-if="task.parameters && task.parameters.length > 0" class="section">
            <h5>任务参数</h5>
            <div class="parameters-list">
              <div v-for="param in task.parameters" :key="param.name" class="param-item">
                <div class="param-header">
                  <h6>{{ param.label }}</h6>
                  <span class="param-type">{{ param.type }}</span>
                  <span v-if="param.required" class="required-badge">必填</span>
                </div>
                <p v-if="param.description" class="param-description">
                  {{ param.description }}
                </p>
                <div class="param-details">
                  <div v-if="param.defaultValue !== undefined" class="param-detail">
                    <strong>默认值:</strong> {{ param.defaultValue }}
                  </div>
                  <div v-if="param.validation" class="param-validation">
                    <strong>验证规则:</strong>
                    <span v-if="param.validation.min !== undefined">
                      最小值: {{ param.validation.min }}
                    </span>
                    <span v-if="param.validation.max !== undefined">
                      最大值: {{ param.validation.max }}
                    </span>
                    <span v-if="param.validation.pattern">
                      模式: {{ param.validation.pattern }}
                    </span>
                    <div v-if="param.validation.options" class="param-options">
                      <strong>选项:</strong>
                      <ul>
                        <li v-for="option in param.validation.options" :key="option.value">
                          {{ option.label }} ({{ option.value }})
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 文件信息 -->
          <div class="section">
            <h5>文件信息</h5>
            <div class="file-info">
              <div class="info-item">
                <label>文件路径</label>
                <span class="file-path">{{ task.filePath }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn-primary">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LocalTask } from '../../../main/types/task'

const props = defineProps<{
  task: LocalTask
}>()

const emit = defineEmits<{
  close: []
}>()

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleString('zh-CN')
}

const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: '活跃',
    disabled: '禁用'
  }
  return statusMap[status] || status
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
  max-width: 700px;
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

.task-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #0f172a;
  border-radius: 12px;
  border: 1px solid #334155;
}

.task-logo {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #334155;
}

.task-logo-fallback {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 24px;
}

.task-info {
  flex: 1;
}

.task-info h4 {
  margin: 0 0 8px 0;
  color: #e2e8f0;
  font-size: 20px;
  font-weight: 600;
}

.task-description {
  margin: 0 0 12px 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 12px;
  color: #64748b;
}

.meta-item strong {
  color: #cbd5e1;
}

.task-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  background: #0f172a;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #334155;
}

.section h5 {
  margin: 0 0 12px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.info-item span {
  font-size: 14px;
  color: #e2e8f0;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: fit-content;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.status-badge.disabled {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

.tags-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.parameters-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-item {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  background: #1e293b;
}

.param-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.param-header h6 {
  margin: 0;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}

.param-type {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.required-badge {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.param-description {
  margin: 0 0 8px 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.4;
}

.param-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-detail,
.param-validation {
  font-size: 12px;
  color: #64748b;
}

.param-detail strong,
.param-validation strong {
  color: #cbd5e1;
}

.param-options ul {
  margin: 4px 0 0 16px;
  padding: 0;
}

.param-options li {
  font-size: 11px;
  color: #94a3b8;
  margin: 2px 0;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-path {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  background: rgba(100, 116, 139, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  word-break: break-all;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px 24px;
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

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}
</style>