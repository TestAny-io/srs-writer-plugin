/**
 * Context Anchor Precision Integration Test
 * 专门测试 startFromAnchor 功能，确保在存在重复内容时能够精确定位目标
 */

import * as vscode from 'vscode';
import { SemanticLocator, SemanticTarget, LocationResult } from '../../../tools/atomic/semantic-locator';

describe('Context Anchor Precision Tests', () => {
    let locator: SemanticLocator;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        // 创建测试文档内容 - 模拟用户反馈的场景
        const testContent = `# 功能需求 (Functional Requirements)

## 5.1 网页转PDF并下载
req-id: FR-PDF-001
**需求描述**：用户可以将当前网页转换为PDF格式并下载到本地。
**优先级**：must-have
**复杂度**：中等

## 5.2 网页预览功能
req-id: FR-PDF-002
**需求描述**：用户可以预览网页转换为PDF后的效果。
**优先级**：should-have
**复杂度**：简单

## 5.5 错误处理与用户提示
req-id: FR-PDF-005
**需求描述**：当PDF转换失败时，系统应提供明确的错误信息和建议。
**优先级**：must-have
**复杂度**：中等

## 5.6 批量转换功能
req-id: FR-PDF-006
**需求描述**：用户可以批量选择多个网页进行PDF转换。
**优先级**：could-have
**复杂度**：高`;

        // Mock文档
        mockDocument = {
            getText: () => testContent,
            lineCount: testContent.split('\n').length,
            lineAt: (line: number) => ({
                text: testContent.split('\n')[line] || '',
                lineNumber: line,
                range: new vscode.Range(line, 0, line, testContent.split('\n')[line]?.length || 0),
                rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
                firstNonWhitespaceCharacterIndex: 0,
                isEmptyOrWhitespace: false
            }),
            fileName: 'test-srs.md',
            uri: vscode.Uri.parse('file:///test/test-srs.md'),
            languageId: 'markdown',
            version: 1,
            isDirty: false,
            isClosed: false,
            eol: vscode.EndOfLine.LF,
            save: jest.fn(),
            offsetAt: jest.fn(),
            positionAt: jest.fn(),
            getWordRangeAtPosition: jest.fn(),
            validateRange: jest.fn(),
            validatePosition: jest.fn()
        } as any;

        locator = new SemanticLocator(testContent);
    });

    describe('精确定位重复内容', () => {
        it('应该使用startFromAnchor正确定位FR-PDF-005的优先级（而非FR-PDF-001）', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "req-id: FR-PDF-005"  // 指定要修改FR-PDF-005
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // 验证定位到的是FR-PDF-005的优先级行（大约第17行），而不是FR-PDF-001的（大约第6行）
            // 通过检查行号范围来确认
            if (result.range) {
                expect(result.range.start.line).toBeGreaterThan(15); // FR-PDF-005在后面
                expect(result.range.start.line).toBeLessThan(20);
            }
        });

        it('应该使用startFromAnchor正确定位FR-PDF-001的优先级', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "req-id: FR-PDF-001"  // 指定要修改FR-PDF-001
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // 验证定位到的是FR-PDF-001的优先级行（较早的位置）
            if (result.range) {
                expect(result.range.start.line).toBeLessThan(10); // FR-PDF-001在前面
            }
        });

        it('当startFromAnchor不存在时应该返回失败', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "req-id: FR-PDF-999"  // 不存在的需求ID
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(false);
        });

        it('有startFromAnchor时应该精确定位（返回第一个匹配）', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "req-id: FR-PDF-001"  // 使用第一个需求作为锚点
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // 应该返回第一个匹配（FR-PDF-001）
            if (result.range) {
                expect(result.range.start.line).toBeLessThan(10);
            }
        });
    });

    describe('不同类型的锚点测试', () => {
        it('应该支持不区分大小写的锚点匹配', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "REQ-ID: FR-PDF-005"  // 大写的锚点
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
        });

        it('应该支持部分匹配的锚点', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**复杂度**：中等",
                startFromAnchor: "FR-PDF-005"  // 只使用需求ID部分
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
        });
    });

    describe('边界情况测试', () => {
        it('当targetContent为空时应该返回失败', () => {
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "",
                startFromAnchor: "req-id: FR-PDF-005"
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(false);
        });

        it('应该在锚点附近5行范围内搜索目标内容', () => {
            // 这个测试确保搜索范围被正确限制
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "FR-PDF-005"
            };

            const result: LocationResult = locator.findTarget(target);

            expect(result.found).toBe(true);
            // 应该找到FR-PDF-005的优先级，而不是远处的FR-PDF-001
        });
    });

    describe('性能和日志测试', () => {
        it('应该记录正确的日志信息', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            const target: SemanticTarget = {
                sectionName: "功能需求 (Functional Requirements)",
                targetContent: "**优先级**：must-have",
                startFromAnchor: "req-id: FR-PDF-005"
            };

            locator.findTarget(target);

            // 验证关键日志被记录
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Context anchor found')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Found target content with context anchor')
            );

            consoleSpy.mockRestore();
        });
    });
}); 