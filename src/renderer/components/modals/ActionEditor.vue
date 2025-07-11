<template>
  <div class="action-editor">
    <div class="action-config">
      <div class="config-group">
        <label>动作名称</label>
        <input 
          type="text" 
          :value="action.name" 
          @input="updateField('name', $event.target.value)"
        />
      </div>

      <div class="config-group">
        <label>描述</label>
        <input 
          type="text" 
          :value="action.description" 
          @input="updateField('description', $event.target.value)"
          placeholder="可选"
        />
      </div>

      <div class="config-row">
        <div class="config-group">
          <label>超时时间 (ms)</label>
          <input 
            type="number" 
            :value="action.timeout" 
            @input="updateField('timeout', parseInt($event.target.value))"
          />
        </div>
        <div class="config-group">
          <label>
            <input 
              type="checkbox" 
              :checked="action.continueOnError" 
              @change="updateField('continueOnError', $event.target.checked)"
            />
            出错时继续
          </label>
        </div>
      </div>

      <!-- 导航动作配置 -->
      <template v-if="action.type === 'navigate'">
        <div class="config-group">
          <label>URL *</label>
          <input 
            type="url" 
            :value="action.url" 
            @input="updateField('url', $event.target.value)"
            placeholder="https://example.com"
            required
          />
        </div>
        <div class="config-group">
          <label>
            <input 
              type="checkbox" 
              :checked="action.waitForLoad" 
              @change="updateField('waitForLoad', $event.target.checked)"
            />
            等待页面加载完成
          </label>
        </div>
      </template>

      <!-- 点击动作配置 -->
      <template v-if="action.type === 'click'">
        <div class="config-group">
          <label>选择器 *</label>
          <input 
            type="text" 
            :value="action.selector" 
            @input="updateField('selector', $event.target.value)"
            placeholder="#button, .btn, [data-id='submit']"
            required
          />
        </div>
        <div class="config-row">
          <div class="config-group">
            <label>点击次数</label>
            <input 
              type="number" 
              :value="action.clickCount || 1" 
              @input="updateField('clickCount', parseInt($event.target.value))"
              min="1"
              max="5"
            />
          </div>
          <div class="config-group">
            <label>
              <input 
                type="checkbox" 
                :checked="action.waitForElement" 
                @change="updateField('waitForElement', $event.target.checked)"
              />
              等待元素出现
            </label>
          </div>
        </div>
      </template>

      <!-- 输入动作配置 -->
      <template v-if="action.type === 'input'">
        <div class="config-group">
          <label>选择器 *</label>
          <input 
            type="text" 
            :value="action.selector" 
            @input="updateField('selector', $event.target.value)"
            placeholder="#input, .form-control, [name='username']"
            required
          />
        </div>
        <div class="config-group">
          <label>输入文本 *</label>
          <textarea 
            :value="action.text" 
            @input="updateField('text', $event.target.value)"
            placeholder="要输入的文本内容"
            required
          ></textarea>
        </div>
        <div class="config-row">
          <div class="config-group">
            <label>输入延迟 (ms)</label>
            <input 
              type="number" 
              :value="action.delay || 0" 
              @input="updateField('delay', parseInt($event.target.value))"
              min="0"
            />
          </div>
          <div class="config-group">
            <label>
              <input 
                type="checkbox" 
                :checked="action.clear" 
                @change="updateField('clear', $event.target.checked)"
              />
              输入前清空
            </label>
          </div>
        </div>
      </template>

      <!-- 等待动作配置 -->
      <template v-if="action.type === 'wait'">
        <div class="config-group">
          <label>等待类型</label>
          <select 
            :value="action.waitType" 
            @change="updateField('waitType', $event.target.value)"
          >
            <option value="time">等待时间</option>
            <option value="element">等待元素</option>
            <option value="navigation">等待导航</option>
            <option value="network">等待网络</option>
          </select>
        </div>
        <div class="config-group" v-if="action.waitType === 'time'">
          <label>等待时间 (ms)</label>
          <input 
            type="number" 
            :value="action.value" 
            @input="updateField('value', parseInt($event.target.value))"
            min="100"
          />
        </div>
        <div class="config-group" v-if="action.waitType === 'element'">
          <label>选择器</label>
          <input 
            type="text" 
            :value="action.value" 
            @input="updateField('value', $event.target.value)"
            placeholder="#element, .class, [data-id]"
          />
        </div>
      </template>

      <!-- 截图动作配置 -->
      <template v-if="action.type === 'screenshot'">
        <div class="config-group">
          <label>文件名</label>
          <input 
            type="text" 
            :value="action.filename" 
            @input="updateField('filename', $event.target.value)"
            placeholder="screenshot.png (可选)"
          />
        </div>
        <div class="config-group">
          <label>
            <input 
              type="checkbox" 
              :checked="action.fullPage" 
              @change="updateField('fullPage', $event.target.checked)"
            />
            全页面截图
          </label>
        </div>
      </template>

      <!-- 数据提取动作配置 -->
      <template v-if="action.type === 'extract'">
        <div class="config-group">
          <label>选择器 *</label>
          <input 
            type="text" 
            :value="action.selector" 
            @input="updateField('selector', $event.target.value)"
            placeholder="#content, .title, [data-value]"
            required
          />
        </div>
        <div class="config-row">
          <div class="config-group">
            <label>数据类型</label>
            <select 
              :value="action.dataType" 
              @change="updateField('dataType', $event.target.value)"
            >
              <option value="text">文本内容</option>
              <option value="html">HTML内容</option>
              <option value="attribute">属性值</option>
              <option value="count">元素数量</option>
            </select>
          </div>
          <div class="config-group" v-if="action.dataType === 'attribute'">
            <label>属性名</label>
            <input 
              type="text" 
              :value="action.attribute" 
              @input="updateField('attribute', $event.target.value)"
              placeholder="href, src, data-id"
            />
          </div>
        </div>
        <div class="config-group">
          <label>变量名</label>
          <input 
            type="text" 
            :value="action.variable" 
            @input="updateField('variable', $event.target.value)"
            placeholder="extracted_data"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AutomationAction } from '../../../main/types/task'

const props = defineProps<{
  action: AutomationAction
}>()

const emit = defineEmits<{
  update: [action: AutomationAction]
}>()

const updateField = (field: string, value: any) => {
  const updatedAction = {
    ...props.action,
    [field]: value
  }
  emit('update', updatedAction)
}
</script>

<style scoped>
.action-editor {
  padding: 16px;
}

.action-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-group label {
  font-size: 12px;
  font-weight: 500;
  color: #555;
}

.config-group input,
.config-group select,
.config-group textarea {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.config-group textarea {
  resize: vertical;
  min-height: 60px;
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.config-group input[type="checkbox"] {
  width: auto;
  margin-right: 6px;
}

.config-group label:has(input[type="checkbox"]) {
  flex-direction: row;
  align-items: center;
}
</style>