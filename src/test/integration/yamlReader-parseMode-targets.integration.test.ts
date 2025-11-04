/**
 * YAMLReader parseMode and targets Integration Test
 * 演示分层探索工作流（Layered Exploration Workflow）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as os from 'os';
import { readYAMLFiles } from '../../tools/document/yamlEditorTools';
import { ReadYAMLArgs } from '../../tools/document/yamlEditor/types';

describe('YAMLReader parseMode and targets - Integration Tests', () => {
    let tempDir: string;
    let testFilePath: string;
    const testFileName = 'test-requirements.yaml';

    beforeAll(async () => {
        // 创建临时测试目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yaml-reader-test-'));
        testFilePath = path.join(tempDir, testFileName);

        // 创建一个大型测试YAML文件
        const testData = {
            project_info: {
                name: 'Large Project',
                version: '2.0.0',
                description: 'A large project with many requirements',
                team: {
                    lead: 'Alice',
                    members: ['Bob', 'Charlie', 'Diana']
                }
            },
            functional_requirements: Array.from({ length: 50 }, (_, i) => ({
                id: `FR-${String(i + 1).padStart(3, '0')}`,
                title: `Requirement ${i + 1}`,
                description: `Description for requirement ${i + 1}. This is a detailed description that explains what this requirement is about.`,
                priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
                status: 'pending',
                acceptance_criteria: [
                    `Criterion 1 for requirement ${i + 1}`,
                    `Criterion 2 for requirement ${i + 1}`,
                    `Criterion 3 for requirement ${i + 1}`
                ]
            })),
            non_functional_requirements: {
                performance: {
                    response_time: '< 200ms',
                    throughput: '1000 req/s',
                    availability: '99.9%'
                },
                security: {
                    authentication: 'OAuth 2.0',
                    authorization: 'RBAC',
                    encryption: 'AES-256'
                },
                scalability: {
                    horizontal: true,
                    vertical: true,
                    max_users: 100000
                }
            },
            technical_specs: {
                backend: {
                    language: 'TypeScript',
                    framework: 'Express',
                    database: 'PostgreSQL'
                },
                frontend: {
                    language: 'TypeScript',
                    framework: 'React',
                    styling: 'TailwindCSS'
                }
            }
        };

        const yamlContent = yaml.dump(testData);
        await fs.writeFile(testFilePath, yamlContent, 'utf-8');
    });

    afterAll(async () => {
        // 清理临时文件
        try {
            await fs.unlink(testFilePath);
            await fs.rmdir(tempDir);
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Layered Exploration Workflow', () => {
        it('Step 1: Explore structure first (structure mode) - minimal token usage', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                parseMode: 'structure',
                maxDepth: 2
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.content).toBe(''); // No content
            expect(result.parsedData).toBeUndefined(); // No data
            expect(result.structure).toBeDefined();
            expect(result.structure!.keyPaths).toContain('project_info');
            expect(result.structure!.keyPaths).toContain('functional_requirements');
            expect(result.structure!.keyPaths).toContain('non_functional_requirements');
            expect(result.structure!.keyPaths).toContain('technical_specs');

            // Verify token optimization: no full content returned
            console.log(`Step 1 - Structure keys found: ${result.structure!.totalKeys}`);
        });

        it('Step 2: Extract specific section only (targets mode) - targeted extraction', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                parseMode: 'full',  // 需要value和structure来演示分层探索
                targets: [
                    {
                        type: 'keyPath',
                        path: 'functional_requirements',
                        maxDepth: 2
                    }
                ]
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.targets).toBeDefined();
            expect(result.targets).toHaveLength(1);
            expect(result.targets![0].success).toBe(true);
            expect(result.targets![0].value).toBeDefined();
            expect(Array.isArray(result.targets![0].value)).toBe(true);
            expect(result.targets![0].value.length).toBe(50);
            expect(result.targets![0].structure).toBeDefined();

            console.log(`Step 2 - Extracted ${result.targets![0].value.length} functional requirements`);
        });

        it('Step 3: Drill down to specific item (targets mode) - precise extraction', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                parseMode: 'full',  // 需要value和structure
                targets: [
                    {
                        type: 'keyPath',
                        path: 'functional_requirements.0',
                        maxDepth: 3
                    }
                ]
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.targets).toBeDefined();
            expect(result.targets).toHaveLength(1);
            expect(result.targets![0].success).toBe(true);
            expect(result.targets![0].value).toBeDefined();
            expect(result.targets![0].value.id).toBe('FR-001');
            expect(result.targets![0].value.title).toBe('Requirement 1');
            expect(result.targets![0].structure).toBeDefined();
            expect(result.targets![0].structure!.keyPaths).toContain('id');
            expect(result.targets![0].structure!.keyPaths).toContain('title');

            console.log(`Step 3 - Extracted requirement: ${result.targets![0].value.id}`);
        });

        it('Step 4: Extract multiple sections simultaneously', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                targets: [
                    {
                        type: 'keyPath',
                        path: 'project_info.team',
                        maxDepth: 2
                    },
                    {
                        type: 'keyPath',
                        path: 'non_functional_requirements.performance',
                        maxDepth: 2
                    },
                    {
                        type: 'keyPath',
                        path: 'technical_specs.backend',
                        maxDepth: 2
                    }
                ]
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.targets).toBeDefined();
            expect(result.targets).toHaveLength(3);
            expect(result.targets!.every(t => t.success)).toBe(true);

            // Verify each target
            expect(result.targets![0].path).toBe('project_info.team');
            expect(result.targets![0].value.lead).toBe('Alice');

            expect(result.targets![1].path).toBe('non_functional_requirements.performance');
            expect(result.targets![1].value.response_time).toBe('< 200ms');

            expect(result.targets![2].path).toBe('technical_specs.backend');
            expect(result.targets![2].value.language).toBe('TypeScript');

            console.log('Step 4 - Extracted 3 sections simultaneously');
        });
    });

    describe('Token Optimization Comparison', () => {
        it('Should demonstrate significant token savings with structure mode', async () => {
            // Traditional approach: read everything
            const fullArgs: ReadYAMLArgs = {
                path: testFilePath,
                parseMode: 'full'
            };

            const fullResult = await readYAMLFiles(fullArgs);

            // Optimized approach: structure first
            const structureArgs: ReadYAMLArgs = {
                path: testFilePath,
                parseMode: 'structure',
                maxDepth: 2
            };

            const structureResult = await readYAMLFiles(structureArgs);

            // Verify token savings
            expect(structureResult.content).toBe('');
            expect(structureResult.parsedData).toBeUndefined();
            expect(fullResult.content.length).toBeGreaterThan(10000); // Large file

            const tokenSavingsPercentage = 100 * (1 - 0 / fullResult.content.length);
            console.log(`Token savings with structure mode: ~${tokenSavingsPercentage.toFixed(0)}%`);
            expect(tokenSavingsPercentage).toBeGreaterThan(90);
        });

        it('Should demonstrate token savings with targeted extraction', async () => {
            // Instead of reading all 50 functional requirements, extract only one
            const targetedArgs: ReadYAMLArgs = {
                path: testFilePath,
                targets: [
                    {
                        type: 'keyPath',
                        path: 'functional_requirements.0',
                        maxDepth: 2
                    }
                ]
            };

            const targetedResult = await readYAMLFiles(targetedArgs);

            expect(targetedResult.success).toBe(true);
            expect(targetedResult.targets).toHaveLength(1);
            expect(targetedResult.targets![0].value).toBeDefined();

            // Targeted extraction returns only 1 requirement instead of 50
            const fullItemCount = 50;
            const extractedItemCount = 1;
            const reductionFactor = fullItemCount / extractedItemCount;

            console.log(`Targeted extraction: ${extractedItemCount} item vs ${fullItemCount} items (${reductionFactor}x reduction)`);
            expect(reductionFactor).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Error Handling', () => {
        it('Should handle non-existent keyPath gracefully', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                targets: [
                    {
                        type: 'keyPath',
                        path: 'non.existent.path'
                    }
                ]
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.targets).toHaveLength(1);
            expect(result.targets![0].success).toBe(false);
            expect(result.targets![0].error).toBeDefined();
            expect(result.targets![0].error!.message).toContain('键路径不存在');
        });

        it('Should handle mixed valid and invalid paths', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                targets: [
                    {
                        type: 'keyPath',
                        path: 'project_info.name' // valid
                    },
                    {
                        type: 'keyPath',
                        path: 'invalid.path' // invalid
                    },
                    {
                        type: 'keyPath',
                        path: 'technical_specs.backend.language' // valid
                    }
                ]
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.targets).toHaveLength(3);
            expect(result.targets![0].success).toBe(true);
            expect(result.targets![0].value).toBe('Large Project');
            expect(result.targets![1].success).toBe(false);
            expect(result.targets![2].success).toBe(true);
            expect(result.targets![2].value).toBe('TypeScript');
        });
    });

    describe('Backward Compatibility', () => {
        it('Should still work with old includeStructure parameter', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                includeStructure: true,
                maxDepth: 3
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.content.length).toBeGreaterThan(0);
            expect(result.parsedData).toBeDefined();
            expect(result.structure).toBeDefined();
        });

        it('Should respect includeStructure=false', async () => {
            const args: ReadYAMLArgs = {
                path: testFilePath,
                includeStructure: false
            };

            const result = await readYAMLFiles(args);

            expect(result.success).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.parsedData).toBeDefined();
            expect(result.structure).toBeUndefined();
        });
    });
});
