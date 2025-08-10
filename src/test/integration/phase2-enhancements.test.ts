/**
 * 🆕 Phase 2 增强功能测试
 * 
 * 验证Phase 2新增的智能错误提示、格式验证、缓存优化等功能
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';
import { Logger } from '../../utils/logger';

// Mock VSCode
jest.mock('vscode', () => ({
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file', path }))
    },
    workspace: {
        applyEdit: jest.fn().mockResolvedValue(true)
    },
    Range: jest.fn((start, end) => ({ start, end })),
    Position: jest.fn((line, char) => ({ line, character: char })),
    WorkspaceEdit: jest.fn(() => ({
        replace: jest.fn(),
        insert: jest.fn()
    }))
}));

const logger = Logger.getInstance();

describe('🆕 Phase 2 增强功能测试', () => {
    beforeEach(() => {
        Logger.resetInstance();
        jest.clearAllMocks();
    });

    const mockMarkdownContent = `# 第一章 项目背景
项目背景介绍内容第一行
项目背景介绍内容第二行

## 1.1 技术架构
技术架构内容
更多技术架构内容`;

    const mockTocData: TableOfContents[] = [
        {
            sid: '/first-chapter',
            title: '第一章 项目背景',
            normalizedTitle: '项目背景',
            level: 1,
            line: 1,
            endLine: 7
        },
        {
            sid: '/first-chapter/tech-architecture',
            title: '1.1 技术架构',
            normalizedTitle: '技术架构',
            level: 2,
            line: 5,
            endLine: 7
        }
    ];

    describe('SID格式验证功能', () => {
        test('应该正确验证合法的SID格式', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter',
            });
            
            expect(result.found).toBe(true);
        });

        test('应该拒绝不以/开头的SID', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: 'first-chapter', // 缺少开头的 /
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("must start with '/'");
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions?.correctedSid).toBe('/first-chapter');
        });

        test('应该拒绝包含连续斜杠的SID', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter//tech-architecture', // 连续的斜杠
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("consecutive slashes");
            expect(result.suggestions?.correctedSid).toBe('/first-chapter/tech-architecture');
        });

        test('应该拒绝以斜杠结尾的SID', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter/', // 结尾的斜杠
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("should not end with '/'");
            expect(result.suggestions?.correctedSid).toBe('/first-chapter');
        });

        test('应该拒绝包含无效字符的SID', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first@chapter', // 包含无效字符 @
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("invalid characters");
            expect(result.suggestions?.correctedSid).toBe('/first-chapter');
        });
    });

    describe('智能错误提示功能', () => {
        test('应该为不存在的SID提供相似SID建议', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter-typo', // 打字错误
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("not found");
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions?.availableSids).toEqual(expect.arrayContaining([
                '/first-chapter',
                '/first-chapter/tech-architecture'
            ]));
        });

        test('应该提供可用SID列表', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/non-existent',
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("not found");
            expect(result.suggestions?.availableSids).toBeDefined();
        });
    });

    describe('行号范围验证功能', () => {
        test('应该验证行号超出范围的情况', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter/tech-architecture',
                lineRange: { startLine: 10, endLine: 10 } // 超出范围
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("out of range");
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions?.validRange).toBeDefined();
        });

        test('应该验证负数行号', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter/tech-architecture',
                lineRange: { startLine: -1, endLine: -1 }
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("out of range");
            expect(result.suggestions?.validRange).toBeDefined();
        });

        test('应该验证endLine小于startLine的情况', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            const result = locator.findTarget({
                sid: '/first-chapter/tech-architecture',
                lineRange: { startLine: 3, endLine: 1 }
            });
            
            expect(result.found).toBe(false);
            expect(result.error).toContain("Invalid line range");
            expect(result.suggestions?.validRange).toBeDefined();
        });
    });

    describe('缓存优化功能', () => {
        test('应该缓存查找结果', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            // 第一次查找
            const result1 = locator.findTarget({
                sid: '/first-chapter',
            });
            
            // 第二次查找（应该命中缓存）
            const result2 = locator.findTarget({
                sid: '/first-chapter',
            });
            
            expect(result1.found).toBe(true);
            expect(result2.found).toBe(true);
            
            // 验证缓存统计
            const stats = locator.getCacheStats();
            expect(stats.locationCacheSize).toBeGreaterThan(0);
        });

        test('应该能清理缓存', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            // 先进行一些查找以填充缓存
            locator.findTarget({ sid: '/first-chapter' });
            
            // 验证缓存有内容
            const statsBefore = locator.getCacheStats();
            expect(statsBefore.locationCacheSize).toBeGreaterThan(0);
            
            // 清理缓存
            locator.clearCache();
            
            // 验证缓存已清空
            const statsAfter = locator.getCacheStats();
            expect(statsAfter.locationCacheSize).toBe(0);
            expect(statsAfter.nearbyLinesCacheSize).toBe(0);
        });
    });

    describe('readMarkdownFile兼容性', () => {
        test('应该兼容带displayId的TableOfContents', () => {
            const enhancedTocData: TableOfContents[] = [
                {
                    sid: '/section-1',
                    displayId: '1',
                    title: 'Section 1',
                    normalizedTitle: 'Section 1',
                    level: 1,
                    line: 1,
                    wordCount: 100,
                    characterCount: 500,
                    containsCode: false,
                    containsTables: true,
                    parent: undefined,
                    siblingIndex: 0,
                    siblingCount: 1
                }
            ];
            
            const content = '# Section 1\nSome content here';
            const locator = new SidBasedSemanticLocator(content, enhancedTocData);
            
            const result = locator.findTarget({
                sid: '/section-1',
            });
            
            expect(result.found).toBe(true);
        });

        test('应该兼容不带displayId的TableOfContents', () => {
            const basicTocData: TableOfContents[] = [
                {
                    sid: '/section-1',
                    title: 'Section 1',
                    normalizedTitle: 'Section 1',
                    level: 1,
                    line: 1
                }
            ];
            
            const content = '# Section 1\nSome content here';
            const locator = new SidBasedSemanticLocator(content, basicTocData);
            
            const result = locator.findTarget({
                sid: '/section-1',
            });
            
            expect(result.found).toBe(true);
        });
    });

    describe('性能统计和调试信息', () => {
        test('应该记录详细的初始化日志', () => {
            // 使用spy来捕获日志
            const infoSpy = jest.spyOn(logger, 'info');
            const debugSpy = jest.spyOn(logger, 'debug');
            
            new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            
            expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('SidBasedSemanticLocator initialized'));
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Content stats:'));
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Available SIDs:'));
            expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Level distribution:'));
        });

        test('应该记录查找操作的日志', () => {
            const infoSpy = jest.spyOn(logger, 'info');
            
            const locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
            locator.findTarget({
                sid: '/first-chapter',
            });
            
            expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Locating target:'));
        });
    });
});
