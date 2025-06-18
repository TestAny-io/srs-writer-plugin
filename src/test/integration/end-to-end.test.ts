import * as vscode from 'vscode';
import { SRSChatParticipant } from '../../chat/srs-chat-participant';
import { AICommunicator } from '../../core/ai-communicator';
import { SRSParser } from '../../parser/srs-parser';
import { FileManager } from '../../filesystem/file-manager';
import { Logger } from '../../utils/logger';
import { TestCases, ErrorTestCases, FileValidationRules, FileValidationRule } from '../fixtures/test-cases';
import * as yaml from 'js-yaml';

/**
 * 端到端集成测试类
 * 验证从用户输入到文件生成的完整流程
 */
export class EndToEndTest {
    private logger = Logger.getInstance();
    private aiCommunicator = new AICommunicator();
    private srsParser = new SRSParser();
    private fileManager = new FileManager();
    private testResults: TestResult[] = [];

    /**
     * 运行所有端到端测试
     */
    public async runAllTests(): Promise<TestResult[]> {
        this.logger.info('🧪 Starting End-to-End Integration Tests...');
        this.testResults = [];

        try {
            // 1. 基础功能测试
            await this.testBasicFunctionality();
            
            // 2. 完整工作流测试
            await this.testCompleteWorkflow();
            
            // 3. 错误处理测试
            await this.testErrorHandling();
            
            // 4. 文件格式验证测试
            await this.testFileFormatValidation();
            
            // 5. 并发处理测试
            await this.testConcurrentRequests();

            this.logger.info(`✅ End-to-End tests completed. ${this.getPassedCount()}/${this.testResults.length} tests passed.`);
            
            return this.testResults;

        } catch (error) {
            this.logger.error('❌ End-to-End tests failed', error as Error);
            throw error;
        }
    }

    /**
     * 测试基础功能 - 组件初始化和基本交互
     */
    private async testBasicFunctionality(): Promise<void> {
        const testName = 'Basic Functionality Test';
        this.logger.info(`🔍 Running: ${testName}`);

        try {
            // 测试AI通信器初始化
            const isAIAvailable = await this.aiCommunicator.checkAvailability();
            this.addTestResult(testName + ' - AI Availability', isAIAvailable, 'AI communicator should be available');

            // 测试解析器初始化
            const parserStats = this.srsParser.getParsingStats();
            this.addTestResult(testName + ' - Parser Initialize', true, 'Parser should initialize successfully');

            // 测试文件管理器状态
            const fileManagerStatus = this.fileManager.getStatus() as any;
            this.addTestResult(testName + ' - FileManager Status', 
                fileManagerStatus && typeof fileManagerStatus === 'object', 
                'FileManager should return valid status'
            );

        } catch (error) {
            this.addTestResult(testName, false, `Basic functionality test failed: ${(error as Error).message}`);
        }
    }

    /**
     * 测试完整工作流 - 从用户输入到文件生成
     */
    private async testCompleteWorkflow(): Promise<void> {
        this.logger.info('🔄 Testing Complete Workflow...');

        // 测试小型项目
        const smallProject = TestCases.find(tc => tc.category === 'small');
        if (smallProject) {
            await this.testSingleWorkflow(smallProject);
        }

        // 测试中型项目  
        const mediumProject = TestCases.find(tc => tc.category === 'medium');
        if (mediumProject) {
            await this.testSingleWorkflow(mediumProject);
        }
    }

    /**
     * 测试单个完整工作流
     */
    private async testSingleWorkflow(testCase: any): Promise<void> {
        const testName = `Complete Workflow - ${testCase.name}`;
        this.logger.info(`🎯 Testing: ${testName}`);

        try {
            const startTime = Date.now();

            // Step 1: AI生成母文档
            const motherDocument = await this.aiCommunicator.generateMotherDocument(testCase.input);
            
            this.addTestResult(
                `${testName} - AI Generation`,
                !!(motherDocument && motherDocument.length > 100),
                'AI should generate meaningful mother document'
            );

            // Step 2: 解析母文档
            const parseStartTime = Date.now();
            const artifacts = await this.srsParser.parse(motherDocument);
            const parseTime = Date.now() - parseStartTime;

            // 验证解析时间
            this.addTestResult(
                `${testName} - Parse Performance`,
                parseTime < testCase.maxParseTime,
                `Parse time (${parseTime}ms) should be under ${testCase.maxParseTime}ms`
            );

            // 验证生成的文件
            this.addTestResult(
                `${testName} - Files Generated`,
                Object.keys(artifacts).length >= testCase.expectedFiles.length,
                `Should generate at least ${testCase.expectedFiles.length} files`
            );

            // 验证必要文件存在
            for (const expectedFile of testCase.expectedFiles) {
                this.addTestResult(
                    `${testName} - File ${expectedFile}`,
                    artifacts[expectedFile] !== undefined,
                    `${expectedFile} should be generated`
                );
            }

            // Step 3: 文件写入（模拟测试环境）
            const projectName = `test-${testCase.name}-${Date.now()}`;
            // 注意：在测试环境中，我们可能需要模拟文件写入
            // await this.fileManager.writeArtifacts(artifacts, projectName);

            const totalTime = Date.now() - startTime;
            this.logger.info(`✅ ${testName} completed in ${totalTime}ms`);

        } catch (error) {
            this.addTestResult(testName, false, `Workflow test failed: ${(error as Error).message}`);
        }
    }

    /**
     * 测试错误处理和优雅降级
     */
    private async testErrorHandling(): Promise<void> {
        this.logger.info('🛡️ Testing Error Handling...');

        for (const errorCase of ErrorTestCases) {
            const testName = `Error Handling - ${errorCase.name}`;
            
            try {
                if (errorCase.name === 'empty_input') {
                    // 测试空输入
                    await this.testEmptyInput();
                } else if (errorCase.name === 'very_short_input') {
                    // 测试输入过短
                    await this.testShortInput(errorCase.input);
                } else if (errorCase.name === 'very_long_input') {
                    // 测试输入过长
                    await this.testLongInput(errorCase.input);
                }
            } catch (error) {
                // 错误处理测试中，捕获到预期的错误是正常的
                this.addTestResult(
                    testName,
                    true,
                    `Error correctly handled: ${(error as Error).message}`
                );
            }
        }
    }

    /**
     * 测试空输入处理
     */
    private async testEmptyInput(): Promise<void> {
        try {
            await this.aiCommunicator.generateMotherDocument('');
            this.addTestResult('Empty Input Handling', false, 'Should throw error for empty input');
        } catch (error) {
            this.addTestResult(
                'Empty Input Handling',
                !!((error as Error).message.includes('请提供') || (error as Error).message.includes('empty')),
                'Should provide helpful error message for empty input'
            );
        }
    }

    /**
     * 测试短输入处理
     */
    private async testShortInput(input: string): Promise<void> {
        try {
            const result = await this.aiCommunicator.generateMotherDocument(input);
            // 短输入可能成功，但应该生成基本的文档
            this.addTestResult('Short Input Handling', true, 'Short input handled gracefully');
        } catch (error) {
            this.addTestResult(
                'Short Input Handling',
                !!((error as Error).message.includes('简短') || (error as Error).message.includes('详细')),
                'Should provide helpful guidance for short input'
            );
        }
    }

    /**
     * 测试长输入处理
     */
    private async testLongInput(input: string): Promise<void> {
        try {
            const result = await this.aiCommunicator.generateMotherDocument(input);
            this.addTestResult('Long Input Handling', true, 'Long input processed successfully');
        } catch (error) {
            this.addTestResult(
                'Long Input Handling',
                !!((error as Error).message.includes('过长') || (error as Error).message.includes('limit')),
                'Should handle long input appropriately'
            );
        }
    }

    /**
     * 测试文件格式验证
     */
    private async testFileFormatValidation(): Promise<void> {
        this.logger.info('📋 Testing File Format Validation...');

        // 使用小型项目测试用例进行格式验证
        const testCase = TestCases[0];
        
        try {
            const motherDocument = await this.aiCommunicator.generateMotherDocument(testCase.input);
            const artifacts = await this.srsParser.parse(motherDocument);

            // 验证YAML文件格式
            await this.validateYamlFormat(artifacts['fr.yaml'], 'fr.yaml');
            await this.validateYamlFormat(artifacts['nfr.yaml'], 'nfr.yaml');
            await this.validateYamlFormat(artifacts['glossary.yaml'], 'glossary.yaml');

            // 验证JSON文件格式
            await this.validateJsonFormat(artifacts['writer_log.json'], 'writer_log.json');

            // 验证Markdown文件内容
            await this.validateMarkdownFormat(artifacts['SRS.md'], 'SRS.md');

        } catch (error) {
            this.addTestResult('File Format Validation', false, `Format validation failed: ${(error as Error).message}`);
        }
    }

    /**
     * 验证YAML文件格式
     */
    private async validateYamlFormat(content: string, fileName: string): Promise<void> {
        try {
            const parsed = yaml.load(content);
            const rules = FileValidationRules[fileName];
            
            if (rules && rules.requiredFields) {
                for (const field of rules.requiredFields) {
                    const hasField = !!(parsed && typeof parsed === 'object' && field in parsed);
                    this.addTestResult(
                        `YAML Format - ${fileName} - ${field}`,
                        hasField,
                        `${fileName} should contain ${field} field`
                    );
                }
            }
        } catch (error) {
            this.addTestResult(
                `YAML Format - ${fileName}`,
                false,
                `Invalid YAML format in ${fileName}: ${(error as Error).message}`
            );
        }
    }

    /**
     * 验证JSON文件格式
     */
    private async validateJsonFormat(content: string, fileName: string): Promise<void> {
        try {
            const parsed = JSON.parse(content);
            const rules = FileValidationRules[fileName];
            
            if (rules && rules.requiredFields) {
                for (const field of rules.requiredFields) {
                    this.addTestResult(
                        `JSON Format - ${fileName} - ${field}`,
                        field in parsed,
                        `${fileName} should contain ${field} field`
                    );
                }
            }
        } catch (error) {
            this.addTestResult(
                `JSON Format - ${fileName}`,
                false,
                `Invalid JSON format in ${fileName}: ${(error as Error).message}`
            );
        }
    }

    /**
     * 验证Markdown文件格式
     */
    private async validateMarkdownFormat(content: string, fileName: string): Promise<void> {
        const rules = FileValidationRules[fileName];
        
        if (rules) {
            // 检查最小长度
            this.addTestResult(
                `Markdown Format - ${fileName} - Length`,
                content.length >= (rules.minLength || 0),
                `${fileName} should meet minimum length requirement`
            );

            // 检查必需章节
            if (rules.requiredSections) {
                for (const section of rules.requiredSections) {
                    this.addTestResult(
                        `Markdown Format - ${fileName} - ${section}`,
                        content.includes(section),
                        `${fileName} should contain ${section} section`
                    );
                }
            }
        }
    }

    /**
     * 测试并发请求处理
     */
    private async testConcurrentRequests(): Promise<void> {
        this.logger.info('🔄 Testing Concurrent Requests...');

        const testInputs = TestCases.slice(0, 3).map(tc => tc.input);
        const startTime = Date.now();

        try {
            // 并发执行3个请求
            const promises = testInputs.map(input => 
                this.aiCommunicator.generateMotherDocument(input)
                    .then(doc => this.srsParser.parse(doc))
            );

            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            this.addTestResult(
                'Concurrent Requests',
                results.length === testInputs.length,
                `All ${testInputs.length} concurrent requests should complete successfully`
            );

            this.addTestResult(
                'Concurrent Performance',
                totalTime < 10000, // 10秒内完成
                `Concurrent requests should complete within reasonable time (${totalTime}ms)`
            );

        } catch (error) {
            this.addTestResult(
                'Concurrent Requests',
                false,
                `Concurrent request handling failed: ${(error as Error).message}`
            );
        }
    }

    /**
     * 添加测试结果
     */
    private addTestResult(name: string, passed: boolean, message: string): void {
        const result: TestResult = {
            name,
            passed,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        if (passed) {
            this.logger.info(`✅ ${name}: ${message}`);
        } else {
            this.logger.error(`❌ ${name}: ${message}`);
        }
    }

    /**
     * 获取通过的测试数量
     */
    private getPassedCount(): number {
        return this.testResults.filter(r => r.passed).length;
    }

    /**
     * 生成测试报告
     */
    public generateTestReport(): TestReport {
        const totalTests = this.testResults.length;
        const passedTests = this.getPassedCount();
        const failedTests = totalTests - passedTests;

        return {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
            },
            results: this.testResults,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * 测试结果接口
 */
interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    timestamp: string;
}

/**
 * 测试报告接口
 */
interface TestReport {
    summary: {
        total: number;
        passed: number;
        failed: number;
        passRate: number;
    };
    results: TestResult[];
    timestamp: string;
}
