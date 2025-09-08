/**
 * SyntaxChecker 基础集成测试
 * 测试核心功能，避免复杂的 markdownlint 集成问题
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileTypeDetector } from '../../tools/document/syntaxChecker/FileTypeDetector';
import { SyntaxCheckerConfigLoader } from '../../tools/document/syntaxChecker/SyntaxCheckerConfigLoader';

describe('SyntaxChecker Basic Integration', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syntax-checker-basic-test-'));
  });
  
  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${tempDir}`);
    }
  });
  
  it('should detect file types correctly in integration', () => {
    const files = [
      { path: 'SRS.md' },
      { path: 'requirements.yaml' },
      { path: 'script.js' }
    ];
    
    const result = FileTypeDetector.processFileList(files);
    
    expect(result.markdownFiles).toEqual(['SRS.md']);
    expect(result.yamlFiles).toEqual(['requirements.yaml']);
    expect(result.unsupportedFiles).toEqual(['script.js']);
  });
  
  it('should load configuration successfully', () => {
    // 这个测试在没有真实 VSCode 环境时会使用默认配置
    const config = SyntaxCheckerConfigLoader.loadConfig();
    
    expect(config).toBeDefined();
    expect(typeof config.enabled).toBe('boolean');
    expect(config.markdown).toBeDefined();
    expect(config.yaml).toBeDefined();
  });
  
  it('should handle markdown preset configurations', () => {
    const standardConfig = SyntaxCheckerConfigLoader.loadMarkdownConfig();
    expect(standardConfig.preset).toBe('standard');
    expect(standardConfig.enabled).toBe(true);
  });
  
  it('should handle YAML level configurations', () => {
    const yamlConfig = SyntaxCheckerConfigLoader.loadYAMLConfig();
    expect(yamlConfig.level).toBe('standard');
    expect(yamlConfig.checkSyntax).toBe(true);
    expect(yamlConfig.checkStructure).toBe(true);
  });
  
  it('should provide supported extensions list', () => {
    const extensions = FileTypeDetector.getSupportedExtensions();
    expect(extensions).toContain('.md');
    expect(extensions).toContain('.yaml');
    expect(extensions).toHaveLength(4);
  });
  
  it('should validate file type support', () => {
    expect(FileTypeDetector.isSupportedFileType('test.md')).toBe(true);
    expect(FileTypeDetector.isSupportedFileType('test.yaml')).toBe(true);
    expect(FileTypeDetector.isSupportedFileType('test.js')).toBe(false);
  });
});
