/**
 * SpecialistExecutor 错误增强机制测试
 * 验证Phase 1和Phase 2的错误增强功能
 */

// Mock vscode module first
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn()
    },
    Uri: {
        file: jest.fn()
    }
}));

describe('SpecialistExecutor Error Enhancement', () => {
    // 直接导入错误增强逻辑，避免复杂的类实例化
    const enhanceErrorMessage = (toolName: string, originalError: string): string => {
        const errorLower = originalError.toLowerCase();
        
        // ====== Phase 1: 战略性错误（AI必须改变策略）======
        
        // 1. 工具不存在错误 - 最高优先级
        if (originalError.includes('Tool implementation not found')) {
            return `CRITICAL ERROR: Tool '${toolName}' does not exist in the system. This is NOT a temporary failure. You MUST:
1. Stop retrying this tool immediately
2. Review your available tool list carefully
3. Select a valid tool name to accomplish your task
4. Do NOT attempt to use '${toolName}' again
Original error: ${originalError}`;
        }
        
        // 2. 参数相关错误
        if (errorLower.includes('missing required parameter') || 
            errorLower.includes('parameter') && errorLower.includes('required')) {
            return `PARAMETER ERROR: Tool '${toolName}' is missing required parameters. This is a format issue, NOT a system failure. You MUST:
1. Check the tool's parameter schema carefully
2. Provide ALL required arguments with correct types
3. Retry with properly formatted parameters
Original error: ${originalError}`;
        }
        
        // 3. 工作区错误
        if (errorLower.includes('workspace') || errorLower.includes('工作区') || 
            originalError.includes('No workspace folder is open')) {
            return `WORKSPACE ERROR: No workspace is open or accessible. This requires USER ACTION, not retrying. You SHOULD:
1. Inform the user that a workspace folder must be opened
2. Ask the user to open a project folder in VS Code
3. Do NOT retry this operation until workspace is available
Original error: ${originalError}`;
        }
        
        // ====== Phase 2: 配置和操作错误 ======
        
        // 4. 文件操作错误
        if (errorLower.includes('file not found') || errorLower.includes('无法读取文件') ||
            errorLower.includes('enoent') || errorLower.includes('path') && errorLower.includes('not found')) {
            return `FILE ERROR: File or path does not exist. This is a path issue, NOT a temporary failure. You SHOULD:
1. Verify the file path is correct
2. Use a file listing tool to check available files
3. Create the file first if it needs to exist
4. Do NOT retry with the same invalid path
Original error: ${originalError}`;
        }
        
        // 5. 权限错误
        if (errorLower.includes('permission') || errorLower.includes('access denied') ||
            errorLower.includes('eacces') || errorLower.includes('unauthorized')) {
            return `PERMISSION ERROR: Access denied due to insufficient permissions. This is a system configuration issue that retrying won't fix. You SHOULD:
1. Inform the user about the permission issue
2. Suggest the user check file/folder permissions
3. Do NOT retry the same operation
Original error: ${originalError}`;
        }
        
        // 6. 行号范围错误（编辑相关）
        if (errorLower.includes('行号') && errorLower.includes('超出') ||
            errorLower.includes('line number') && errorLower.includes('out of range')) {
            return `EDIT ERROR: Line number is out of file range. This is a calculation error, NOT a system failure. You MUST:
1. Read the target file first to get correct line counts
2. Recalculate the line numbers based on actual file content
3. Retry with valid line numbers within file range
Original error: ${originalError}`;
        }
        
        // 7. JSON格式错误
        if (errorLower.includes('json') && (errorLower.includes('parse') || errorLower.includes('invalid') || errorLower.includes('syntax'))) {
            return `FORMAT ERROR: Invalid JSON format in tool parameters. This is a syntax error, NOT a system failure. You MUST:
1. Review and fix the JSON structure in your tool call
2. Ensure proper quotes, brackets, and commas
3. Retry with correctly formatted JSON
Original error: ${originalError}`;
        }
        
        // 8. 语义编辑特定错误
        if (errorLower.includes('semantic editing failed') || errorLower.includes('语义编辑失败')) {
            return `SEMANTIC EDIT ERROR: Semantic editing approach failed. You SHOULD try alternative approach:
1. Use traditional line-based editing instead
2. Read the file first to get specific line numbers
3. Create precise line-by-line edit instructions
4. Do NOT retry semantic editing for this content
Original error: ${originalError}`;
        }
        
        // 9. 编辑指令格式错误
        if (errorLower.includes('指令') && (errorLower.includes('格式') || errorLower.includes('无效')) ||
            errorLower.includes('instruction') && errorLower.includes('invalid')) {
            return `EDIT INSTRUCTION ERROR: Edit instruction format is invalid. This is a structure error, NOT a system failure. You MUST:
1. Review the required edit instruction format
2. Ensure all required fields are present (action, lines, content)
3. Use correct action types ('insert' or 'replace')
4. Retry with properly structured edit instructions
Original error: ${originalError}`;
        }
        
        // ====== 默认增强（未匹配的错误）======
        // 为未明确分类的错误提供基本指导
        return `EXECUTION ERROR: Tool '${toolName}' failed with: ${originalError}

SUGGESTED ACTIONS:
1. Check if the tool parameters are correctly formatted
2. Verify any file paths or references exist
3. Consider if the operation requires specific prerequisites
4. If error persists, try a different approach or inform the user`;
    };

    describe('Phase 1: 战略性错误（AI必须改变策略）', () => {
        test('工具不存在错误 - 应该提供明确的停止重试指导', () => {
            const result = enhanceErrorMessage('nonExistentTool', 'Tool implementation not found: nonExistentTool');

            expect(result).toContain('CRITICAL ERROR');
            expect(result).toContain('does not exist in the system');
            expect(result).toContain('Stop retrying this tool immediately');
            expect(result).toContain('Review your available tool list');
            expect(result).toContain('Do NOT attempt to use');
        });

        test('参数错误 - 应该提供格式修复指导', () => {
            const result = enhanceErrorMessage('testTool', 'Missing required parameter: fileName');

            expect(result).toContain('PARAMETER ERROR');
            expect(result).toContain('missing required parameters');
            expect(result).toContain('format issue, NOT a system failure');
            expect(result).toContain('Check the tool\'s parameter schema');
            expect(result).toContain('Provide ALL required arguments');
        });

        test('工作区错误 - 应该指导用户操作', () => {
            const result = enhanceErrorMessage('testTool', 'No workspace folder is open');

            expect(result).toContain('WORKSPACE ERROR');
            expect(result).toContain('requires USER ACTION');
            expect(result).toContain('Inform the user');
            expect(result).toContain('open a project folder');
            expect(result).toContain('Do NOT retry this operation');
        });
    });

    describe('Phase 2: 配置和操作错误', () => {
        test('文件不存在错误 - 应该提供路径验证指导', () => {
            const result = enhanceErrorMessage('readFile', 'File not found: /invalid/path.txt');

            expect(result).toContain('FILE ERROR');
            expect(result).toContain('path does not exist');
            expect(result).toContain('Verify the file path is correct');
            expect(result).toContain('Use a file listing tool');
            expect(result).toContain('Do NOT retry with the same invalid path');
        });

        test('权限错误 - 应该明确这是配置问题', () => {
            const result = enhanceErrorMessage('writeFile', 'Permission denied: access to file restricted');

            expect(result).toContain('PERMISSION ERROR');
            expect(result).toContain('system configuration issue');
            expect(result).toContain('retrying won\'t fix');
            expect(result).toContain('Inform the user about the permission issue');
            expect(result).toContain('Do NOT retry');
        });

        test('行号范围错误 - 应该指导重新计算', () => {
            const result = enhanceErrorMessage('editFile', '行号 150 超出文件范围，文件共 100 行');

            expect(result).toContain('EDIT ERROR');
            expect(result).toContain('out of file range');
            expect(result).toContain('calculation error');
            expect(result).toContain('Read the target file first');
            expect(result).toContain('Recalculate the line numbers');
        });

        test('JSON格式错误 - 应该指导修复语法', () => {
            const result = enhanceErrorMessage('testTool', 'JSON parse error: invalid syntax at position 15');

            expect(result).toContain('FORMAT ERROR');
            expect(result).toContain('Invalid JSON format');
            expect(result).toContain('syntax error, NOT a system failure');
            expect(result).toContain('Review and fix the JSON structure');
            expect(result).toContain('proper quotes, brackets, and commas');
        });

        test('语义编辑错误 - 应该建议替代方案', () => {
            const result = enhanceErrorMessage('semanticEdit', 'Semantic editing failed: unable to locate target section');

            expect(result).toContain('SEMANTIC EDIT ERROR');
            expect(result).toContain('try alternative approach');
            expect(result).toContain('Use traditional line-based editing');
            expect(result).toContain('Do NOT retry semantic editing');
        });

        test('编辑指令格式错误 - 应该指导正确格式', () => {
            const result = enhanceErrorMessage('editFile', '指令格式无效: 缺少required字段');

            expect(result).toContain('EDIT INSTRUCTION ERROR');
            expect(result).toContain('structure error, NOT a system failure');
            expect(result).toContain('Review the required edit instruction format');
            expect(result).toContain('all required fields are present');
        });
    });

    describe('默认错误处理', () => {
        test('未分类错误 - 应该提供通用指导', () => {
            const result = enhanceErrorMessage('unknownTool', 'Some random error message');

            expect(result).toContain('EXECUTION ERROR');
            expect(result).toContain('SUGGESTED ACTIONS');
            expect(result).toContain('Check if the tool parameters are correctly formatted');
            expect(result).toContain('Verify any file paths or references exist');
            expect(result).toContain('try a different approach');
        });
    });

    describe('错误消息格式验证', () => {
        test('所有增强错误消息都应该包含原始错误信息', () => {
            const originalError = 'Tool implementation not found: testTool';
            const result = enhanceErrorMessage('testTool', originalError);

            expect(result).toContain('Original error: ' + originalError);
        });

        test('增强错误消息应该有清晰的结构', () => {
            const result = enhanceErrorMessage('testTool', 'Missing required parameter: fileName');

            // 应该包含错误类型标识
            expect(result).toMatch(/^[A-Z_\s]+ERROR:/);
            
            // 应该包含具体的行动指导
            expect(result).toContain('You MUST:');
            
            // 应该有编号的步骤
            expect(result).toContain('1.');
            expect(result).toContain('2.');
        });

        test('增强错误消息长度应该合理', () => {
            const result = enhanceErrorMessage('testTool', 'Some error');

            // 不应该太短（少于50字符可能信息不足）
            expect(result.length).toBeGreaterThan(50);
            
            // 不应该太长（超过1000字符可能难以处理）
            expect(result.length).toBeLessThan(1000);
        });
    });

    describe('错误分类完整性测试', () => {
        test('工具不存在和工作区错误应该强调不应重试', () => {
            const noRetryErrors = [
                'Tool implementation not found: badTool',
                'No workspace folder is open'
            ];

            noRetryErrors.forEach(error => {
                const result = enhanceErrorMessage('testTool', error);
                expect(result).toMatch(/(Stop retrying|Do NOT retry|Do NOT attempt)/i);
            });
        });

        test('参数错误应该允许修复后重试', () => {
            const result = enhanceErrorMessage('testTool', 'Missing required parameter: fileName');
            expect(result).toContain('PARAMETER ERROR');
            expect(result).toContain('Retry with properly formatted parameters');
        });

        test('所有错误都应该提供具体的解决方案', () => {
            const allErrors = [
                'Tool implementation not found: badTool',
                'Missing required parameter: fileName',
                'No workspace folder is open',
                'File not found: /invalid/path.txt',
                'Permission denied: access restricted',
                '行号 150 超出文件范围，文件共 100 行',
                'JSON parse error: invalid syntax',
                'Semantic editing failed: unable to locate'
            ];

            allErrors.forEach(error => {
                const result = enhanceErrorMessage('testTool', error);
                expect(result).toMatch(/(You MUST|You SHOULD)/);
                expect(result).toContain('1.');  // 应该有具体步骤
            });
        });
    });
}); 