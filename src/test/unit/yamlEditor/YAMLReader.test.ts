/**
 * YAMLReader 单元测试
 * 测试parseMode和targets功能
 */

// Mock fs/promises module
const mockReadFile = jest.fn();
const mockStat = jest.fn();
const mockAccess = jest.fn();

jest.mock('fs/promises', () => ({
    readFile: (...args: any[]) => mockReadFile(...args),
    stat: (...args: any[]) => mockStat(...args),
    access: (...args: any[]) => mockAccess(...args)
}));

// Mock path resolver
const mockResolveWorkspacePath = jest.fn();
jest.mock('../../../utils/path-resolver', () => ({
    resolveWorkspacePath: (...args: any[]) => mockResolveWorkspacePath(...args)
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            error: jest.fn()
        }))
    }
}));

import * as yaml from 'js-yaml';
import { YAMLReader } from '../../../tools/document/yamlEditor/YAMLReader';
import { ReadYAMLArgs, ReadYAMLResult, ParseMode } from '../../../tools/document/yamlEditor/types';

describe('YAMLReader - parseMode and targets functionality', () => {
    const testFilePath = '/test/workspace/test.yaml';
    let testYAMLContent: string;
    let testData: any;

    beforeEach(() => {
        // 创建测试数据
        testData = {
            project_info: {
                name: 'Test Project',
                version: '1.0.0',
                description: 'Test description'
            },
            functional_requirements: [
                {
                    id: 'FR-001',
                    title: 'User Authentication',
                    description: 'Users should be able to log in',
                    priority: 'high'
                },
                {
                    id: 'FR-002',
                    title: 'Data Export',
                    description: 'Users should be able to export data',
                    priority: 'medium'
                }
            ],
            technical_specs: {
                database: {
                    type: 'PostgreSQL',
                    version: '14.0'
                },
                api: {
                    protocol: 'REST',
                    format: 'JSON'
                }
            }
        };

        testYAMLContent = yaml.dump(testData);

        // Setup mocks
        mockResolveWorkspacePath.mockResolvedValue(testFilePath);
        mockReadFile.mockResolvedValue(testYAMLContent);
        mockStat.mockResolvedValue({
            isFile: () => true
        } as any);
        mockAccess.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('parseMode parameter', () => {
        describe('parseMode: structure', () => {
            it('should return only structure information without content or parsedData', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'structure',
                    maxDepth: 3
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(''); // No content
                expect(result.parsedData).toBeUndefined(); // No parsed data
                expect(result.structure).toBeDefined();
                expect(result.structure!.keyPaths).toContain('project_info');
                expect(result.structure!.keyPaths).toContain('project_info.name');
                expect(result.structure!.keyPaths).toContain('functional_requirements');
                expect(result.structure!.totalKeys).toBeGreaterThan(0);
            });

            it('should respect maxDepth parameter in structure mode', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'structure',
                    maxDepth: 1
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.structure).toBeDefined();
                // maxDepth=1 应该只包含顶层键
                expect(result.structure!.keyPaths).toContain('project_info');
                expect(result.structure!.keyPaths).toContain('functional_requirements');
                expect(result.structure!.keyPaths).toContain('technical_specs');
                // 不应包含深层键
                expect(result.structure!.keyPaths).not.toContain('project_info.name');
            });
        });

        describe('parseMode: content', () => {
            it('should return parsedData without content string or structure (避免重复输出)', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'content'
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(''); // 🎯 修复后：content为空字符串，避免重复输出
                expect(result.parsedData).toBeDefined();
                expect(result.parsedData).toEqual(testData);
                expect(result.structure).toBeUndefined(); // No structure
            });
        });

        describe('parseMode: full', () => {
            it('should return everything (content + parsedData + structure)', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'full',
                    maxDepth: 3
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(testYAMLContent);
                expect(result.parsedData).toBeDefined();
                expect(result.parsedData).toEqual(testData);
                expect(result.structure).toBeDefined();
                expect(result.structure!.totalKeys).toBeGreaterThan(0);
            });
        });

        describe('parseMode default behavior', () => {
            it('should default to "content" mode when parseMode is not specified', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml'
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(testYAMLContent);
                expect(result.parsedData).toBeDefined();
                // 根据实现，默认行为会检查includeStructure参数
            });
        });
    });

    describe('targets parameter', () => {
        describe('single keyPath target', () => {
            it('should extract a single existing keyPath', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'project_info.name'
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].path).toBe('project_info.name');
                expect(result.targets![0].value).toBe('Test Project');
                expect(result.targets![0].valueType).toBe('string');
            });

            it('should extract object keyPath with structure', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'full',  // 明确指定需要value和structure
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'project_info',
                            maxDepth: 2
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].path).toBe('project_info');
                expect(result.targets![0].value).toEqual(testData.project_info);
                expect(result.targets![0].valueType).toBe('object');
                expect(result.targets![0].structure).toBeDefined();
                expect(result.targets![0].structure!.keyPaths).toContain('name');
                expect(result.targets![0].structure!.keyPaths).toContain('version');
            });

            it('should extract array keyPath with structure', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'full',  // 明确指定需要value和structure
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'functional_requirements',
                            maxDepth: 3
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toEqual(testData.functional_requirements);
                expect(result.targets![0].valueType).toBe('array');
                expect(result.targets![0].structure).toBeDefined();
            });

            it('should extract array element by index', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'full',  // 明确指定需要value和structure
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'functional_requirements.0',
                            maxDepth: 2
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toEqual(testData.functional_requirements[0]);
                expect(result.targets![0].structure).toBeDefined();
                expect(result.targets![0].structure!.keyPaths).toContain('id');
                expect(result.targets![0].structure!.keyPaths).toContain('title');
            });

            it('should extract value only without structure (default parseMode)', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    // parseMode默认为'content'，只返回value
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'functional_requirements'
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(''); // targets模式不返回完整文件
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toEqual(testData.functional_requirements);
                expect(result.targets![0].valueType).toBe('array');
                expect(result.targets![0].structure).toBeUndefined(); // 没有structure字段
            });

            it('should handle non-existent keyPath gracefully', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'non.existent.path'
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(false);
                expect(result.targets![0].error).toBeDefined();
                expect(result.targets![0].error!.message).toContain('键路径不存在');
            });
        });

        describe('multiple targets', () => {
            it('should extract multiple keyPaths successfully', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'project_info.name'
                        },
                        {
                            type: 'keyPath',
                            path: 'project_info.version'
                        },
                        {
                            type: 'keyPath',
                            path: 'functional_requirements.0.title'
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(3);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toBe('Test Project');
                expect(result.targets![1].success).toBe(true);
                expect(result.targets![1].value).toBe('1.0.0');
                expect(result.targets![2].success).toBe(true);
                expect(result.targets![2].value).toBe('User Authentication');
            });

            it('should handle mixed success and failure targets', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'project_info.name' // exists
                        },
                        {
                            type: 'keyPath',
                            path: 'invalid.path' // doesn't exist
                        },
                        {
                            type: 'keyPath',
                            path: 'technical_specs.database.type' // exists
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(3);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toBe('Test Project');
                expect(result.targets![1].success).toBe(false);
                expect(result.targets![1].error).toBeDefined();
                expect(result.targets![2].success).toBe(true);
                expect(result.targets![2].value).toBe('PostgreSQL');
            });
        });

        describe('targets with parseMode=structure', () => {
            it('should not return value when parseMode is structure', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'structure',
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'project_info',
                            maxDepth: 2
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.content).toBe(''); // No content in structure mode
                expect(result.targets).toBeDefined();
                expect(result.targets).toHaveLength(1);
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].value).toBeUndefined(); // No value
                expect(result.targets![0].structure).toBeDefined(); // But structure exists
            });
        });

        describe('targets maxDepth parameter', () => {
            it('should respect per-target maxDepth', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'structure',  // 需要structure
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'technical_specs',
                            maxDepth: 1 // shallow
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets).toBeDefined();
                expect(result.targets![0].success).toBe(true);
                expect(result.targets![0].structure).toBeDefined();
                // maxDepth=1 应该只包含直接子键
                expect(result.targets![0].structure!.keyPaths).toContain('database');
                expect(result.targets![0].structure!.keyPaths).toContain('api');
                // 不应包含更深层的键
                expect(result.targets![0].structure!.keyPaths).not.toContain('database.type');
            });

            it('should use global maxDepth when target maxDepth is not specified', async () => {
                const args: ReadYAMLArgs = {
                    path: 'test.yaml',
                    parseMode: 'structure',  // 需要structure
                    maxDepth: 2,
                    targets: [
                        {
                            type: 'keyPath',
                            path: 'technical_specs'
                            // no maxDepth specified, should use global maxDepth=2
                        }
                    ]
                };

                const result = await YAMLReader.readAndParse(args);

                expect(result.success).toBe(true);
                expect(result.targets![0].structure).toBeDefined();
            });
        });
    });

    describe('backward compatibility', () => {
        it('should still work with includeStructure parameter', async () => {
            const args: ReadYAMLArgs = {
                path: 'test.yaml',
                includeStructure: true,
                maxDepth: 3
            };

            const result = await YAMLReader.readAndParse(args);

            expect(result.success).toBe(true);
            expect(result.content).toBe(testYAMLContent);
            expect(result.parsedData).toBeDefined();
            expect(result.structure).toBeDefined();
        });

        it('should respect includeStructure=false', async () => {
            const args: ReadYAMLArgs = {
                path: 'test.yaml',
                includeStructure: false
            };

            const result = await YAMLReader.readAndParse(args);

            expect(result.success).toBe(true);
            expect(result.content).toBe(testYAMLContent);
            expect(result.parsedData).toBeDefined();
            expect(result.structure).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should handle file read errors gracefully', async () => {
            mockReadFile.mockRejectedValue(new Error('File read error'));

            const args: ReadYAMLArgs = {
                path: 'test.yaml',
                parseMode: 'content'
            };

            const result = await YAMLReader.readAndParse(args);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('YAML文件读取失败');
        });

        it('should handle YAML parsing errors', async () => {
            mockReadFile.mockResolvedValue('invalid: yaml: content: [');

            const args: ReadYAMLArgs = {
                path: 'test.yaml',
                parseMode: 'content'
            };

            const result = await YAMLReader.readAndParse(args);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('token optimization verification', () => {
        it('structure mode should be significantly smaller than content mode', async () => {
            const structureArgs: ReadYAMLArgs = {
                path: 'test.yaml',
                parseMode: 'structure',
                maxDepth: 2
            };

            const contentArgs: ReadYAMLArgs = {
                path: 'test.yaml',
                parseMode: 'content'
            };

            const structureResult = await YAMLReader.readAndParse(structureArgs);
            const contentResult = await YAMLReader.readAndParse(contentArgs);

            // Structure mode should have no content or data
            expect(structureResult.content).toBe('');
            expect(structureResult.parsedData).toBeUndefined();

            // 🎯 Content mode should have parsedData but no content string (避免重复)
            expect(contentResult.content).toBe(''); // 修复后：不返回原始字符串
            expect(contentResult.parsedData).toBeDefined();
            expect(contentResult.parsedData).toEqual(testData); // 数据在parsedData中

            // Structure should still provide useful information
            expect(structureResult.structure).toBeDefined();
            expect(structureResult.structure!.totalKeys).toBeGreaterThan(0);
        });

        it('targets mode should only return requested data', async () => {
            const targetsArgs: ReadYAMLArgs = {
                path: 'test.yaml',
                targets: [
                    {
                        type: 'keyPath',
                        path: 'project_info.name'
                    }
                ]
            };

            const fullArgs: ReadYAMLArgs = {
                path: 'test.yaml',
                parseMode: 'full'
            };

            const targetsResult = await YAMLReader.readAndParse(targetsArgs);
            const fullResult = await YAMLReader.readAndParse(fullArgs);

            // Targets should only have one result
            expect(targetsResult.targets).toHaveLength(1);
            expect(targetsResult.targets![0].value).toBe('Test Project');

            // Full result should have everything
            expect(fullResult.content).toBe(testYAMLContent);
            expect(fullResult.parsedData).toEqual(testData);
            expect(fullResult.structure).toBeDefined();
        });
    });
});
