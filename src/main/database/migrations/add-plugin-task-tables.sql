-- Migration: Add Plugin Task System Tables
-- This migration adds the necessary tables for the new plugin task system

-- Plugin Tasks table
CREATE TABLE IF NOT EXISTS PluginTask (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    version TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT, -- JSON string array
    icon TEXT,
    parameters TEXT NOT NULL, -- JSON string
    dependencies TEXT NOT NULL, -- JSON string array
    config TEXT NOT NULL, -- JSON string
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Plugin Task Executions table
CREATE TABLE IF NOT EXISTS PluginTaskExecution (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    browserId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    parameters TEXT NOT NULL, -- JSON string
    startTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    endTime DATETIME,
    duration INTEGER,
    progress INTEGER NOT NULL DEFAULT 0,
    progressMessage TEXT,
    logs TEXT, -- JSON string array
    result TEXT, -- JSON string
    error TEXT,
    memoryUsage INTEGER,
    cpuUsage INTEGER,
    FOREIGN KEY (taskId) REFERENCES PluginTask(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plugin_task_name ON PluginTask(name);
CREATE INDEX IF NOT EXISTS idx_plugin_task_category ON PluginTask(category);
CREATE INDEX IF NOT EXISTS idx_plugin_task_author ON PluginTask(author);
CREATE INDEX IF NOT EXISTS idx_plugin_task_status ON PluginTask(status);
CREATE INDEX IF NOT EXISTS idx_plugin_task_created_at ON PluginTask(createdAt);

CREATE INDEX IF NOT EXISTS idx_plugin_task_execution_task_id ON PluginTaskExecution(taskId);
CREATE INDEX IF NOT EXISTS idx_plugin_task_execution_browser_id ON PluginTaskExecution(browserId);
CREATE INDEX IF NOT EXISTS idx_plugin_task_execution_status ON PluginTaskExecution(status);
CREATE INDEX IF NOT EXISTS idx_plugin_task_execution_start_time ON PluginTaskExecution(startTime);

-- Trigger to update updatedAt timestamp
CREATE TRIGGER IF NOT EXISTS update_plugin_task_updated_at
    AFTER UPDATE ON PluginTask
    FOR EACH ROW
BEGIN
    UPDATE PluginTask SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;