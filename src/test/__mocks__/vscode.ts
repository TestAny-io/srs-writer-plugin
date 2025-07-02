/**
 * VSCode API Mock for Jest Tests
 * 模拟VSCode的主要API供测试使用
 */

// Mock VSCode URI
export class Uri {
    public scheme: string;
    public authority: string;
    public path: string;
    public query: string;
    public fragment: string;
    public fsPath: string;

    constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
        this.fsPath = path;
    }

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        return new Uri('file', '', value, '', '');
    }

    toString(): string {
        return `${this.scheme}://${this.authority}${this.path}`;
    }
}

// Mock VSCode Position
export class Position {
    constructor(public line: number, public character: number) {}
}

// Mock VSCode Range
export class Range {
    constructor(
        public start: Position,
        public end: Position
    ) {}

    contains(positionOrRange: Position | Range): boolean {
        return true;
    }
}

// Mock WorkspaceEdit
export class WorkspaceEdit {
    private edits: Map<string, any[]> = new Map();

    createFile(uri: Uri, options?: { ignoreIfExists?: boolean }): void {
        // Mock implementation
    }

    deleteFile(uri: Uri): void {
        // Mock implementation
    }

    insert(uri: Uri, position: Position, content: string): void {
        const key = uri.toString();
        if (!this.edits.has(key)) {
            this.edits.set(key, []);
        }
        this.edits.get(key)!.push({ type: 'insert', position, content });
    }

    replace(uri: Uri, range: Range, content: string): void {
        const key = uri.toString();
        if (!this.edits.has(key)) {
            this.edits.set(key, []);
        }
        this.edits.get(key)!.push({ type: 'replace', range, content });
    }

    delete(uri: Uri, range: Range): void {
        const key = uri.toString();
        if (!this.edits.has(key)) {
            this.edits.set(key, []);
        }
        this.edits.get(key)!.push({ type: 'delete', range });
    }
}

// Mock TextDocument
export interface TextDocument {
    uri: Uri;
    fileName: string;
    isUntitled: boolean;
    languageId: string;
    version: number;
    isDirty: boolean;
    isClosed: boolean;
    lineCount: number;
    getText(range?: Range): string;
    getWordRangeAtPosition(position: Position): Range | undefined;
    lineAt(line: number): any;
}

// Mock DocumentSymbol
export class DocumentSymbol {
    constructor(
        public name: string,
        public detail: string,
        public kind: SymbolKind,
        public range: Range,
        public selectionRange: Range
    ) {}

    public children: DocumentSymbol[] = [];
}

// Mock SymbolKind
export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

// Mock workspace
export const workspace = {
    openTextDocument: jest.fn().mockResolvedValue({
        uri: Uri.file('test.md'),
        fileName: 'test.md',
        isUntitled: false,
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false,
        getText: jest.fn().mockReturnValue(`# 测试文档

## 用户旅程1

用户首先需要选择合适的平角裤，然后添加到购物车中。
接着用户需要填写收货地址和支付信息。

## 功能列表

- 用户登录功能
- 商品浏览功能
- 购物车管理

## 系统架构

本系统采用微服务架构。

## 安全要求

所有数据传输必须加密。
用户密码必须进行散列存储。`),
        lineCount: 20,
        lineAt: jest.fn().mockImplementation((lineNumber: number) => {
            const lines = [
                '# 测试文档',
                '',
                '## 用户旅程1',
                '',
                '用户首先需要选择合适的平角裤，然后添加到购物车中。',
                '接着用户需要填写收货地址和支付信息。',
                '',
                '## 功能列表',
                '',
                '- 用户登录功能',
                '- 商品浏览功能',
                '- 购物车管理',
                '',
                '## 系统架构',
                '',
                '本系统采用微服务架构。',
                '',
                '## 安全要求',
                '',
                '所有数据传输必须加密。',
                '用户密码必须进行散列存储。'
            ];
            return { text: lines[lineNumber] || '' };
        }),
        getWordRangeAtPosition: jest.fn().mockReturnValue(undefined)
    } as TextDocument),
    
    applyEdit: jest.fn().mockResolvedValue(true),
    
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
    })
};

// Mock commands
export const commands = {
    executeCommand: jest.fn().mockImplementation((command: string, uri: any) => {
        if (command === 'vscode.executeDocumentSymbolProvider') {
            // 返回符合测试文档内容的DocumentSymbol
            return Promise.resolve([
                new DocumentSymbol(
                    '# 测试文档',
                    '',
                    SymbolKind.String,
                    new Range(new Position(0, 0), new Position(13, 0)),
                    new Range(new Position(0, 0), new Position(0, 8))
                ),
                new DocumentSymbol(
                    '## 用户旅程1',
                    '',
                    SymbolKind.String,
                    new Range(new Position(2, 0), new Position(5, 0)),
                    new Range(new Position(2, 0), new Position(2, 7))
                ),
                new DocumentSymbol(
                    '## 功能列表',
                    '',
                    SymbolKind.String,
                    new Range(new Position(7, 0), new Position(11, 0)),
                    new Range(new Position(7, 0), new Position(7, 6))
                ),
                new DocumentSymbol(
                    '## 系统架构',
                    '',
                    SymbolKind.String,
                    new Range(new Position(13, 0), new Position(15, 0)),
                    new Range(new Position(13, 0), new Position(13, 6))
                ),
                new DocumentSymbol(
                    '## 安全要求',
                    '',
                    SymbolKind.String,
                    new Range(new Position(17, 0), new Position(20, 0)),
                    new Range(new Position(17, 0), new Position(17, 6))
                )
            ]);
        }
        return Promise.resolve([]);
    })
};

// Mock window
export const window = {
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn()
    }),
    
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn()
};

// Mock extensions
export const extensions = {
    getExtension: jest.fn().mockReturnValue({
        extensionPath: '/mock/extension/path'
    })
};

// Export all mocks
export default {
    Uri,
    Position,
    Range,
    WorkspaceEdit,
    DocumentSymbol,
    SymbolKind,
    workspace,
    commands,
    window,
    extensions
}; 