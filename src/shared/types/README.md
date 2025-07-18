# Plugin Task System - Type Definitions

This directory contains comprehensive TypeScript type definitions for the Plugin Task System. The types are organized into three main files:

## Files Overview

### 1. `plugin-task-system.ts`
Core type definitions for the plugin task system including:

- **Task Management**: `Task`, `TaskManager`, `TaskFilter`
- **Parameters**: `Parameter`, `ParameterType`, `ParameterOption`
- **Execution**: `Execution`, `ExecutionRequest`, `ExecutionStatus`, `TaskContext`
- **Dependencies**: `DependencyStatus`, `DependencyInfo`, `DependencyInstallRequest`
- **Browser API**: `BrowserAPI`, `TaskUtils`, navigation and interaction interfaces
- **Events**: `TaskEvent`, `TaskEventType`, `TaskEventEmitter`
- **Import/Export**: `TaskExportOptions`, `TaskImportOptions`, `TaskImportResult`

### 2. `errors.ts`
Error handling and status enumerations including:

- **Error Classes**: `TaskError`, `TaskParseError`, `TaskDependencyError`, `TaskExecutionError`, `TaskSystemError`
- **Error Codes**: `ErrorCode` enum with comprehensive error categorization
- **Status Enums**: `DetailedTaskStatus`, `DependencyInstallStatus`, `ExecutionPhase`, `BrowserOperationStatus`
- **Error Recovery**: `ErrorRecoveryStrategy`, `ErrorRecoveryConfig`
- **Analytics**: `ErrorReport`, `ErrorAnalytics`
- **Validation**: `ValidationRule`, `ValidationResult`, `ValidationType`

### 3. `task-file-format.ts`
Task file format constraints and validation including:

- **JSDoc Constraints**: Required and optional JSDoc tags, metadata extraction
- **File Structure**: Required/optional exports, execute function signature
- **Parameter Constraints**: Type validation rules and schemas
- **Dependency Constraints**: Supported formats and validation patterns
- **Security**: Forbidden patterns, security scan results
- **Validation**: File validation steps, results, and utilities

## Usage Examples

### Basic Task Definition
```typescript
import { Task, Parameter, TaskConfig } from '@/shared/types';

const task: Task = {
  id: 'example-task',
  name: 'Example Task',
  description: 'An example automation task',
  version: '1.0.0',
  author: 'Developer',
  category: 'web-scraping',
  tags: ['example', 'demo'],
  parameters: [
    {
      name: 'url',
      label: 'Target URL',
      type: 'url',
      required: true,
      description: 'The URL to process'
    }
  ],
  dependencies: ['lodash@4.17.21'],
  config: {
    timeout: 30000,
    retries: 2,
    permissions: ['network']
  },
  code: '// Task implementation code',
  createdAt: new Date(),
  updatedAt: new Date(),
  status: TaskStatus.ACTIVE
};
```

### Task Execution
```typescript
import { ExecutionRequest, TaskContext } from '@/shared/types';

const executionRequest: ExecutionRequest = {
  taskId: 'example-task',
  browserId: 'browser-1',
  parameters: {
    url: 'https://example.com'
  }
};

// In task execution context
async function execute(context: TaskContext) {
  const { page, params, log, progress, browser, utils } = context;
  
  log('Starting task execution');
  progress(0, 'Navigating to URL');
  
  await browser.goto(params.url);
  const title = await browser.getTitle();
  
  progress(50, 'Extracting data');
  const data = await browser.getText('h1');
  
  progress(100, 'Task completed');
  return { title, data };
}
```

### Error Handling
```typescript
import { TaskError, ErrorCode, TaskExecutionError } from '@/shared/types';

try {
  await taskManager.executeTask(executionRequest);
} catch (error) {
  if (error instanceof TaskExecutionError) {
    console.error(`Execution failed: ${error.message}`);
    console.error(`Stage: ${error.executionDetails.stage}`);
    console.error(`Task ID: ${error.taskId}`);
  } else if (error instanceof TaskError) {
    console.error(`Task error [${error.code}]: ${error.message}`);
  }
}
```

### File Validation
```typescript
import { TaskFileValidator, TaskFileValidationContext } from '@/shared/types';

const validator: TaskFileValidator = async (context, config) => {
  const result = await validateTaskFile(context, config);
  
  if (!result.valid) {
    console.error('Validation failed:', result.errors);
    return result;
  }
  
  console.log('Task file is valid');
  console.log('Metadata:', result.metadata);
  console.log('Parameters:', result.parameters);
  
  return result;
};
```

## Type Safety Features

### Strict Type Checking
All types are designed with strict TypeScript checking in mind:

- Required vs optional properties are clearly defined
- Enum values are constrained to prevent invalid states
- Generic types provide flexibility while maintaining safety
- Union types are used appropriately for variant data

### Runtime Validation
Type guards and validation utilities are provided:

```typescript
import { isValidJSDocMetadata, isValidParameterArray } from '@/shared/types';

if (isValidJSDocMetadata(metadata)) {
  // TypeScript knows metadata is JSDocMetadata
  console.log(metadata.name, metadata.version);
}

if (isValidParameterArray(params)) {
  // TypeScript knows params is Parameter[]
  params.forEach(param => console.log(param.name));
}
```

### Error Type Discrimination
Error types can be discriminated for specific handling:

```typescript
function handleError(error: TaskError) {
  switch (error.code) {
    case ErrorCode.PARSE_ERROR:
      // Handle parse errors
      break;
    case ErrorCode.DEPENDENCY_NOT_FOUND:
      // Handle dependency errors
      break;
    case ErrorCode.EXECUTION_TIMEOUT:
      // Handle timeout errors
      break;
    default:
      // Handle other errors
      break;
  }
}
```

## Requirements Mapping

This type system fulfills the following requirements from the specification:

- **Requirement 1.1**: Task file format with JSDoc metadata support
- **Requirement 1.2**: Parameter definitions with type validation
- **Requirement 1.3**: Dependency management with npm package support
- **Requirement 1.4**: Task configuration and execution settings
- **Requirement 1.5**: Execute function signature and context
- **Requirement 1.6**: Comprehensive error handling and validation

## Integration Notes

### Main Process Integration
Types are designed to work seamlessly with the main process:

```typescript
// In main process services
import { TaskManager, Task, Execution } from '@/shared/types';

class TaskService implements TaskManager {
  async uploadTask(file: Buffer, filename: string): Promise<Task> {
    // Implementation
  }
  
  async executeTask(request: ExecutionRequest): Promise<Execution> {
    // Implementation
  }
}
```

### Renderer Process Integration
Types can be safely used in the renderer process:

```typescript
// In renderer components
import { Task, ExecutionStatus } from '@/shared/types';

interface TaskListProps {
  tasks: Task[];
  onExecute: (taskId: string) => void;
}
```

### IPC Communication
Types ensure type safety across IPC boundaries:

```typescript
// IPC channel definitions
interface TaskIPC {
  'task:upload': (file: Buffer, filename: string) => Promise<Task>;
  'task:execute': (request: ExecutionRequest) => Promise<Execution>;
  'task:list': (filter?: TaskFilter) => Promise<Task[]>;
}
```

## Best Practices

1. **Always use the provided types** instead of `any` or loose object types
2. **Leverage type guards** for runtime validation
3. **Use discriminated unions** for error handling
4. **Prefer composition** over inheritance for complex types
5. **Document type usage** with JSDoc comments
6. **Validate at boundaries** between trusted and untrusted code
7. **Use readonly modifiers** for immutable data structures

## Future Extensions

The type system is designed to be extensible:

- New parameter types can be added to `ParameterType`
- Additional error codes can be added to `ErrorCode`
- New validation rules can be added to `ValidationType`
- Browser API can be extended with new methods
- Event system can support new event types

For questions or contributions, please refer to the main project documentation.