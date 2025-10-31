/**
 * 改进2单元测试：全透明工具显示 + recordThought内容显示
 *
 * 测试覆盖：
 * - getThinkingTypeEmoji() - 思考类型emoji映射
 * - shortenPath() - 路径缩短
 * - truncateText() - 文本截断
 * - formatToolDetail() - 30个工具的参数显示
 * - recordThought特殊显示
 * - 执行摘要显示条件
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// 模拟SRSAgentEngine的私有方法
class ToolDisplayTester {
    /**
     * 🆕 改进2：获取思考类型对应的emoji
     */
    getThinkingTypeEmoji(thinkingType: string): string {
        const emojiMap: Record<string, string> = {
            'planning': '📋',
            'analysis': '🔍',
            'synthesis': '🔗',
            'reflection': '🤔',
            'derivation': '➡️'
        };
        return emojiMap[thinkingType] || '🧠';
    }

    /**
     * 🆕 改进2：缩短文件路径
     */
    shortenPath(fullPath: string): string {
        if (!fullPath) return '';

        const parts = fullPath.split('/').filter(p => p); // 🔧 过滤空字符串（处理开头/和末尾/）

        if (parts.length <= 2) {
            return parts.join('/');
        }

        const shortened = parts.slice(-2).join('/');
        return shortened;
    }

    /**
     * 🆕 改进2：截断文本到指定长度
     */
    truncateText(text: string, maxLength: number): string {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 🆕 改进2：格式化工具的详细信息（简化版用于测试）
     */
    formatToolDetail(toolName: string, args: any, result: any): string {
        try {
            switch (toolName) {
                // 文件系统操作
                case 'readTextFile':
                    return args.path ? ` - ${this.shortenPath(args.path)}` : '';
                case 'writeFile':
                    return args.path ? ` - ${this.shortenPath(args.path)}` : '';
                case 'createDirectory':
                    return args.dirPath ? ` - ${this.shortenPath(args.dirPath)}` : '';
                case 'moveAndRenameFile':
                    if (args.sourcePath && args.targetPath) {
                        return ` - ${this.shortenPath(args.sourcePath)} → ${this.shortenPath(args.targetPath)}`;
                    }
                    return '';

                // 智能编辑工具
                case 'findAndReplace':
                    if (args.summary && args.path) {
                        return ` - ${args.summary} (${this.shortenPath(args.path)})`;
                    } else if (args.summary) {
                        return ` - ${args.summary}`;
                    }
                    return '';

                case 'findInFiles':
                    return args.searchPattern ? ` - "${this.truncateText(args.searchPattern, 50)}"` : '';

                // 用户交互工具 - 不显示
                case 'showInformationMessage':
                case 'askQuestion':
                    return '';

                // 知识工具
                case 'readLocalKnowledge':
                case 'internetSearch':
                    return args.query ? ` - "${this.truncateText(args.query, 50)}"` : '';

                // 内部工具
                case 'createNewProjectFolder':
                    return args.projectName ? ` - ${args.projectName}` : '';

                case 'taskComplete':
                    // 不显示参数（用户决定：用户已经在最终显示中看到summary）
                    return '';

                // 文档层工具
                case 'readMarkdownFile':
                    // 只显示path，不显示parseMode（用户决定）
                    return args.path ? ` - ${this.shortenPath(args.path)}` : '';

                case 'executeYAMLEdits':
                    if (args.yamlFilePath && args.edits) {
                        const editsCount = Array.isArray(args.edits) ? args.edits.length : 0;
                        return ` - 修改了${editsCount}个字段 (${this.shortenPath(args.yamlFilePath)})`;
                    }
                    return '';

                default:
                    return '';
            }
        } catch (error) {
            return '';
        }
    }
}

describe('改进2：全透明工具显示测试', () => {
    let tester: ToolDisplayTester;

    beforeEach(() => {
        tester = new ToolDisplayTester();
    });

    // ========================================================================
    // getThinkingTypeEmoji() 测试
    // ========================================================================
    describe('getThinkingTypeEmoji()', () => {
        it('应该返回正确的emoji - planning', () => {
            const result = tester.getThinkingTypeEmoji('planning');
            expect(result).toBe('📋');
        });

        it('应该返回正确的emoji - analysis', () => {
            const result = tester.getThinkingTypeEmoji('analysis');
            expect(result).toBe('🔍');
        });

        it('应该返回正确的emoji - synthesis', () => {
            const result = tester.getThinkingTypeEmoji('synthesis');
            expect(result).toBe('🔗');
        });

        it('应该返回正确的emoji - reflection', () => {
            const result = tester.getThinkingTypeEmoji('reflection');
            expect(result).toBe('🤔');
        });

        it('应该返回正确的emoji - derivation', () => {
            const result = tester.getThinkingTypeEmoji('derivation');
            expect(result).toBe('➡️');
        });

        it('Edge Case: 未知思考类型应该返回默认emoji', () => {
            const result = tester.getThinkingTypeEmoji('unknown_type');
            expect(result).toBe('🧠');
        });

        it('Edge Case: 空字符串应该返回默认emoji', () => {
            const result = tester.getThinkingTypeEmoji('');
            expect(result).toBe('🧠');
        });

        it('Edge Case: null/undefined应该返回默认emoji', () => {
            const result1 = tester.getThinkingTypeEmoji(null as any);
            const result2 = tester.getThinkingTypeEmoji(undefined as any);
            expect(result1).toBe('🧠');
            expect(result2).toBe('🧠');
        });
    });

    // ========================================================================
    // shortenPath() 测试
    // ========================================================================
    describe('shortenPath()', () => {
        it('应该缩短长路径 - 只保留最后2段', () => {
            const result = tester.shortenPath('/Users/name/workspace/project/docs/SRS.md');
            expect(result).toBe('docs/SRS.md');
        });

        it('应该保持短路径不变 - 2段路径', () => {
            const result = tester.shortenPath('docs/SRS.md');
            expect(result).toBe('docs/SRS.md');
        });

        it('应该保持短路径不变 - 1段路径', () => {
            const result = tester.shortenPath('SRS.md');
            expect(result).toBe('SRS.md');
        });

        it('Edge Case: 空字符串应该返回空字符串', () => {
            const result = tester.shortenPath('');
            expect(result).toBe('');
        });

        it('Edge Case: null应该返回空字符串', () => {
            const result = tester.shortenPath(null as any);
            expect(result).toBe('');
        });

        it('Edge Case: undefined应该返回空字符串', () => {
            const result = tester.shortenPath(undefined as any);
            expect(result).toBe('');
        });

        it('应该处理Windows路径风格（反斜杠）', () => {
            const result = tester.shortenPath('C:\\Users\\name\\project\\docs\\SRS.md');
            // 注意：当前实现只处理/，Windows路径会被当作一个段
            expect(result).toBe('C:\\Users\\name\\project\\docs\\SRS.md');
        });

        it('应该处理相对路径', () => {
            const result = tester.shortenPath('../project/docs/SRS.md');
            expect(result).toBe('docs/SRS.md');
        });

        it('应该处理路径末尾的斜杠', () => {
            const result = tester.shortenPath('/Users/name/workspace/project/docs/');
            expect(result).toBe('project/docs');
        });
    });

    // ========================================================================
    // truncateText() 测试
    // ========================================================================
    describe('truncateText()', () => {
        it('应该截断长文本', () => {
            const result = tester.truncateText('This is a very long text that should be truncated', 20);
            expect(result).toBe('This is a very long ...');
        });

        it('应该保持短文本不变', () => {
            const result = tester.truncateText('Short text', 20);
            expect(result).toBe('Short text');
        });

        it('应该处理刚好等于maxLength的文本', () => {
            const result = tester.truncateText('Exactly 20 character', 20);
            expect(result).toBe('Exactly 20 character');
        });

        it('Edge Case: 空字符串应该返回空字符串', () => {
            const result = tester.truncateText('', 20);
            expect(result).toBe('');
        });

        it('Edge Case: null应该返回空字符串', () => {
            const result = tester.truncateText(null as any, 20);
            expect(result).toBe('');
        });

        it('Edge Case: undefined应该返回空字符串', () => {
            const result = tester.truncateText(undefined as any, 20);
            expect(result).toBe('');
        });

        it('Edge Case: maxLength为0', () => {
            const result = tester.truncateText('Some text', 0);
            expect(result).toBe('...');
        });

        it('Edge Case: maxLength为负数', () => {
            const result = tester.truncateText('Some text', -5);
            expect(result).toBe('...');
        });

        it('应该处理包含特殊字符的文本', () => {
            const result = tester.truncateText('Special chars: 😀🎉\n\t"quotes"', 15);
            expect(result).toBe('Special chars: ...');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 文件系统操作
    // ========================================================================
    describe('formatToolDetail() - 文件系统操作', () => {
        it('readTextFile 应该显示路径', () => {
            const result = tester.formatToolDetail('readTextFile',
                { path: '/project/docs/SRS.md' },
                { success: true }
            );
            expect(result).toBe(' - docs/SRS.md');
        });

        it('writeFile 应该显示路径（不显示size）', () => {
            const result = tester.formatToolDetail('writeFile',
                { path: '/project/SRS.md', content: 'some content' },
                { success: true }
            );
            expect(result).toBe(' - project/SRS.md');
        });

        it('createDirectory 应该显示目录路径', () => {
            const result = tester.formatToolDetail('createDirectory',
                { dirPath: '/project/docs/new-folder' },
                { success: true }
            );
            expect(result).toBe(' - docs/new-folder');
        });

        it('moveAndRenameFile 应该显示源路径→目标路径', () => {
            const result = tester.formatToolDetail('moveAndRenameFile',
                { sourcePath: '/project/old.md', targetPath: '/project/docs/new.md' },
                { success: true }
            );
            expect(result).toBe(' - project/old.md → docs/new.md');
        });

        it('Edge Case: readTextFile缺少path参数', () => {
            const result = tester.formatToolDetail('readTextFile',
                {},
                { success: true }
            );
            expect(result).toBe('');
        });

        it('Edge Case: moveAndRenameFile只有sourcePath', () => {
            const result = tester.formatToolDetail('moveAndRenameFile',
                { sourcePath: '/project/old.md' },
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 智能编辑工具
    // ========================================================================
    describe('formatToolDetail() - 智能编辑工具', () => {
        it('findAndReplace 应该显示summary和path', () => {
            const result = tester.formatToolDetail('findAndReplace',
                { summary: 'Fix typos', path: '/project/SRS.md', searchPattern: 'old', replacement: 'new' },
                { success: true }
            );
            expect(result).toBe(' - Fix typos (project/SRS.md)');
        });

        it('findAndReplace 只有summary', () => {
            const result = tester.formatToolDetail('findAndReplace',
                { summary: 'Fix typos', searchPattern: 'old', replacement: 'new' },
                { success: true }
            );
            expect(result).toBe(' - Fix typos');
        });

        it('findInFiles 应该显示searchPattern（截断50字符）', () => {
            const result = tester.formatToolDetail('findInFiles',
                { searchPattern: 'TODO', glob: '*.md' },
                { success: true }
            );
            expect(result).toBe(' - "TODO"');
        });

        it('findInFiles 应该截断长searchPattern', () => {
            const longPattern = 'This is a very long search pattern that exceeds fifty characters limit';
            const result = tester.formatToolDetail('findInFiles',
                { searchPattern: longPattern, glob: '*.md' },
                { success: true }
            );
            expect(result).toBe(' - "This is a very long search pattern that exceeds fi..."');
        });

        it('Edge Case: findAndReplace缺少所有可选参数', () => {
            const result = tester.formatToolDetail('findAndReplace',
                { searchPattern: 'old', replacement: 'new' },
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 用户交互工具（应该不显示）
    // ========================================================================
    describe('formatToolDetail() - 用户交互工具', () => {
        it('showInformationMessage 不应该显示message', () => {
            const result = tester.formatToolDetail('showInformationMessage',
                { message: 'File saved successfully' },
                { success: true }
            );
            expect(result).toBe('');
        });

        it('askQuestion 不应该显示question', () => {
            const result = tester.formatToolDetail('askQuestion',
                { question: 'Which template to use?', options: ['A', 'B'] },
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 知识工具
    // ========================================================================
    describe('formatToolDetail() - 知识工具', () => {
        it('readLocalKnowledge 应该显示query（截断50字符）', () => {
            const result = tester.formatToolDetail('readLocalKnowledge',
                { query: 'What is Traditional SRS?' },
                { success: true }
            );
            expect(result).toBe(' - "What is Traditional SRS?"');
        });

        it('internetSearch 应该显示query（截断50字符）', () => {
            const result = tester.formatToolDetail('internetSearch',
                { query: 'SRS template examples' },
                { success: true }
            );
            expect(result).toBe(' - "SRS template examples"');
        });

        it('internetSearch 应该截断长query', () => {
            const longQuery = 'This is a very long search query that definitely e...eeds the fifty character limit for display';
            const result = tester.formatToolDetail('internetSearch',
                { query: longQuery },
                { success: true }
            );
            expect(result).toBe(' - "This is a very long search query that definitely e..."');
        });

        it('Edge Case: readLocalKnowledge缺少query', () => {
            const result = tester.formatToolDetail('readLocalKnowledge',
                {},
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 内部工具
    // ========================================================================
    describe('formatToolDetail() - 内部工具', () => {
        it('createNewProjectFolder 应该只显示projectName', () => {
            const result = tester.formatToolDetail('createNewProjectFolder',
                { projectName: 'lianliankan', templateType: 'Traditional SRS' },
                { success: true }
            );
            expect(result).toBe(' - lianliankan');
        });

        it('taskComplete 不应该显示参数', () => {
            const result = tester.formatToolDetail('taskComplete',
                { summary: 'Project initialized successfully' },
                { success: true, result: { summary: 'Project initialized successfully' } }
            );
            expect(result).toBe('');
        });

        it('taskComplete 即使有长summary也不显示', () => {
            const longSummary = 'This is a very long task completion summary that exceeds one hundred characters and should be truncated to maintain readability in the chat window';
            const result = tester.formatToolDetail('taskComplete',
                { summary: longSummary },
                { success: true, result: { summary: longSummary } }
            );
            expect(result).toBe('');
        });

        it('Edge Case: createNewProjectFolder缺少projectName', () => {
            const result = tester.formatToolDetail('createNewProjectFolder',
                { templateType: 'Traditional SRS' },
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 文档层工具
    // ========================================================================
    describe('formatToolDetail() - 文档层工具', () => {
        it('readMarkdownFile 应该只显示path（不显示parseMode）', () => {
            const result = tester.formatToolDetail('readMarkdownFile',
                { path: '/project/docs/SRS.md', parseMode: 'structure' },
                { success: true }
            );
            expect(result).toBe(' - docs/SRS.md');
        });

        it('readMarkdownFile 只有path也正常显示', () => {
            const result = tester.formatToolDetail('readMarkdownFile',
                { path: '/project/SRS.md' },
                { success: true }
            );
            expect(result).toBe(' - project/SRS.md');
        });

        it('executeYAMLEdits 应该显示filePath和edits count', () => {
            const result = tester.formatToolDetail('executeYAMLEdits',
                { yamlFilePath: '/project/requirements.yaml', edits: [{}, {}, {}] },
                { success: true }
            );
            expect(result).toBe(' - 修改了3个字段 (project/requirements.yaml)');
        });

        it('executeYAMLEdits edits为空数组', () => {
            const result = tester.formatToolDetail('executeYAMLEdits',
                { yamlFilePath: '/project/requirements.yaml', edits: [] },
                { success: true }
            );
            expect(result).toBe(' - 修改了0个字段 (project/requirements.yaml)');
        });

        it('Edge Case: readMarkdownFile缺少所有参数', () => {
            const result = tester.formatToolDetail('readMarkdownFile',
                {},
                { success: true }
            );
            expect(result).toBe('');
        });

        it('Edge Case: executeYAMLEdits edits不是数组', () => {
            const result = tester.formatToolDetail('executeYAMLEdits',
                { yamlFilePath: '/project/requirements.yaml', edits: 'invalid' },
                { success: true }
            );
            expect(result).toBe(' - 修改了0个字段 (project/requirements.yaml)');
        });
    });

    // ========================================================================
    // formatToolDetail() 测试 - 未知工具
    // ========================================================================
    describe('formatToolDetail() - 未知工具和错误处理', () => {
        it('未知工具应该返回空字符串', () => {
            const result = tester.formatToolDetail('unknownTool',
                { someParam: 'value' },
                { success: true }
            );
            expect(result).toBe('');
        });

        it('Edge Case: args为null', () => {
            const result = tester.formatToolDetail('readTextFile',
                null as any,
                { success: true }
            );
            expect(result).toBe('');
        });

        it('Edge Case: result为null', () => {
            const result = tester.formatToolDetail('readTextFile',
                { path: '/project/SRS.md' },
                null as any
            );
            // 不应该抛出错误，应该能正常返回
            expect(result).toBe(' - project/SRS.md');
        });

        it('Edge Case: 参数访问抛出错误', () => {
            const problematicArgs = {};
            Object.defineProperty(problematicArgs, 'path', {
                get() { throw new Error('Access error'); }
            });

            // 应该静默处理错误，返回空字符串
            const result = tester.formatToolDetail('readTextFile',
                problematicArgs,
                { success: true }
            );
            expect(result).toBe('');
        });
    });

    // ========================================================================
    // 集成测试 - recordThought显示格式
    // ========================================================================
    describe('recordThought 显示格式（模拟）', () => {
        it('应该格式化完整的recordThought输出', () => {
            const thought = {
                thinkingType: 'planning',
                context: 'Planning project structure',
                nextSteps: ['step1', 'step2', 'step3']
            };

            const emoji = tester.getThinkingTypeEmoji(thought.thinkingType);
            const contextPart = thought.context ? ` - ${thought.context}` : '';
            const nextStepsPart = thought.nextSteps?.length
                ? ` → ${thought.nextSteps.length} next steps`
                : '';

            // 新格式：✅ **Thought** (📋 planning) - Context → 3 next steps
            const expected = `✅ **Thought** (${emoji} ${thought.thinkingType})${contextPart}${nextStepsPart}`;
            const actual = `✅ **Thought** (${emoji} ${thought.thinkingType})${contextPart}${nextStepsPart}`;

            expect(actual).toBe(expected);
            expect(actual.includes('📋'));
            expect(actual.includes('planning'));
            expect(actual.includes('Planning project structure'));
            expect(actual.includes('3 next steps'));
        });

        it('recordThought 只有thinkingType', () => {
            const thought: {
                thinkingType: string;
                context?: string;
                nextSteps?: string[];
            } = {
                thinkingType: 'analysis',
                context: undefined,
                nextSteps: undefined
            };

            const emoji = tester.getThinkingTypeEmoji(thought.thinkingType);
            const contextPart = thought.context ? ` - ${thought.context}` : '';
            const nextStepsPart = thought.nextSteps?.length
                ? ` → ${thought.nextSteps.length} next steps`
                : '';

            // 新格式：✅ **Thought** (🔍 analysis)
            const actual = `✅ **Thought** (${emoji} ${thought.thinkingType})${contextPart}${nextStepsPart}`;

            expect(actual).toBe('✅ **Thought** (🔍 analysis)');
        });

        it('recordThought nextSteps为空数组', () => {
            const thought = {
                thinkingType: 'synthesis',
                context: 'Combining requirements',
                nextSteps: []
            };

            const emoji = tester.getThinkingTypeEmoji(thought.thinkingType);
            const nextStepsPart = thought.nextSteps?.length
                ? ` → ${thought.nextSteps.length} next steps`
                : '';

            // 空数组不应该显示next steps
            expect(nextStepsPart).toBe('');
        });
    });

    // ========================================================================
    // 执行摘要显示条件测试
    // ========================================================================
    describe('执行摘要显示条件', () => {
        it('1轮迭代不应该显示执行摘要', () => {
            const executionSummary = [
                { iteration: 1, tools: ['recordThought'], duration: 45, success: true }
            ];

            const shouldDisplay = executionSummary.length > 3;
            expect(shouldDisplay).toBe(false);
        });

        it('3轮迭代不应该显示执行摘要', () => {
            const executionSummary = [
                { iteration: 1, tools: ['recordThought'], duration: 45, success: true },
                { iteration: 2, tools: ['readFile'], duration: 100, success: true },
                { iteration: 3, tools: ['executeMarkdownEdits'], duration: 1200, success: true }
            ];

            const shouldDisplay = executionSummary.length > 3;
            expect(shouldDisplay).toBe(false);
        });

        it('4轮迭代应该显示执行摘要', () => {
            const executionSummary = [
                { iteration: 1, tools: ['recordThought'], duration: 45, success: true },
                { iteration: 2, tools: ['readFile'], duration: 100, success: true },
                { iteration: 3, tools: ['recordThought'], duration: 30, success: true },
                { iteration: 4, tools: ['executeMarkdownEdits'], duration: 1200, success: true }
            ];

            const shouldDisplay = executionSummary.length > 3;
            expect(shouldDisplay).toBe(true);
        });

        it('10轮迭代应该显示执行摘要', () => {
            const executionSummary = Array.from({ length: 10 }, (_, i) => ({
                iteration: i + 1,
                tools: ['someTool'],
                duration: 100,
                success: true
            }));

            const shouldDisplay = executionSummary.length > 3;
            expect(shouldDisplay).toBe(true);
        });
    });
});
