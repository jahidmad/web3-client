<template>
  <div class="modal-overlay" @click="$emit('cancel')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <i class="modal-icon">⚠️</i>
          <h3>确认删除</h3>
        </div>
        <button @click="$emit('cancel')" class="close-btn">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="warning-content">
          <div class="warning-icon">🗑️</div>
          <div class="warning-text">
            <h4>确定要删除此任务吗？</h4>
            <p v-if="taskName" class="task-name">任务名称: <strong>{{ taskName }}</strong></p>
            <p class="warning-message">
              此操作无法撤销，任务文件和相关数据将被永久删除。
            </p>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('cancel')" class="btn-secondary">
          <span class="icon">❌</span>
          取消
        </button>
        <button @click="$emit('confirm')" class="btn-danger">
          <span class="icon">🗑️</span>
          确认删除
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  taskName?: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
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
  max-width: 480px;
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

.warning-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.warning-icon {
  font-size: 48px;
  opacity: 0.8;
}

.warning-text {
  flex: 1;
}

.warning-text h4 {
  margin: 0 0 12px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 600;
}

.task-name {
  margin: 0 0 12px 0;
  color: #94a3b8;
  font-size: 14px;
}

.task-name strong {
  color: #e2e8f0;
}

.warning-message {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px 24px;
  border-top: 1px solid #334155;
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
  gap: 6px;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #64748b;
  border-color: #94a3b8;
}

.btn-danger {
  background-color: #ef4444;
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
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.icon {
  font-size: 12px;
}
</style>