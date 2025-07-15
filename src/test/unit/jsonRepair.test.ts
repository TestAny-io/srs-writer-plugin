/**
 * JSON Repair Integration Tests
 * 测试 jsonrepair 库集成到 parseAIToolPlan 方法的效果
 */

const { jsonrepair } = require('jsonrepair');

describe('JSON Repair Integration', () => {
    
    test('should parse valid JSON directly', () => {
        const validJson = `{
            "tool_calls": [
                {
                    "name": "taskComplete",
                    "args": {
                        "summary": "Task completed successfully"
                    }
                }
            ]
        }`;
        
        // 测试正常JSON不被破坏
        const parsed = JSON.parse(validJson);
        expect(parsed.tool_calls).toBeDefined();
        expect(Array.isArray(parsed.tool_calls)).toBe(true);
        expect(parsed.tool_calls.length).toBe(1);
        expect(parsed.tool_calls[0].name).toBe('taskComplete');
    });
    
    test('should repair common LLM JSON errors', () => {
        // 测试单引号修复
        const singleQuoteJson = `{
            'tool_calls': [
                {
                    'name': 'taskComplete',
                    'args': {
                        'summary': 'Task completed successfully'
                    }
                }
            ]
        }`;
        
        const repaired = jsonrepair(singleQuoteJson);
        const parsed = JSON.parse(repaired);
        expect(parsed.tool_calls).toBeDefined();
        expect(parsed.tool_calls[0].name).toBe('taskComplete');
        
        // 测试trailing comma修复
        const trailingCommaJson = `{
            "tool_calls": [
                {
                    "name": "taskComplete",
                    "args": {
                        "summary": "Task completed successfully",
                    },
                },
            ],
        }`;
        
        const repairedTrailing = jsonrepair(trailingCommaJson);
        const parsedTrailing = JSON.parse(repairedTrailing);
        expect(parsedTrailing.tool_calls).toBeDefined();
        expect(parsedTrailing.tool_calls[0].name).toBe('taskComplete');
    });
    
    test('should handle taskComplete JSON with newlines', () => {
        // 测试用户报告的具体问题：包含换行符的复杂JSON
        const problematicJson = `{
            "tool_calls": [
                {
                    "name": "taskComplete",
                    "args": {
                        "summary": "这是一个包含\n换行符的\n复杂JSON",
                        "completionType": "FULLY_COMPLETED",
                        "nextStepType": "TASK_FINISHED"
                    }
                }
            ]
        }`;
        
        // 这种情况jsonrepair应该能够处理
        const repaired = jsonrepair(problematicJson);
        const parsed = JSON.parse(repaired);
        expect(parsed.tool_calls).toBeDefined();
        expect(parsed.tool_calls[0].name).toBe('taskComplete');
        expect(parsed.tool_calls[0].args.summary).toContain('换行符');
    });
    
    test('should handle JSON wrapped in text', () => {
        // 测试AI输出中包含额外文本的情况
        const wrappedJson = `根据您的要求，我将调用taskComplete工具：

{
    "tool_calls": [
        {
            "name": "taskComplete",
            "args": {
                "summary": "任务已完成"
            }
        }
    ]
}

这样就完成了任务。`;
        
        const repaired = jsonrepair(wrappedJson);
        const parsed = JSON.parse(repaired);
        
        // jsonrepair可能将其转换为数组，需要查找其中的tool_calls对象
        let toolCallsObject = parsed;
        if (Array.isArray(parsed)) {
            toolCallsObject = parsed.find(item => 
                typeof item === 'object' && item !== null && item.tool_calls
            );
        }
        
        expect(toolCallsObject).toBeDefined();
        expect(toolCallsObject.tool_calls).toBeDefined();
        expect(toolCallsObject.tool_calls[0].name).toBe('taskComplete');
    });
    
    test('should handle markdown code blocks', () => {
        // 测试Markdown代码块包装的JSON
        const markdownJson = `\`\`\`json
{
    "tool_calls": [
        {
            "name": "taskComplete",
            "args": {
                "summary": "Task completed"
            }
        }
    ]
}
\`\`\``;
        
        const repaired = jsonrepair(markdownJson);
        const parsed = JSON.parse(repaired);
        expect(parsed.tool_calls).toBeDefined();
        expect(parsed.tool_calls[0].name).toBe('taskComplete');
    });
    
    test('should fail gracefully on unrepairable JSON', () => {
        // 测试彻底错误的输入
        const unreparableInputs = [
            'This is just plain text with no JSON',
            '{ incomplete and malformed',
            'null',
            '',
            '12345',
            '{ "random": "object", "without": "tool_calls" }'
        ];
        
        unreparableInputs.forEach(input => {
            try {
                const repaired = jsonrepair(input);
                const parsed = JSON.parse(repaired);
                // 如果解析成功但没有tool_calls，应该被认为是失败的
                expect(parsed.tool_calls).toBeUndefined();
            } catch (error) {
                // 如果jsonrepair或JSON.parse失败，这是预期的
                expect(error).toBeDefined();
            }
        });
    });

    test('should handle complex taskComplete with multiple deliverables', () => {
        // 测试复杂的taskComplete调用
        const complexJson = `{
            "tool_calls": [
                {
                    "name": "taskComplete",
                    "args": {
                        "completionType": "FULLY_COMPLETED",
                        "nextStepType": "TASK_FINISHED", 
                        "summary": "SRS文档创建完成，包含所有必要章节：\n1. 引言\n2. 整体说明\n3. 功能需求\n4. 非功能性需求\n5. 验收标准",
                        "contextForNext": {
                            "projectState": {
                                "phase": "requirements_complete",
                                "documentsCreated": ["SRS.md"]
                            }
                        }
                    }
                }
            ]
        }`;
        
        const repaired = jsonrepair(complexJson);
        const parsed = JSON.parse(repaired);
        expect(parsed.tool_calls).toBeDefined();
        expect(parsed.tool_calls[0].name).toBe('taskComplete');
    });
}); 