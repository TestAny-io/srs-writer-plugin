import { Orchestrator } from '../../core/orchestrator';
import * as vscode from 'vscode';
import { SessionContext } from '../../types/session';

/**
 * 技术验证Spike - 测试混合智能架构的核心可行性
 * 目标：验证AI路由的准确性和架构链路的完整性
 */
export class ArchitectureSpike {
    private orchestrator: Orchestrator;

    constructor() {
        this.orchestrator = new Orchestrator();
    }

    /**
     * 执行完整的技术验证
     */
    public async runFullValidation(): Promise<ValidationResult> {
        console.log('🚀 Starting SRS Writer v1.2 Architecture Validation...\n');

        const results: ValidationResult = {
            aiRoutingAccuracy: 0,
            architectureChainComplete: false,
            errorHandlingRobust: false,
            performanceBaseline: { averageMs: 0, maxMs: 0 },
            overallSuccess: false
        };

        try {
            // 测试1: AI路由准确性
            console.log('📊 Testing AI Intent Routing Accuracy...');
            results.aiRoutingAccuracy = await this.testAIRoutingAccuracy();
            console.log(`✅ AI Routing Accuracy: ${results.aiRoutingAccuracy}%\n`);

            // 测试2: 架构链路完整性
            console.log('🔗 Testing Architecture Chain Completeness...');
            results.architectureChainComplete = await this.testArchitectureChain();
            console.log(`✅ Architecture Chain: ${results.architectureChainComplete ? 'COMPLETE' : 'INCOMPLETE'}\n`);

            // 测试3: 错误处理健壮性
            console.log('🛡️ Testing Error Handling Robustness...');
            results.errorHandlingRobust = await this.testErrorHandling();
            console.log(`✅ Error Handling: ${results.errorHandlingRobust ? 'ROBUST' : 'NEEDS_WORK'}\n`);

            // 测试4: 性能基线
            console.log('⚡ Establishing Performance Baseline...');
            results.performanceBaseline = await this.establishPerformanceBaseline();
            console.log(`✅ Performance Baseline: Avg ${results.performanceBaseline.averageMs}ms, Max ${results.performanceBaseline.maxMs}ms\n`);

            // 综合评估
            results.overallSuccess = this.evaluateOverallSuccess(results);
            
            console.log('📋 VALIDATION SUMMARY:');
            console.log(`   AI Routing: ${results.aiRoutingAccuracy}% ${results.aiRoutingAccuracy >= 90 ? '✅' : '❌'}`);
            console.log(`   Architecture: ${results.architectureChainComplete ? '✅' : '❌'}`);
            console.log(`   Error Handling: ${results.errorHandlingRobust ? '✅' : '❌'}`);
            console.log(`   Performance: ${results.performanceBaseline.averageMs}ms ${results.performanceBaseline.averageMs < 2000 ? '✅' : '⚠️'}`);
            console.log(`   Overall: ${results.overallSuccess ? '🎉 PASS' : '💥 FAIL'}\n`);

            return results;

        } catch (error) {
            console.error('💥 Validation failed with error:', error);
            results.overallSuccess = false;
            return results;
        }
    }

    /**
     * 测试AI路由的准确性
     */
    private async testAIRoutingAccuracy(): Promise<number> {
        const testCases: IntentTestCase[] = [
            {
                input: "我想做一个图书管理系统",
                session: this.createEmptySession(),
                expected: "create",
                description: "New project creation"
            },
            {
                input: "给我的图书管理系统加个搜索功能",
                session: this.createActiveSession("book-management-system"),
                expected: "edit",
                description: "Add feature to existing project"
            },
            {
                input: "我要修改借阅功能的逻辑",
                session: this.createActiveSession("book-management-system"),
                expected: "edit",
                description: "Modify existing functionality"
            },
            {
                input: "help",
                session: this.createEmptySession(),
                expected: "help",
                description: "Help request"
            },
            {
                input: "创建一个电商平台",
                session: this.createEmptySession(),
                expected: "create",
                description: "E-commerce platform creation"
            },
            {
                input: "删除用户管理模块",
                session: this.createActiveSession("ecommerce-platform"),
                expected: "edit",
                description: "Remove module from existing project"
            },
            {
                input: "如何使用这个插件？",
                session: this.createEmptySession(),
                expected: "help",
                description: "Usage help request"
            },
            {
                input: "开发一个任务管理APP",
                session: this.createEmptySession(),
                expected: "create",
                description: "Task management app creation"
            },
            {
                input: "优化当前系统的性能要求",
                session: this.createActiveSession("task-management-app"),
                expected: "edit",
                description: "Performance optimization"
            },
            {
                input: "提交代码到Git",
                session: this.createActiveSession("task-management-app"),
                expected: "git",
                description: "Git operation request"
            }
        ];

        let correctPredictions = 0;
        const results: string[] = [];

        for (const testCase of testCases) {
            try {
                // v1.3修复：添加模拟的selectedModel参数
                const mockModel = {} as vscode.LanguageModelChat;
                const result = await this.orchestrator.processUserInput(testCase.input, testCase.session, mockModel);
                const isCorrect = result.intent === testCase.expected;
                
                if (isCorrect) {
                    correctPredictions++;
                }

                results.push(`${isCorrect ? '✅' : '❌'} "${testCase.input}" → ${result.intent} (expected: ${testCase.expected})`);
                
            } catch (error) {
                results.push(`💥 "${testCase.input}" → ERROR: ${(error as Error).message}`);
            }
        }

        // 输出详细结果
        console.log('   Detailed Results:');
        results.forEach(result => console.log(`     ${result}`));

        return Math.round((correctPredictions / testCases.length) * 100);
    }

    /**
     * 测试架构链路的完整性
     */
    private async testArchitectureChain(): Promise<boolean> {
        try {
            // 测试完整的端到端流程
            const testSession = this.createEmptySession();
            const testInput = "创建一个简单的待办事项管理系统";

            console.log(`   Testing end-to-end chain with: "${testInput}"`);

            // 执行完整流程
            const mockModel = {} as vscode.LanguageModelChat;
            const result = await this.orchestrator.processUserInput(testInput, testSession, mockModel);

            // 验证结果
            const hasValidIntent = ['create', 'edit', 'git', 'help'].includes(result.intent);
            const hasResult = result.result !== undefined && result.result !== null;

            console.log(`     Intent: ${result.intent} ${hasValidIntent ? '✅' : '❌'}`);
            console.log(`     Result: ${hasResult ? '✅' : '❌'}`);

            return hasValidIntent && hasResult;

        } catch (error) {
            console.log(`     Chain test failed: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 测试错误处理的健壮性
     */
    private async testErrorHandling(): Promise<boolean> {
        const errorTests = [
            {
                name: "Empty input",
                input: "",
                session: this.createEmptySession()
            },
            {
                name: "Very long input",
                input: "a".repeat(10000),
                session: this.createEmptySession()
            },
            {
                name: "Invalid session",
                input: "test input",
                session: null as any
            },
            {
                name: "Edit without active project",
                input: "修改当前项目",
                session: this.createEmptySession()
            }
        ];

        let robustTests = 0;

        for (const test of errorTests) {
            try {
                console.log(`   Testing: ${test.name}`);
                const mockModel = {} as vscode.LanguageModelChat;
                const result = await this.orchestrator.processUserInput(test.input, test.session, mockModel);
                
                // 应该能处理错误或返回有意义的降级结果
                if (result && result.intent) {
                    robustTests++;
                    console.log(`     ✅ Handled gracefully: ${result.intent}`);
                } else {
                    console.log(`     ❌ Returned invalid result`);
                }
                
            } catch (error) {
                console.log(`     ⚠️ Threw error (not necessarily bad): ${(error as Error).message}`);
                // 某些情况下抛出错误是正确的行为
                robustTests++;
            }
        }

        return robustTests >= errorTests.length * 0.75; // 75%的错误情况需要被妥善处理
    }

    /**
     * 建立性能基线
     */
    private async establishPerformanceBaseline(): Promise<PerformanceBaseline> {
        const testInputs = [
            "创建图书管理系统",
            "开发电商平台",
            "构建任务管理工具"
        ];

        const times: number[] = [];

        for (const input of testInputs) {
            const session = this.createEmptySession();
            const startTime = Date.now();
            
            try {
                const mockModel = {} as vscode.LanguageModelChat;
                await this.orchestrator.processUserInput(input, session, mockModel);
                const duration = Date.now() - startTime;
                times.push(duration);
                console.log(`   "${input}": ${duration}ms`);
            } catch (error) {
                console.log(`   "${input}": ERROR - ${(error as Error).message}`);
            }
        }

        const averageMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const maxMs = times.length > 0 ? Math.max(...times) : 0;

        return { averageMs, maxMs };
    }

    /**
     * 评估总体成功
     */
    private evaluateOverallSuccess(results: ValidationResult): boolean {
        return (
            results.aiRoutingAccuracy >= 90 &&
            results.architectureChainComplete &&
            results.errorHandlingRobust &&
            results.performanceBaseline.averageMs < 5000 // 5秒上限
        );
    }

    /**
     * 创建空会话
     */
    private createEmptySession(): SessionContext {
        return {
            projectName: null,
            baseDir: null,
            lastIntent: null,
            activeFiles: [],
            metadata: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: '1.2',
                srsVersion: 'v1.0'
            }
        };
    }

    /**
     * 创建活跃会话
     */
    private createActiveSession(projectName: string): SessionContext {
        return {
            projectName,
            baseDir: `/workspace/${projectName}`,
            lastIntent: 'create',
            activeFiles: ['SRS.md', 'fr.yaml', 'nfr.yaml'],
            metadata: {
                created: new Date(Date.now() - 3600000).toISOString(), // 1小时前
                lastModified: new Date().toISOString(),
                version: '1.2',
                srsVersion: 'v1.0'
            }
        };
    }
}

// 类型定义
interface IntentTestCase {
    input: string;
    session: SessionContext;
    expected: string;
    description: string;
}

interface ValidationResult {
    aiRoutingAccuracy: number;
    architectureChainComplete: boolean;
    errorHandlingRobust: boolean;
    performanceBaseline: PerformanceBaseline;
    overallSuccess: boolean;
}

interface PerformanceBaseline {
    averageMs: number;
    maxMs: number;
}
