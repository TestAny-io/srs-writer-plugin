/**
 * SID特殊字符处理集成测试
 * 
 * 🎯 目标：测试完整的readMarkdownFile → executeMarkdownEdits工作流
 * 
 * 测试场景：模拟真实的Specialist工作流，从读取包含特殊字符的文档，
 * 到成功执行语义编辑。
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import { semanticEditEngineToolImplementations } from '../../tools/document/semantic-edit-engine';

describe('SID特殊字符处理集成测试', () => {
    let tempDir: string;
    let testFile: vscode.Uri;

    beforeEach(async () => {
        // 创建临时目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sid-integration-test-'));
        testFile = vscode.Uri.file(path.join(tempDir, 'test.md'));
    });

    afterEach(async () => {
        // 清理临时文件
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    // Helper: 扁平化TOC树
    const flattenToc = (nodes: any[]): any[] => {
        let result: any[] = [];
        for (const node of nodes) {
            result.push(node);
            if (node.children && node.children.length > 0) {
                result = result.concat(flattenToc(node.children));
            }
        }
        return result;
    };

    /**
     * 🎯 原始Bug场景的端到端测试
     */
    it('Bug修复验证：包含 & 符号的标题应该能够成功编辑', async () => {
        // 1. 创建包含 & 符号的文档（原始bug场景）
        const originalContent = `# SRS Document

## 1. 非功能需求 (Non-Functional Requirements)

### 数据隐私与安全需求 (Data Privacy & Security Requirements)

Current content here.

## 2. 其他需求

Some other content.
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        // 2. Specialist首先调用readMarkdownFile获取TOC
        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        expect(readResult.tableOfContentsToCTree).toBeDefined();
        
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        // 3. 找到包含 & 的章节
        const targetSection = toc.find((s: any) => 
            s.title.includes('Data Privacy & Security')
        );
        expect(targetSection).toBeDefined();
        
        const targetSid = targetSection.sid;
        console.log(`📍 目标章节SID: ${targetSid}`);

        // 4. Specialist使用这个SID进行编辑（原始bug在这里失败）
        const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
            targetFile: testFile.fsPath,
            intents: [{
                type: 'replace_section_content_only',
                target: {
                    sid: targetSid,
                    lineRange: { startLine: 1, endLine: 1 }
                },
                content: 'Updated content: Security measures implemented.',
                reason: '更新数据隐私与安全需求内容',
                priority: 1
            }]
        });

        // 5. 🎯 关键断言：编辑应该成功（修复前会失败）
        expect(editResult.success).toBe(true);
        expect(editResult.successfulIntents).toBe(1);
        expect(editResult.failedIntents.length).toBe(0);

        // 6. 验证文件内容已更新
        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Updated content: Security measures implemented.');
        expect(updatedContent).toContain('数据隐私与安全需求 (Data Privacy & Security Requirements)');
    });

    /**
     * 🎯 多种特殊字符的综合测试
     */
    it('应成功编辑包含各种特殊字符的章节', async () => {
        const originalContent = `# Document

## Section @ 符号

Content 1

## Section # 符号

Content 2

## Section $ 符号

Content 3

## Section & | * 组合

Content 4
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        // 读取TOC
        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        // 对每个特殊字符章节进行编辑
        const sectionsToEdit = toc.filter((s: any) => s.title.includes('Section'));
        expect(sectionsToEdit.length).toBe(4);

        for (const section of sectionsToEdit) {
            const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
                targetFile: testFile.fsPath,
                intents: [{
                    type: 'replace_section_content_only',
                    target: {
                        sid: section.sid,
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: `Updated: ${section.title}`,
                    reason: `更新 ${section.title}`,
                    priority: 1
                }]
            });

            // 每个编辑都应该成功
            expect(editResult.success).toBe(true);
            expect(editResult.successfulIntents).toBe(1);
            expect(editResult.failedIntents.length).toBe(0);
        }

        // 验证所有内容都已更新
        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Updated: Section @ 符号');
        expect(updatedContent).toContain('Updated: Section # 符号');
        expect(updatedContent).toContain('Updated: Section $ 符号');
        expect(updatedContent).toContain('Updated: Section & | * 组合');
    });

    /**
     * 🎯 嵌套章节的特殊字符处理
     */
    it('应正确处理嵌套章节中的特殊字符', async () => {
        const originalContent = `# Document

## Parent Section

### Child A & B

Content A

### Child C | D

Content C

## Another Parent

### Child E @ F

Content E
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        // 找到所有子章节
        const childSections = toc.filter((s: any) => s.level === 3);
        expect(childSections.length).toBe(3);

        // 编辑所有子章节
        for (const section of childSections) {
            const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
                targetFile: testFile.fsPath,
                intents: [{
                    type: 'replace_section_content_only',
                    target: {
                        sid: section.sid,
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: `Nested updated: ${section.title}`,
                    reason: `更新嵌套章节 ${section.title}`,
                    priority: 1
                }]
            });

            expect(editResult.success).toBe(true);
            expect(editResult.successfulIntents).toBe(1);
        }

        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Nested updated: Child A & B');
        expect(updatedContent).toContain('Nested updated: Child C | D');
        expect(updatedContent).toContain('Nested updated: Child E @ F');
    });

    /**
     * 🎯 批量编辑测试
     */
    it('应支持批量编辑包含特殊字符的多个章节', async () => {
        const originalContent = `# Document

## API & SDK

Content 1

## Error Handling & Recovery

Content 2

## Configuration (key=value)

Content 3
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        // 构建批量编辑intents
        const sections = toc.filter((s: any) => s.level === 2);
        const intents = sections.map((section, index) => ({
            type: 'replace_section_content_only' as const,
            target: {
                sid: section.sid,
                lineRange: { startLine: 1, endLine: 1 }
            },
            content: `Batch updated ${index + 1}`,
            reason: `批量更新 ${section.title}`,
            priority: 1
        }));

        // 执行批量编辑
        const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
            targetFile: testFile.fsPath,
            intents
        });

        // 验证批量编辑成功
        expect(editResult.success).toBe(true);
        expect(editResult.successfulIntents).toBe(3);
        expect(editResult.failedIntents.length).toBe(0);

        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Batch updated 1');
        expect(updatedContent).toContain('Batch updated 2');
        expect(updatedContent).toContain('Batch updated 3');
    });

    /**
     * 🎯 插入新章节测试
     */
    it('应支持在包含特殊字符的章节后插入新内容', async () => {
        const originalContent = `# Document

## API & SDK

Existing content
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        const targetSection = toc.find((s: any) => s.title.includes('API & SDK'));
        expect(targetSection).toBeDefined();

        // 在章节末尾插入新内容
        const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
            targetFile: testFile.fsPath,
            intents: [{
                type: 'insert_section_content_only',
                target: {
                    sid: targetSection!.sid,
                    insertionPosition: 'after'
                },
                content: '\nNew API documentation here.',
                reason: '在API & SDK章节末尾插入新内容',
                priority: 1
            }]
        });

        expect(editResult.success).toBe(true);
        expect(editResult.successfulIntents).toBe(1);

        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Existing content');
        expect(updatedContent).toContain('New API documentation here.');
    });

    /**
     * 🎯 删除章节测试
     */
    it('应支持删除包含特殊字符的章节', async () => {
        const originalContent = `# Document

## Keep This

Content to keep

## Delete @ This

Content to delete

## Keep That

Content to keep
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        const targetSection = toc.find((s: any) => s.title.includes('Delete @ This'));
        expect(targetSection).toBeDefined();

        // 删除章节
        const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
            targetFile: testFile.fsPath,
            intents: [{
                type: 'delete_section_content_only',
                target: {
                    sid: targetSection!.sid
                },
                content: '',
                reason: '删除包含@的章节内容',
                priority: 1
            }]
        });

        expect(editResult.success).toBe(true);
        expect(editResult.successfulIntents).toBe(1);

        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Keep This');
        expect(updatedContent).toContain('Keep That');
        expect(updatedContent).toContain('Delete @ This'); // 标题保留
        expect(updatedContent).not.toContain('Content to delete'); // 内容被删除
    });

    /**
     * 🎯 多语言混合测试
     */
    it('应正确处理中英日韩混合标题中的特殊字符', async () => {
        const originalContent = `# Document

## データ & 分析 (Data & Analysis)

Japanese content

## 데이터 @ 분석 (Data @ Analysis)

Korean content

## 数据 # 分析 (Data # Analysis)

Chinese content
`;
        await fs.writeFile(testFile.fsPath, originalContent, 'utf-8');

        const readResult = await readMarkdownFile({
            path: testFile.fsPath,
            parseMode: 'toc'
        });

        expect(readResult.success).toBe(true);
        const toc = flattenToc(readResult.tableOfContentsToCTree!);

        const sections = toc.filter((s: any) => s.level === 2);
        expect(sections.length).toBe(3);

        // 编辑所有多语言章节
        for (const section of sections) {
            const editResult = await semanticEditEngineToolImplementations.executeMarkdownEdits({
                targetFile: testFile.fsPath,
                intents: [{
                    type: 'replace_section_content_only',
                    target: {
                        sid: section.sid,
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: `Multilingual updated: ${section.title}`,
                    reason: `更新多语言章节 ${section.title}`,
                    priority: 1
                }]
            });

            expect(editResult.success).toBe(true);
            expect(editResult.successfulIntents).toBe(1);
        }

        const updatedContent = await fs.readFile(testFile.fsPath, 'utf-8');
        expect(updatedContent).toContain('Multilingual updated: データ & 分析');
        expect(updatedContent).toContain('Multilingual updated: 데이터 @ 분석');
        expect(updatedContent).toContain('Multilingual updated: 数据 # 分析');
    });
});

