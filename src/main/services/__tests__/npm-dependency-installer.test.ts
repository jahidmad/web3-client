/**
 * NPM Dependency Installer Tests
 * 
 * This file contains unit tests for the NPM Dependency Installer.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { NpmDependencyInstaller } from '../npm-dependency-installer';

describe('NpmDependencyInstaller', () => {
  let installer: NpmDependencyInstaller;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `npm-dependency-installer-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create the installer with the temporary directory
    installer = new NpmDependencyInstaller({
      baseDir: tempDir,
      installTimeout: 30000, // 30 seconds for tests
      useGlobalCache: true,
      allowNetwork: true,
      maxConcurrentInstalls: 1
    });
    
    // Initialize the installer
    await installer.initialize();
  });

  afterEach(async () => {
    // Clean up the temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temporary directory:', error);
    }
  });

  test('should initialize correctly', async () => {
    // Check that the base directory was created
    const baseDir = installer.getBaseDir();
    const exists = await fs.stat(baseDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Check that the packages directory was created
    const packagesDir = path.join(baseDir, 'packages');
    const packagesDirExists = await fs.stat(packagesDir).then(() => true).catch(() => false);
    expect(packagesDirExists).toBe(true);
    
    // Check that the cache directory was created
    const cacheDir = path.join(baseDir, 'cache');
    const cacheDirExists = await fs.stat(cacheDir).then(() => true).catch(() => false);
    expect(cacheDirExists).toBe(true);
  });

  test('should check dependency status correctly', async () => {
    const taskId = 'test-task';
    const dependency = 'lodash';
    
    // Check a non-existent dependency
    const status = await installer.checkDependency(dependency, taskId);
    expect(status.installed).toBe(false);
    expect(status.name).toBe('lodash');
  });

  test('should install a dependency', async () => {
    const taskId = 'test-task';
    const dependencies = ['lodash@4.17.21']; // Use a specific version for testing
    
    // Install the dependency
    const result = await installer.installDependencies({
      taskId,
      dependencies,
      force: false
    });
    
    // Check the result
    expect(result.success).toBe(true);
    expect(result.installed.length).toBe(1);
    expect(result.installed[0].name).toBe('lodash');
    expect(result.installed[0].installed).toBe(true);
    
    // Check that the dependency was actually installed
    const status = await installer.checkDependency('lodash', taskId);
    expect(status.installed).toBe(true);
    expect(status.name).toBe('lodash');
  });

  test('should handle multiple dependencies', async () => {
    const taskId = 'test-task';
    const dependencies = ['lodash@4.17.21', 'chalk@4.1.2']; // Use specific versions for testing
    
    // Install the dependencies
    const result = await installer.installDependencies({
      taskId,
      dependencies,
      force: false
    });
    
    // Check the result
    expect(result.success).toBe(true);
    expect(result.installed.length).toBe(2);
    
    // Check that both dependencies were installed
    const lodashStatus = await installer.checkDependency('lodash', taskId);
    expect(lodashStatus.installed).toBe(true);
    
    const chalkStatus = await installer.checkDependency('chalk', taskId);
    expect(chalkStatus.installed).toBe(true);
  });

  test('should handle scoped packages', async () => {
    const taskId = 'test-task';
    const dependencies = ['@types/node@18.0.0']; // Use a specific version for testing
    
    // Install the dependency
    const result = await installer.installDependencies({
      taskId,
      dependencies,
      force: false
    });
    
    // Check the result
    expect(result.success).toBe(true);
    expect(result.installed.length).toBe(1);
    expect(result.installed[0].name).toBe('@types/node');
    expect(result.installed[0].installed).toBe(true);
  });

  test('should clean up task dependencies', async () => {
    const taskId = 'test-task';
    const dependencies = ['lodash@4.17.21']; // Use a specific version for testing
    
    // Install the dependency
    await installer.installDependencies({
      taskId,
      dependencies,
      force: false
    });
    
    // Check that the dependency was installed
    let status = await installer.checkDependency('lodash', taskId);
    expect(status.installed).toBe(true);
    
    // Clean up the task dependencies
    await installer.cleanupTaskDependencies(taskId);
    
    // Check that the dependency was removed
    status = await installer.checkDependency('lodash', taskId);
    expect(status.installed).toBe(false);
  });

  test('should clean up all dependencies', async () => {
    const taskId1 = 'test-task-1';
    const taskId2 = 'test-task-2';
    const dependencies1 = ['lodash@4.17.21'];
    const dependencies2 = ['chalk@4.1.2'];
    
    // Install dependencies for both tasks
    await installer.installDependencies({
      taskId: taskId1,
      dependencies: dependencies1,
      force: false
    });
    
    await installer.installDependencies({
      taskId: taskId2,
      dependencies: dependencies2,
      force: false
    });
    
    // Check that the dependencies were installed
    let status1 = await installer.checkDependency('lodash', taskId1);
    let status2 = await installer.checkDependency('chalk', taskId2);
    expect(status1.installed).toBe(true);
    expect(status2.installed).toBe(true);
    
    // Clean up all dependencies
    await installer.cleanupAllDependencies();
    
    // Check that all dependencies were removed
    status1 = await installer.checkDependency('lodash', taskId1);
    status2 = await installer.checkDependency('chalk', taskId2);
    expect(status1.installed).toBe(false);
    expect(status2.installed).toBe(false);
  });
});