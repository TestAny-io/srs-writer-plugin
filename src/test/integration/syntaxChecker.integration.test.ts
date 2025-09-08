/**
 * SyntaxChecker 集成测试
 * 测试完整的语法检查工作流程
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { syntaxCheckerTool } from '../../tools/document/syntaxCheckerTools';

describe('SyntaxChecker Integration', () => {
  let tempDir: string;
  let markdownFile: string;
  let yamlFile: string;
  let invalidYamlFile: string;
  
  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syntax-checker-test-'));
    markdownFile = path.join(tempDir, 'test.md');
    yamlFile = path.join(tempDir, 'test.yaml');
    invalidYamlFile = path.join(tempDir, 'invalid.yaml');
    
    // 创建测试文件
    await fs.writeFile(markdownFile, `# Test Document

This is a test markdown file with some content.

## Section 1

Some content here.

## Section 2

More content with a very long line that exceeds the typical line length limit of 120 characters and should trigger MD013 rule.
`);
    
    await fs.writeFile(yamlFile, `user_stories:
  - id: US-001
    title: Test user story
    
functional_requirements:
  - id: FR-001
    title: Test requirement
    
_metadata:
  generated_at: "2024-01-15T10:30:00.000Z"
  schema_version: "1.0"
`);
    
    await fs.writeFile(invalidYamlFile, `user_stories:
  - id: US-001
    title: Test user story
  invalid_indentation:
    bad indentation here
`);
  });
  
  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${tempDir}`);
    }
  });
  
  it('should check valid markdown and YAML files successfully', async () => {
    const result = await syntaxCheckerTool({
      description: 'Test valid files',
      files: [
        { path: markdownFile },
        { path: yamlFile }
      ]
    });
    
    expect(result.success).toBe(true);
    expect(result.totalFiles).toBe(2);
    expect(result.processedFiles).toBe(2);
    expect(result.skippedFiles).toEqual([]);
    
    // 应该检测到 markdown 的行长度问题
    const markdownIssues = result.issues.filter(issue => issue.file === markdownFile);
    expect(markdownIssues.length).toBeGreaterThan(0);
    expect(markdownIssues.some(issue => issue.rule === 'MD013')).toBe(true);
  });
  
  it('should handle YAML syntax errors', async () => {
    const result = await syntaxCheckerTool({
      description: 'Test YAML syntax error',
      files: [
        { path: invalidYamlFile }
      ]
    });
    
    expect(result.success).toBe(true); // 工具执行成功
    expect(result.processedFiles).toBe(1);
    
    // 应该检测到 YAML 语法错误
    const yamlIssues = result.issues.filter(issue => issue.file === invalidYamlFile);
    expect(yamlIssues.length).toBeGreaterThan(0);
    expect(yamlIssues.some(issue => issue.severity === 'error')).toBe(true);
  });
  
  it('should skip unsupported file types with warnings', async () => {
    // 创建不支持的文件
    const jsFile = path.join(tempDir, 'script.js');
    await fs.writeFile(jsFile, 'console.log("test");');
    
    const result = await syntaxCheckerTool({
      description: 'Test mixed file types',
      files: [
        { path: markdownFile },
        { path: jsFile },
        { path: yamlFile }
      ]
    });
    
    expect(result.success).toBe(true);
    expect(result.totalFiles).toBe(3);
    expect(result.processedFiles).toBe(2); // 只处理 md 和 yaml
    expect(result.skippedFiles).toContain(jsFile);
  });
  
  it('should handle file access errors gracefully', async () => {
    const nonExistentFile = path.join(tempDir, 'non-existent.md');
    
    const result = await syntaxCheckerTool({
      description: 'Test file access error',
      files: [
        { path: markdownFile },      // 存在的文件
        { path: nonExistentFile }    // 不存在的文件
      ]
    });
    
    expect(result.success).toBe(true); // 工具仍然成功执行
    expect(result.processedFiles).toBe(2); // 两个文件都被"处理"了
    
    // 不存在的文件应该生成错误问题
    const fileIssues = result.issues.filter(issue => issue.file === nonExistentFile);
    expect(fileIssues.length).toBeGreaterThan(0);
    expect(fileIssues[0].severity).toBe('error');
    expect(fileIssues[0].message).toContain('File access failed');
  });
  
  it('should handle empty file list', async () => {
    const result = await syntaxCheckerTool({
      description: 'Test empty file list',
      files: []
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('No files provided');
  });
  
  it('should generate quality report file', async () => {
    // Mock SessionContext to return a known project name
    const mockSessionContext = {
      getProjectName: jest.fn().mockReturnValue('test-project'),
      getBaseDir: jest.fn().mockReturnValue(tempDir)
    };
    
    // 需要 mock SessionContext.getInstance()
    jest.doMock('../../../core/SessionContext', () => ({
      SessionContext: {
        getInstance: jest.fn().mockReturnValue(mockSessionContext)
      }
    }));
    
    const result = await syntaxCheckerTool({
      description: 'Test report generation',
      files: [
        { path: markdownFile },
        { path: yamlFile }
      ]
    });
    
    expect(result.success).toBe(true);
    
    // 检查报告文件是否生成
    const reportPath = path.join(tempDir, 'srs_quality_check_report_test-project.json');
    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
    expect(reportExists).toBe(true);
    
    if (reportExists) {
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      
      expect(report.projectName).toBe('test-project');
      expect(report.checks).toBeDefined();
      expect(Array.isArray(report.checks)).toBe(true);
    }
  });
});
