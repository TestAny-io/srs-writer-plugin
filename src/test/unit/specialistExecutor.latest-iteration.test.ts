/**
 * SpecialistExecutor 最新迭代完整显示功能测试
 * 验证在最新一轮迭代中显示完整的executeMarkdownEdits和executeYAMLEdits工具结果
 */

// 模拟summarizeToolCall方法的核心逻辑
const mockSummarizeToolCall = (toolCall: { name: string; args: any }, isLatestIteration: boolean = false): string => {
    const { name, args } = toolCall;
    
    if (name === 'recordThought') {
        return '';
    }
    
    // 🚀 新增：如果是最新一轮迭代，对executeMarkdownEdits和executeYAMLEdits显示完整内容
    if (isLatestIteration && (name === 'executeMarkdownEdits' || name === 'executeYAMLEdits')) {
        return `${name}: ${JSON.stringify(args)}`;
    }
    
    switch (name) {
        case 'executeMarkdownEdits':
            const description = args.description || '未提供描述';
            const intentCount = args.intents?.length || 0;
            const targetFile = args.targetFile?.split('/').pop() || '未知文件';
            return `${name}: ${description} (${intentCount}个编辑操作 -> ${targetFile})`;
            
        case 'executeYAMLEdits':
            const yamlDesc = args.description || '未提供描述';
            const editCount = args.edits?.length || 0;
            const yamlFile = args.targetFile?.split('/').pop() || '未知文件';
            return `${name}: ${yamlDesc} (${editCount}个编辑操作 -> ${yamlFile})`;
            
        default:
            return `${name}: ${JSON.stringify(args)}`;
    }
};

// 模拟summarizeToolResult方法的核心逻辑
const mockSummarizeToolResult = (result: any, isLatestIteration: boolean = false): string => {
    const { toolName, success } = result;
    
    // 🚀 新增：如果是最新一轮迭代，对executeMarkdownEdits和executeYAMLEdits显示完整内容
    if (isLatestIteration && (toolName === 'executeMarkdownEdits' || toolName === 'executeYAMLEdits')) {
        return `工具: ${toolName}, 成功: ${success}, 结果: ${JSON.stringify(result.result)}`;
    }
    
    switch (toolName) {
        case 'executeMarkdownEdits':
            if (!success) {
                let errorMessage = result.error || '未知错误';
                if (result.result?.failedIntents?.length > 0) {
                    errorMessage = result.result.failedIntents[0].error || errorMessage;
                }
                return `${toolName}: ❌ 失败 - ${errorMessage}`;
            }
            const appliedCount = result.result?.appliedIntents?.length || 0;
            const metadata = result.result?.metadata;
            const execTime = metadata?.executionTime || 0;
            return `${toolName}: ✅ 成功 - 应用${appliedCount}个编辑操作 (${execTime}ms)`;
            
        case 'executeYAMLEdits':
            if (!success) {
                return `${toolName}: ❌ 失败 - ${result.error || '未知错误'}`;
            }
            const yamlAppliedCount = result.result?.appliedEdits?.length || 0;
            return `${toolName}: ✅ 成功 - 应用${yamlAppliedCount}个YAML编辑操作`;
            
        default:
            return `工具: ${toolName}, 成功: ${success}, 结果: ${JSON.stringify(result.result)}`;
    }
};

describe('SpecialistExecutor Latest Iteration Display', () => {
    describe('summarizeToolCall logic', () => {
        it('应该在最新迭代中显示executeMarkdownEdits的完整内容', () => {
            const toolCall = {
                name: 'executeMarkdownEdits',
                args: {
                    description: '更新SRS文档',
                    targetFile: 'SRS.md',
                    intents: [
                        {
                            type: 'insert',
                            targetSection: '2.1 系统概述',
                            content: '这是详细的系统概述内容...'
                        }
                    ]
                }
            };

            // 测试非最新迭代（简化显示）
            const simplifiedResult = mockSummarizeToolCall(toolCall, false);
            expect(simplifiedResult).toContain('更新SRS文档');
            expect(simplifiedResult).toContain('(1个编辑操作 -> SRS.md)');
            expect(simplifiedResult).not.toContain('这是详细的系统概述内容');

            // 测试最新迭代（完整显示）
            const fullResult = mockSummarizeToolCall(toolCall, true);
            expect(fullResult).toContain(JSON.stringify(toolCall.args));
            expect(fullResult).toContain('这是详细的系统概述内容');
        });

        it('应该在最新迭代中显示executeYAMLEdits的完整内容', () => {
            const toolCall = {
                name: 'executeYAMLEdits',
                args: {
                    description: '更新需求配置',
                    targetFile: 'requirements.yaml',
                    edits: [
                        {
                            operation: 'set',
                            path: 'functional_requirements.FR001.priority',
                            value: 'high'
                        }
                    ]
                }
            };

            // 测试非最新迭代（简化显示）
            const simplifiedResult = mockSummarizeToolCall(toolCall, false);
            expect(simplifiedResult).toContain('更新需求配置');
            expect(simplifiedResult).toContain('(1个编辑操作 -> requirements.yaml)');
            expect(simplifiedResult).not.toContain('FR001');

            // 测试最新迭代（完整显示）
            const fullResult = mockSummarizeToolCall(toolCall, true);
            expect(fullResult).toContain(JSON.stringify(toolCall.args));
            expect(fullResult).toContain('FR001');
        });

        it('应该继续过滤recordThought工具调用', () => {
            const toolCall = {
                name: 'recordThought',
                args: {
                    thinkingType: 'analysis',
                    content: { problem: 'test' }
                }
            };

            // 无论是否最新迭代，都应该返回空字符串
            expect(mockSummarizeToolCall(toolCall, false)).toBe('');
            expect(mockSummarizeToolCall(toolCall, true)).toBe('');
        });

        it('应该对其他工具保持原有行为', () => {
            const toolCall = {
                name: 'readFile',
                args: {
                    filePath: 'test.md'
                }
            };

            // 其他工具的行为不应该改变
            const result1 = mockSummarizeToolCall(toolCall, false);
            const result2 = mockSummarizeToolCall(toolCall, true);
            
            expect(result1).toBe(result2);
            expect(result1).toContain('readFile');
            expect(result1).toContain(JSON.stringify(toolCall.args));
        });
    });

    describe('summarizeToolResult logic', () => {
        it('应该在最新迭代中显示executeMarkdownEdits的完整结果', () => {
            const toolResult = {
                toolName: 'executeMarkdownEdits',
                success: true,
                result: {
                    appliedIntents: [
                        {
                            type: 'insert',
                            targetSection: '2.1 系统概述',
                            content: '详细内容...',
                            result: '成功插入内容'
                        }
                    ],
                    metadata: {
                        executionTime: 150
                    }
                }
            };

            // 测试非最新迭代（简化显示）
            const simplifiedResult = mockSummarizeToolResult(toolResult, false);
            expect(simplifiedResult).toContain('✅ 成功 - 应用1个编辑操作 (150ms)');
            expect(simplifiedResult).not.toContain('详细内容');

            // 测试最新迭代（完整显示）
            const fullResult = mockSummarizeToolResult(toolResult, true);
            expect(fullResult).toContain(JSON.stringify(toolResult.result));
            expect(fullResult).toContain('详细内容');
        });

        it('应该在最新迭代中显示executeYAMLEdits的完整结果', () => {
            const toolResult = {
                toolName: 'executeYAMLEdits',
                success: true,
                result: {
                    appliedEdits: [
                        {
                            operation: 'set',
                            path: 'test.value',
                            oldValue: null,
                            newValue: 'new_value'
                        }
                    ]
                }
            };

            // 测试非最新迭代（简化显示）
            const simplifiedResult = mockSummarizeToolResult(toolResult, false);
            expect(simplifiedResult).toContain('✅ 成功 - 应用1个YAML编辑操作');
            expect(simplifiedResult).not.toContain('new_value');

            // 测试最新迭代（完整显示）
            const fullResult = mockSummarizeToolResult(toolResult, true);
            expect(fullResult).toContain(JSON.stringify(toolResult.result));
            expect(fullResult).toContain('new_value');
        });

        it('应该处理失败的工具结果', () => {
            const failedResult = {
                toolName: 'executeMarkdownEdits',
                success: false,
                error: '文件不存在',
                result: {
                    failedIntents: [
                        {
                            error: '目标文件未找到'
                        }
                    ]
                }
            };

            // 测试非最新迭代（简化显示错误）
            const simplifiedResult = mockSummarizeToolResult(failedResult, false);
            expect(simplifiedResult).toContain('❌ 失败 - 目标文件未找到');

            // 测试最新迭代（显示完整错误信息）
            const fullResult = mockSummarizeToolResult(failedResult, true);
            expect(fullResult).toContain('工具: executeMarkdownEdits, 成功: false');
            expect(fullResult).toContain(JSON.stringify(failedResult.result));
        });

        it('应该对其他工具保持原有行为', () => {
            const toolResult = {
                toolName: 'readFile',
                success: true,
                result: {
                    content: 'file content'
                }
            };

            // 其他工具的行为不应该改变
            const result1 = mockSummarizeToolResult(toolResult, false);
            const result2 = mockSummarizeToolResult(toolResult, true);
            
            expect(result1).toBe(result2);
            expect(result1).toContain('readFile');
            expect(result1).toContain('file content');
        });
    });

    describe('Integration behavior', () => {
        it('应该验证isLatestIteration参数默认值为false', () => {
            const toolCall = {
                name: 'executeMarkdownEdits',
                args: { description: 'test', intents: [] }
            };

            // 不传递isLatestIteration参数时应该使用默认值false（简化显示）
            const defaultResult = mockSummarizeToolCall(toolCall);
            const explicitFalseResult = mockSummarizeToolCall(toolCall, false);

            expect(defaultResult).toBe(explicitFalseResult);
            expect(defaultResult).not.toContain(JSON.stringify(toolCall.args));
        });

        it('应该验证完整功能的端到端行为', () => {
            // 模拟一个完整的迭代历史构建过程
            const toolCalls = [
                {
                    name: 'executeMarkdownEdits',
                    args: {
                        description: '插入章节',
                        targetFile: 'SRS.md',
                        intents: [{ type: 'insert', content: 'detailed content' }]
                    }
                },
                {
                    name: 'readFile',
                    args: { filePath: 'test.md' }
                }
            ];

            const toolResults = [
                {
                    toolName: 'executeMarkdownEdits',
                    success: true,
                    result: {
                        appliedIntents: [{ type: 'insert', content: 'detailed content', result: 'success' }],
                        metadata: { executionTime: 100 }
                    }
                },
                {
                    toolName: 'readFile',
                    success: true,
                    result: { content: 'file content' }
                }
            ];

            // 模拟非最新迭代的历史构建
            const historicalPlanSummary = toolCalls
                .map(call => mockSummarizeToolCall(call, false))
                .filter(summary => summary.trim())
                .join('\n');

            const historicalResultsSummary = toolResults
                .map(result => mockSummarizeToolResult(result, false))
                .join('\n');

            // 模拟最新迭代的历史构建
            const latestPlanSummary = toolCalls
                .map(call => mockSummarizeToolCall(call, true))
                .filter(summary => summary.trim())
                .join('\n');

            const latestResultsSummary = toolResults
                .map(result => mockSummarizeToolResult(result, true))
                .join('\n');

            // 验证历史记录包含简化内容
            expect(historicalPlanSummary).toContain('插入章节 (1个编辑操作 -> SRS.md)');
            expect(historicalPlanSummary).not.toContain('detailed content');
            expect(historicalResultsSummary).toContain('✅ 成功 - 应用1个编辑操作 (100ms)');

            // 验证最新记录包含完整内容
            expect(latestPlanSummary).toContain('detailed content');
            expect(latestResultsSummary).toContain('detailed content');
        });
    });
});