/**
 * readTextFile 工具功能测试
 * 
 * 验证重构后的 readTextFile 工具能够正确读取各种文本文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { readTextFile } from '../../tools/atomic/filesystem-tools';

// Mock VSCode API
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/mock/workspace/root'
                }
            }
        ]
    }
}));

// Mock SessionManager
const mockGetCurrentSession = jest.fn();
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: () => ({
            getCurrentSession: mockGetCurrentSession
        })
    }
}));

// Mock Logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        })
    }
}));

describe('ReadTextFile Functionality Tests', () => {
    let tempDir: string;
    let testFiles: { [key: string]: string } = {};

    beforeAll(async () => {
        // 创建临时测试目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'readTextFile-test-'));
        
        // 创建各种测试文件
        const testData = {
            'config.json': JSON.stringify({
                name: 'test-project',
                version: '1.0.0',
                settings: { debug: true }
            }, null, 2),
            'data.txt': 'Hello World\nThis is a text file.',
            'script.js': 'console.log("Hello from JS");',
            'style.css': 'body { margin: 0; padding: 0; }',
            'config.xml': '<config><setting>value</setting></config>',
            'README.md': '# Test Project\n\nThis is a test.',
            'package.lock': '{"lockfileVersion": 1}',
            'empty.txt': '',
            'large.json': JSON.stringify({ data: 'x'.repeat(1000) })
        };

        for (const [fileName, content] of Object.entries(testData)) {
            const filePath = path.join(tempDir, fileName);
            await fs.writeFile(filePath, content);
            testFiles[fileName] = filePath;
        }

        // Mock SessionContext 返回测试目录作为 baseDir
        mockGetCurrentSession.mockResolvedValue({
            baseDir: tempDir
        });
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('清理测试目录失败:', error);
        }
    });

    describe('JSON文件读取', () => {
        it('应该成功读取并解析JSON文件', async () => {
            const result = await readTextFile({
                path: 'config.json'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.fileType).toBe('json');
            expect(result.fileSize).toBeGreaterThan(0);

            // 验证JSON内容可以解析
            const jsonData = JSON.parse(result.content!);
            expect(jsonData.name).toBe('test-project');
            expect(jsonData.version).toBe('1.0.0');
            expect(jsonData.settings.debug).toBe(true);
        });

        it('应该读取复杂JSON文件', async () => {
            const result = await readTextFile({
                path: 'large.json'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.fileType).toBe('json');
            
            const jsonData = JSON.parse(result.content!);
            expect(jsonData.data).toHaveLength(1000);
        });
    });

    describe('多种文本格式支持', () => {
        it('应该读取纯文本文件', async () => {
            const result = await readTextFile({
                path: 'data.txt'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('Hello World\nThis is a text file.');
            expect(result.fileType).toBe('txt');
        });

        it('应该读取JavaScript文件', async () => {
            const result = await readTextFile({
                path: 'script.js'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('console.log("Hello from JS");');
            expect(result.fileType).toBe('js');
        });

        it('应该读取CSS文件', async () => {
            const result = await readTextFile({
                path: 'style.css'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('body { margin: 0; padding: 0; }');
            expect(result.fileType).toBe('css');
        });

        it('应该读取XML文件', async () => {
            const result = await readTextFile({
                path: 'config.xml'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('<config><setting>value</setting></config>');
            expect(result.fileType).toBe('xml');
        });

        it('应该拒绝Markdown文件（使用专门工具）', async () => {
            const result = await readTextFile({
                path: 'README.md'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file type: .md');
        });

        it('应该读取无扩展名文件', async () => {
            const result = await readTextFile({
                path: 'package.lock'
            });

            expect(result.success).toBe(true);
            expect(result.fileType).toBe('lock');
        });

        it('应该读取空文件', async () => {
            const result = await readTextFile({
                path: 'empty.txt'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.fileSize).toBe(0);
        });
    });

    describe('错误处理', () => {
        it('应该拒绝不支持的文件类型', async () => {
            // 创建一个假的二进制文件
            const binaryFile = path.join(tempDir, 'test.docx');
            await fs.writeFile(binaryFile, Buffer.from([0x50, 0x4B])); // ZIP header

            const result = await readTextFile({
                path: 'test.docx'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file type: .docx');
        });

        it('应该拒绝YAML文件（使用专门工具）', async () => {
            // 创建一个YAML文件
            const yamlFile = path.join(tempDir, 'config.yaml');
            await fs.writeFile(yamlFile, 'key: value\n');

            const result = await readTextFile({
                path: 'config.yaml'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported file type: .yaml');
        });

        it('应该处理文件不存在的情况', async () => {
            const result = await readTextFile({
                path: 'non-existent.json'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
        });

        it('应该处理目录而不是文件的情况', async () => {
            // 创建一个目录
            const dirPath = path.join(tempDir, 'test-dir');
            await fs.mkdir(dirPath);

            const result = await readTextFile({
                path: 'test-dir'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Path is not a file');
        });
    });

    describe('编码支持', () => {
        it('应该支持UTF-8编码（默认）', async () => {
            const result = await readTextFile({
                path: 'config.json'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });

        it('应该支持指定编码', async () => {
            const result = await readTextFile({
                path: 'config.json',
                encoding: 'utf-8'
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });
    });

    describe('路径解析集成', () => {
        it('应该使用SessionContext的baseDir', async () => {
            // 这个测试验证路径解析集成是否正常工作
            const result = await readTextFile({
                path: 'config.json'  // 相对路径
            });

            expect(result.success).toBe(true);
            // 如果路径解析正确，应该能找到文件
        });

        it('应该处理绝对路径', async () => {
            const absolutePath = testFiles['config.json'];
            
            const result = await readTextFile({
                path: absolutePath  // 绝对路径
            });

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
        });
    });
});
