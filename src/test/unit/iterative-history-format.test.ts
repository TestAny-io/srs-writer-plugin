/**
 * Unit Tests for Iterative History Format Optimization
 * 
 * 测试 JSON → Markdown 转换逻辑（独立函数测试）
 */

// 🚀 为了避免复杂的依赖问题，将核心转换逻辑提取为独立函数进行测试
function jsonToMarkdownList(
    obj: any,
    indent: number,
    parentKey?: string,
    visited: Set<any> = new Set(),
    maxDepth: number = 15
): string {
    const startTime = indent === 1 ? Date.now() : 0;
    const indentStr = '  '.repeat(indent);
    let output = '';

    if (indent > maxDepth) {
        return `${indentStr}- [Max depth exceeded]\n`;
    }

    if (obj === null || obj === undefined) {
        return `${indentStr}- null\n`;
    }

    if (typeof obj === 'string') {
        if (obj.includes('\n')) {
            const lines = obj.split('\n');
            output += `${indentStr}- ${lines[0]}\n`;
            for (let i = 1; i < lines.length; i++) {
                output += `${indentStr}  ${lines[i]}\n`;
            }
            return output;
        }
        return `${indentStr}- ${obj}\n`;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return `${indentStr}- ${obj}\n`;
    }

    if (Array.isArray(obj)) {
        const MAX_ARRAY_ITEMS = 100;
        const itemsToShow = Math.min(obj.length, MAX_ARRAY_ITEMS);

        for (let index = 0; index < itemsToShow; index++) {
            const item = obj[index];
            const label = getArrayItemLabel(parentKey || 'items', index);

            if (typeof item === 'object' && item !== null) {
                output += `${indentStr}- ${label}:\n`;
                output += jsonToMarkdownList(item, indent + 1, undefined, visited, maxDepth);
            } else {
                output += `${indentStr}- ${label}: ${item}\n`;
            }
        }

        if (obj.length > MAX_ARRAY_ITEMS) {
            output += `${indentStr}- [... ${obj.length - MAX_ARRAY_ITEMS} more items]\n`;
        }

        return output;
    }

    if (typeof obj === 'object') {
        if (visited.has(obj)) {
            return `${indentStr}- [Circular Reference]\n`;
        }
        visited.add(obj);

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                output += `${indentStr}- ${key}: null\n`;
            } else if (Array.isArray(value)) {
                output += `${indentStr}- ${key}:\n`;
                output += jsonToMarkdownList(value, indent + 1, key, visited, maxDepth);
            } else if (typeof value === 'object') {
                output += `${indentStr}- ${key}:\n`;
                output += jsonToMarkdownList(value, indent + 1, undefined, visited, maxDepth);
            } else if (typeof value === 'string' && value.includes('\n')) {
                const lines = value.split('\n');
                output += `${indentStr}- ${key}: ${lines[0]}\n`;
                for (let i = 1; i < lines.length; i++) {
                    output += `${indentStr}  ${lines[i]}\n`;
                }
            } else {
                output += `${indentStr}- ${key}: ${value}\n`;
            }
        }

        return output;
    }

    return `${indentStr}- ${String(obj)}\n`;
}

function getArrayItemLabel(parentKey: string, index: number): string {
    const singularMap: { [key: string]: string } = {
        'intents': 'intent',
        'results': 'result',
        'targets': 'target',
        'edits': 'edit',
        'warnings': 'warning',
        'errors': 'error',
        'failedIntents': 'failed intent',
        'appliedIntents': 'applied intent',
        'items': 'item',
        'values': 'value',
        'entries': 'entry',
        'sections': 'section',
        'files': 'file'
    };

    const singular = singularMap[parentKey];
    if (singular) {
        return `${singular} #${index + 1}`;
    }

    return `[${index}]`;
}

describe('JSON to Markdown Conversion', () => {
    describe('jsonToMarkdownList', () => {

        test('应该正确处理基本类型', () => {
            expect(jsonToMarkdownList('string', 1)).toBe('  - string\n');
            expect(jsonToMarkdownList(123, 1)).toBe('  - 123\n');
            expect(jsonToMarkdownList(true, 1)).toBe('  - true\n');
            expect(jsonToMarkdownList(false, 1)).toBe('  - false\n');
            expect(jsonToMarkdownList(null, 1)).toBe('  - null\n');
        });

        test('应该正确处理嵌套对象', () => {
            const obj = { a: { b: { c: 'value' } } };
            const result = jsonToMarkdownList(obj, 1);
            
            expect(result).toContain('- a:');
            expect(result).toContain('- b:');
            expect(result).toContain('- c: value');
        });

        test('应该使用智能数组标签', () => {
            const obj = { intents: [{ type: 'replace' }, { type: 'insert' }] };
            const result = jsonToMarkdownList(obj, 1);
            
            expect(result).toContain('- intents:');
            expect(result).toContain('- intent #1:');
            expect(result).toContain('- intent #2:');
            expect(result).toContain('- type: replace');
            expect(result).toContain('- type: insert');
        });

        test('应该正确处理多行字符串', () => {
            const obj = { content: 'Line 1\nLine 2\nLine 3' };
            const result = jsonToMarkdownList(obj, 1);
            
            expect(result).toContain('- content: Line 1');
            expect(result).toContain('  Line 2');
            expect(result).toContain('  Line 3');
        });

        test('应该检测循环引用', () => {
            const obj: any = { a: {} };
            obj.a.b = obj;  // 循环引用
            
            expect(() => jsonToMarkdownList(obj, 1)).not.toThrow();
            const result = jsonToMarkdownList(obj, 1);
            expect(result).toContain('[Circular Reference]');
        });

        test('应该限制递归深度', () => {
            const deep = {
                a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'value' } } } } } } } } }
            };
            
            const result = jsonToMarkdownList(deep, 1, undefined, new Set(), 5);
            expect(result).toContain('[Max depth exceeded]');
        });

        test('应该限制数组大小', () => {
            const large = { data: Array(200).fill('item') };
            const result = jsonToMarkdownList(large, 1);
            
            expect(result).toContain('[... 100 more items]');
        });

        test('应该正确处理不同数组类型的标签', () => {
            const testCases = [
                { key: 'intents', value: [{ value: 'test' }] },
                { key: 'results', value: Array(6).fill({ value: 'test' }) },
                { key: 'targets', value: [{ value: 'test' }] },
                { key: 'failedIntents', value: [{}, {}] },
            ];

            testCases.forEach(({ key, value }) => {
                const obj = { [key]: value };
                const result = jsonToMarkdownList(obj, 1);
                expect(result).toContain(key + ':');
            });
        });

        test('应该正确处理复杂的executeMarkdownEdits参数', () => {
            const args = {
                targetFile: 'SRS.md',
                intents: [
                    {
                        type: 'replace_section_content_only',
                        target: {
                            sid: '/test/section',
                            lineRange: { startLine: 1, endLine: 10 }
                        },
                        content: 'Test content\nLine 2\nLine 3',
                        summary: 'Test summary'
                    }
                ]
            };

            const result = jsonToMarkdownList(args, 1);
            
            expect(result).toContain('- targetFile: SRS.md');
            expect(result).toContain('- intents:');
            expect(result).toContain('- intent #1:');
            expect(result).toContain('- type: replace_section_content_only');
            expect(result).toContain('- target:');
            expect(result).toContain('- sid: /test/section');
            expect(result).toContain('- content: Test content');
            expect(result).toContain('  Line 2');
            expect(result).toContain('  Line 3');
        });

        test('应该正确处理空对象和空数组', () => {
            const obj = {
                emptyObject: {},
                emptyArray: [],
                normalValue: 'test'
            };

            const result = jsonToMarkdownList(obj, 1);
            
            expect(result).toContain('- emptyObject:');
            expect(result).toContain('- emptyArray:');
            expect(result).toContain('- normalValue: test');
        });
    });

    describe('getArrayItemLabel', () => {
        test('应该为已知数组类型生成语义标签', () => {
            expect(getArrayItemLabel('intents', 0)).toBe('intent #1');
            expect(getArrayItemLabel('results', 5)).toBe('result #6');
            expect(getArrayItemLabel('targets', 0)).toBe('target #1');
            expect(getArrayItemLabel('failedIntents', 2)).toBe('failed intent #3');
            expect(getArrayItemLabel('items', 0)).toBe('item #1');
            expect(getArrayItemLabel('sections', 3)).toBe('section #4');
        });

        test('应该为未知数组类型使用索引格式', () => {
            expect(getArrayItemLabel('unknown', 0)).toBe('[0]');
            expect(getArrayItemLabel('customArray', 5)).toBe('[5]');
            expect(getArrayItemLabel('myData', 10)).toBe('[10]');
        });
    });
});

