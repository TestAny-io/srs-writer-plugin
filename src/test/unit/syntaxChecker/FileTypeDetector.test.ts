/**
 * FileTypeDetector 单元测试
 * 测试文件类型检测和文件列表处理功能
 */

import { FileTypeDetector } from '../../../tools/document/syntaxChecker/FileTypeDetector';

describe('FileTypeDetector', () => {
  
  describe('detectFileType', () => {
    it('should detect markdown files correctly', () => {
      expect(FileTypeDetector.detectFileType('SRS.md')).toBe('markdown');
      expect(FileTypeDetector.detectFileType('README.markdown')).toBe('markdown');
      expect(FileTypeDetector.detectFileType('docs/guide.md')).toBe('markdown');
      expect(FileTypeDetector.detectFileType('path/to/file.MD')).toBe('markdown');
    });
    
    it('should detect YAML files correctly', () => {
      expect(FileTypeDetector.detectFileType('requirements.yaml')).toBe('yaml');
      expect(FileTypeDetector.detectFileType('config.yml')).toBe('yaml');
      expect(FileTypeDetector.detectFileType('data/settings.YAML')).toBe('yaml');
      expect(FileTypeDetector.detectFileType('schema.YML')).toBe('yaml');
    });
    
    it('should detect unsupported files correctly', () => {
      expect(FileTypeDetector.detectFileType('script.js')).toBe('unsupported');
      expect(FileTypeDetector.detectFileType('data.json')).toBe('unsupported');
      expect(FileTypeDetector.detectFileType('style.css')).toBe('unsupported');
      expect(FileTypeDetector.detectFileType('app.py')).toBe('unsupported');
      expect(FileTypeDetector.detectFileType('file')).toBe('unsupported'); // 无扩展名
    });
  });
  
  describe('processFileList', () => {
    it('should categorize files correctly', () => {
      const files = [
        { path: 'SRS.md' },
        { path: 'requirements.yaml' },
        { path: 'README.markdown' },
        { path: 'config.yml' },
        { path: 'script.js' },
        { path: 'data.json' }
      ];
      
      const result = FileTypeDetector.processFileList(files);
      
      expect(result.markdownFiles).toEqual(['SRS.md', 'README.markdown']);
      expect(result.yamlFiles).toEqual(['requirements.yaml', 'config.yml']);
      expect(result.unsupportedFiles).toEqual(['script.js', 'data.json']);
    });
    
    it('should handle empty file list', () => {
      const result = FileTypeDetector.processFileList([]);
      
      expect(result.markdownFiles).toEqual([]);
      expect(result.yamlFiles).toEqual([]);
      expect(result.unsupportedFiles).toEqual([]);
    });
    
    it('should handle all supported files', () => {
      const files = [
        { path: 'doc1.md' },
        { path: 'doc2.markdown' },
        { path: 'config1.yaml' },
        { path: 'config2.yml' }
      ];
      
      const result = FileTypeDetector.processFileList(files);
      
      expect(result.markdownFiles).toEqual(['doc1.md', 'doc2.markdown']);
      expect(result.yamlFiles).toEqual(['config1.yaml', 'config2.yml']);
      expect(result.unsupportedFiles).toEqual([]);
    });
    
    it('should handle all unsupported files', () => {
      const files = [
        { path: 'script.js' },
        { path: 'style.css' },
        { path: 'data.json' }
      ];
      
      const result = FileTypeDetector.processFileList(files);
      
      expect(result.markdownFiles).toEqual([]);
      expect(result.yamlFiles).toEqual([]);
      expect(result.unsupportedFiles).toEqual(['script.js', 'style.css', 'data.json']);
    });
  });
  
  describe('utility methods', () => {
    it('should check supported file types', () => {
      expect(FileTypeDetector.isSupportedFileType('SRS.md')).toBe(true);
      expect(FileTypeDetector.isSupportedFileType('config.yaml')).toBe(true);
      expect(FileTypeDetector.isSupportedFileType('script.js')).toBe(false);
    });
    
    it('should return supported extensions', () => {
      const extensions = FileTypeDetector.getSupportedExtensions();
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.markdown');
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.yml');
      expect(extensions).toHaveLength(4);
    });
  });
});
