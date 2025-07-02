/**
 * DocumentAnalyzer单元测试
 * 
 * 测试VSCode原生语义文档分析功能
 */

import * as vscode from 'vscode';
import { DocumentAnalyzer, DocumentStructure } from '../../../tools/atomic/document-analyzer';

describe('DocumentAnalyzer', () => {
    let analyzer: DocumentAnalyzer;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        analyzer = new DocumentAnalyzer();
        
        // Mock文档
        mockDocument = {
            fileName: 'test.md',
            uri: vscode.Uri.parse('file:///test.md'),
            getText: jest.fn().mockReturnValue(sampleMarkdownContent),
            lineCount: 20,
            languageId: 'markdown'
        } as any;
    });

    describe('analyzeDocument', () => {
        it('should analyze markdown document structure', async () => {
            // Mock VSCode的executeCommand返回模拟符号
            const mockSymbols = createMockDocumentSymbols();
            jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

            const result = await analyzer.analyzeDocument(mockDocument);

            expect(result).toBeDefined();
            expect(result.headings).toHaveLength(3);
            expect(result.sections).toHaveLength(3);
            expect(result.symbols).toBe(mockSymbols);
        });

        it('should handle documents with no symbols', async () => {
            jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue([]);

            const result = await analyzer.analyzeDocument(mockDocument);

            expect(result.headings).toHaveLength(0);
            expect(result.sections).toHaveLength(0);
            expect(result.symbols).toHaveLength(0);
        });

        it('should handle nested headings correctly', async () => {
            const nestedSymbols = createNestedMockSymbols();
            jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(nestedSymbols);

            const result = await analyzer.analyzeDocument(mockDocument);

            expect(result.headings).toHaveLength(4);
            expect(result.headings[0].level).toBe(1);
            expect(result.headings[1].level).toBe(2);
            expect(result.headings[2].level).toBe(2);
            expect(result.headings[3].level).toBe(3);
        });

        it('should generate correct selectors', async () => {
            const mockSymbols = createMockDocumentSymbols();
            jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

            const result = await analyzer.analyzeDocument(mockDocument);

            expect(result.headings[0].selector).toBe("h1:section('功能需求')");
            expect(result.headings[1].selector).toBe("h2:section('用户管理')");
            expect(result.sections[0].selector).toBe("section('功能需求')");
        });
    });

    describe('getDocumentSymbols', () => {
        it('should return symbols from VSCode API', async () => {
            const mockSymbols = createMockDocumentSymbols();
            jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

            const result = await analyzer.getDocumentSymbols(mockDocument.uri);

            expect(result).toBe(mockSymbols);
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'vscode.executeDocumentSymbolProvider',
                mockDocument.uri
            );
        });

        it('should handle API errors gracefully', async () => {
            jest.spyOn(vscode.commands, 'executeCommand').mockRejectedValue(new Error('API Error'));

            const result = await analyzer.getDocumentSymbols(mockDocument.uri);

            expect(result).toEqual([]);
        });
    });
});

// ============================================================================
// 测试辅助函数
// ============================================================================

const sampleMarkdownContent = `# 功能需求

## 用户管理
用户注册和登录功能

## 数据管理
数据存储和检索功能

### 数据库设计
表结构设计
`;

function createMockDocumentSymbols(): vscode.DocumentSymbol[] {
    return [
        new vscode.DocumentSymbol(
            '# 功能需求',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(0, 0, 0, 6),
            new vscode.Range(0, 0, 0, 6)
        ),
        new vscode.DocumentSymbol(
            '## 用户管理',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(2, 0, 2, 6),
            new vscode.Range(2, 0, 2, 6)
        ),
        new vscode.DocumentSymbol(
            '## 数据管理',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(5, 0, 5, 6),
            new vscode.Range(5, 0, 5, 6)
        )
    ];
}

function createNestedMockSymbols(): vscode.DocumentSymbol[] {
    const parentSymbol = new vscode.DocumentSymbol(
        '# 主要功能',
        '',
        vscode.SymbolKind.String,
        new vscode.Range(0, 0, 0, 6),
        new vscode.Range(0, 0, 0, 6)
    );

    const childSymbol1 = new vscode.DocumentSymbol(
        '## 用户功能',
        '',
        vscode.SymbolKind.String,
        new vscode.Range(2, 0, 2, 6),
        new vscode.Range(2, 0, 2, 6)
    );

    const childSymbol2 = new vscode.DocumentSymbol(
        '## 管理功能',
        '',
        vscode.SymbolKind.String,
        new vscode.Range(5, 0, 5, 6),
        new vscode.Range(5, 0, 5, 6)
    );

    const grandChildSymbol = new vscode.DocumentSymbol(
        '### 权限管理',
        '',
        vscode.SymbolKind.String,
        new vscode.Range(7, 0, 7, 8),
        new vscode.Range(7, 0, 7, 8)
    );

    childSymbol2.children = [grandChildSymbol];
    parentSymbol.children = [childSymbol1, childSymbol2];

    return [parentSymbol];
} 