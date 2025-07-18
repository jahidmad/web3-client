import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CleanupHelper } from '../../main/utils/cleanup-helper';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

describe('CleanupHelper', () => {
  let cleanupHelper: CleanupHelper;
  const tempFilePath = path.join(process.cwd(), 'temp', 'test_file.tmp');
  const tempDirPath = path.join(process.cwd(), 'temp', 'test_dir');

  beforeEach(() => {
    cleanupHelper = new CleanupHelper();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupHelper.cleanup();
  });

  describe('registerTempFile', () => {
    it('should register a temporary file', () => {
      cleanupHelper.registerTempFile(tempFilePath);
      // Access private property for testing
      expect((cleanupHelper as any).tempFiles).toContain(tempFilePath);
    });
  });

  describe('registerTempDir', () => {
    it('should register a temporary directory', () => {
      cleanupHelper.registerTempDir(tempDirPath);
      // Access private property for testing
      expect((cleanupHelper as any).tempDirs).toContain(tempDirPath);
    });
  });

  describe('cleanup', () => {
    it('should clean up registered temporary files', async () => {
      cleanupHelper.registerTempFile(tempFilePath);
      await cleanupHelper.cleanup();
      
      expect(fs.unlink).toHaveBeenCalledWith(tempFilePath);
      // Access private property for testing
      expect((cleanupHelper as any).tempFiles).toEqual([]);
    });

    it('should clean up registered temporary directories', async () => {
      cleanupHelper.registerTempDir(tempDirPath);
      await cleanupHelper.cleanup();
      
      expect(fs.rm).toHaveBeenCalledWith(tempDirPath, { recursive: true, force: true });
      // Access private property for testing
      expect((cleanupHelper as any).tempDirs).toEqual([]);
    });

    it('should handle errors during cleanup gracefully', async () => {
      // Mock unlink to throw an error
      (fs.unlink as any).mockRejectedValueOnce(new Error('Test error'));
      
      cleanupHelper.registerTempFile(tempFilePath);
      
      // Should not throw
      await expect(cleanupHelper.cleanup()).resolves.not.toThrow();
    });
  });

  describe('createTempFile', () => {
    it('should create a temporary file with the given content', async () => {
      const content = 'Test content';
      const extension = '.js';
      
      await cleanupHelper.createTempFile(content, extension);
      
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      // The second argument to writeFile should be the content
      expect((fs.writeFile as any).mock.calls[0][1]).toBe(content);
    });

    it('should register the created file for cleanup', async () => {
      const content = 'Test content';
      const filePath = await cleanupHelper.createTempFile(content);
      
      // Access private property for testing
      expect((cleanupHelper as any).tempFiles).toContain(filePath);
    });
  });

  describe('createTempDir', () => {
    it('should create a temporary directory', async () => {
      const prefix = 'test_';
      
      await cleanupHelper.createTempDir(prefix);
      
      expect(fs.mkdir).toHaveBeenCalledTimes(2); // Once for temp dir, once for subdir
    });

    it('should register the created directory for cleanup', async () => {
      const dirPath = await cleanupHelper.createTempDir();
      
      // Access private property for testing
      expect((cleanupHelper as any).tempDirs).toContain(dirPath);
    });
  });
});