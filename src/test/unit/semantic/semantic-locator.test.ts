/**
 * SemanticLocator单元测试
 * 
 * 测试语义定位功能，确保能准确定位文档中的目标位置
 */

import * as vscode from 'vscode';
import { SemanticLocator, SemanticTarget, LocationResult } from '../../../tools/atomic/semantic-locator';
import { DocumentStructure, SectionInfo } from '../../../tools/atomic/document-analyzer';

describe('SemanticLocator', () => {
    let locator: SemanticLocator;
    let mockStructure: DocumentStructure;

    beforeEach(() => {
        mockStructure = createMockDocumentStructure();
        locator = new SemanticLocator(mockStructure);
    });

    describe('findTarget', () => {
        it('should find exact section match', () => {
            const target: SemanticTarget = {
                sectionName: '功能需求',
                position: 'replace'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            expect(result.range?.start.line).toBe(0);
        });

        it('should find section with fuzzy matching', () => {
            const target: SemanticTarget = {
                sectionName: '用户',
                position: 'replace'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
        });

        it('should return not found for non-existent section', () => {
            const target: SemanticTarget = {
                sectionName: '不存在的章节',
                position: 'replace'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(false);
            expect(result.range).toBeUndefined();
        });

        it('should handle before position correctly', () => {
            const target: SemanticTarget = {
                sectionName: '功能需求',
                position: 'before'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.insertionPoint).toBeDefined();
            expect(result.insertionPoint?.line).toBe(0);
        });

        it('should handle after position correctly', () => {
            const target: SemanticTarget = {
                sectionName: '功能需求',
                position: 'after'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.insertionPoint).toBeDefined();
            expect(result.insertionPoint?.line).toBeGreaterThan(0);
        });

        it('should provide context information', () => {
            const target: SemanticTarget = {
                sectionName: '用户管理',
                position: 'replace'
            };

            const result = locator.findTarget(target);

            expect(result.found).toBe(true);
            expect(result.context).toBeDefined();
            expect(result.context?.beforeText).toBe('功能需求');
            expect(result.context?.afterText).toBe('数据管理');
        });
    });

    describe('findSectionByName', () => {
        it('should find exact match', () => {
            const section = locator.findSectionByName('功能需求');

            expect(section).toBeDefined();
            expect(section?.name).toBe('功能需求');
        });

        it('should find fuzzy match', () => {
            const section = locator.findSectionByName('用户');

            expect(section).toBeDefined();
            expect(section?.name).toBe('用户管理');
        });

        it('should return undefined for no match', () => {
            const section = locator.findSectionByName('完全不匹配的名称');

            expect(section).toBeUndefined();
        });

        it('should handle case insensitive matching', () => {
            const section = locator.findSectionByName('功能需求');

            expect(section).toBeDefined();
            expect(section?.name).toBe('功能需求');
        });
    });

    describe('calculateInsertionPoint', () => {
        it('should calculate before position correctly', () => {
            const section = mockStructure.sections[0];
            const insertionPoint = locator.calculateInsertionPoint(section, 'before');

            expect(insertionPoint.line).toBe(section.range.start.line);
            expect(insertionPoint.character).toBe(section.range.start.character);
        });

        it('should calculate after position correctly', () => {
            const section = mockStructure.sections[0];
            const insertionPoint = locator.calculateInsertionPoint(section, 'after');

            expect(insertionPoint.line).toBeGreaterThan(section.range.end.line);
        });
    });
});

// ============================================================================
// 测试辅助函数
// ============================================================================

function createMockDocumentStructure(): DocumentStructure {
    const sections: SectionInfo[] = [
        {
            name: '功能需求',
            level: 1,
            range: new vscode.Range(0, 0, 1, 0),
            content: '# 功能需求\n',
            subsections: [],
            selector: "section('功能需求')"
        },
        {
            name: '用户管理',
            level: 2,
            range: new vscode.Range(2, 0, 4, 0),
            content: '## 用户管理\n用户注册和登录功能\n',
            subsections: [],
            selector: "section('用户管理')"
        },
        {
            name: '数据管理',
            level: 2,
            range: new vscode.Range(5, 0, 7, 0),
            content: '## 数据管理\n数据存储和检索功能\n',
            subsections: [],
            selector: "section('数据管理')"
        }
    ];

    const headings = [
        {
            level: 1,
            text: '功能需求',
            line: 1,
            range: new vscode.Range(0, 0, 0, 6),
            selector: "h1:section('功能需求')"
        },
        {
            level: 2,
            text: '用户管理',
            line: 3,
            range: new vscode.Range(2, 0, 2, 6),
            selector: "h2:section('用户管理')"
        },
        {
            level: 2,
            text: '数据管理',
            line: 6,
            range: new vscode.Range(5, 0, 5, 6),
            selector: "h2:section('数据管理')"
        }
    ];

    return {
        sections,
        headings,
        symbols: [],
        symbolMap: new Map()
    };
} 