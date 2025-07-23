import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { requirementScaffoldToolImplementations } from '../../tools/document/requirementScaffoldTools';
import { GenerateResult } from '../../tools/document/scaffoldGenerator/types';

describe('RequirementScaffold Integration Tests', () => {
    const testWorkspaceDir = path.join(__dirname, '../fixtures/scaffoldTest');
    const testSRSPath = path.join(testWorkspaceDir, 'SRS.md');
    const testSchemaPath = path.join(testWorkspaceDir, 'test-schema.yaml');
    const testOutputDir = path.join(testWorkspaceDir, 'scaffold');

    beforeAll(async () => {
        // 确保测试目录存在
        await fs.mkdir(testWorkspaceDir, { recursive: true });
        await fs.mkdir(testOutputDir, { recursive: true });
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fs.rm(testWorkspaceDir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    beforeEach(async () => {
        // 创建测试用的Schema文件
        const testSchema = {
            version: "1.0",
            last_updated: "2024-01-15",
            compatible_versions: ["1.0"],
            description: "Test schema for integration tests",
            metadata_template: {
                status: 'draft',
                created_date: null,
                last_modified: null,
                created_by: '',
                last_modified_by: '',
                version: '1.0'
            },
            entity_mappings: {
                US: {
                    yaml_key: 'user_stories',
                    description: 'User Stories',
                    template: {
                        id: '',
                        summary: '',
                        description: [],
                        as_a: [],
                        i_want_to: [],
                        so_that: [],
                        acceptance_criteria: [],
                        derived_fr: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                UC: {
                    yaml_key: 'use_cases',
                    description: 'Use Cases',
                    template: {
                        id: '',
                        summary: '',
                        description: [],
                        actor: [],
                        preconditions: [],
                        postconditions: [],
                        main_success_scenario: [],
                        extensions: [],
                        derived_fr: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                FR: {
                    yaml_key: 'functional_requirements',
                    description: 'Functional Requirements',
                    template: {
                        id: '',
                        summary: '',
                        description: [],
                        priority: null,
                        source_requirements: [],
                        acceptance_criteria: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                NFR: {
                    yaml_key: 'non_functional_requirements',
                    description: 'Non-Functional Requirements',
                    template: {
                        id: '',
                        summary: '',
                        category: null,
                        description: [],
                        target_measure: [{ metric: '', target_value: null }],
                        priority: null,
                        source_fr: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                IFR: {
                    yaml_key: 'interface_requirements',
                    description: 'Interface Requirements',
                    template: {
                        id: '',
                        summary: '',
                        description: [],
                        interface_type: null,
                        input_data: [],
                        output_data: [],
                        core_validation_rules: [],
                        source_fr: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                DAR: {
                    yaml_key: 'data_requirements',
                    description: 'Data Requirements',
                    template: {
                        id: '',
                        summary: '',
                        description: [],
                        data_entity: [],
                        core_attributes: [],
                        core_validation_rules: [],
                        source_fr: [],
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                }
            },
            adc_mappings: {
                ASSU: {
                    yaml_key: 'assumptions',
                    description: 'Assumptions',
                    template: {
                        id: '',
                        summary: '',
                        assumptions: [],
                        risk_if_false: [],
                        impacted_requirements: [],
                        validation_method: [],
                        owner: '',
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                DEPEN: {
                    yaml_key: 'dependencies',
                    description: 'Dependencies',
                    template: {
                        id: '',
                        summary: '',
                        dependencies: [],
                        impacted_requirements: [],
                        risk_level: null,
                        mitigation_strategy: [],
                        owner: '',
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                },
                CONST: {
                    yaml_key: 'constraints',
                    description: 'Constraints',
                    template: {
                        id: '',
                        summary: '',
                        constraints: [],
                        justification: [],
                        mitigation_strategy: [],
                        owner: '',
                        metadata: {
                            status: 'draft',
                            created_date: null,
                            last_modified: null,
                            created_by: '',
                            last_modified_by: '',
                            version: '1.0'
                        }
                    }
                }
            },
            entity_output_order: [
                'user_stories',
                'use_cases',
                'functional_requirements',
                'non_functional_requirements',
                'interface_requirements',
                'data_requirements',
                'assumptions',
                'dependencies',
                'constraints'
            ],
            enums: {
                status: ['draft', 'approved', 'implemented', 'verified', 'deprecated'],
                priority: ['critical', 'high', 'medium', 'low']
            }
        };

        await fs.writeFile(testSchemaPath, yaml.dump(testSchema), 'utf-8');
    });

    describe('完整的脚手架生成流程', () => {
        test('应该从完整的SRS文档生成正确的脚手架', async () => {
            // 创建测试SRS文档
            const srsContent = `
# 电商平台软件需求规格说明书

## 1. 引言

本文档描述了电商平台的软件需求。

## 2. 用户故事

### 2.1 用户注册登录
US-AUTH-001: 作为新用户，我希望能够注册账户，以便使用平台服务
US-AUTH-002: 作为注册用户，我希望能够登录系统，以便访问个人功能

### 2.2 商品浏览
US-BROWSE-001: 作为用户，我希望能够浏览商品列表，以便找到心仪的商品
US-SEARCH-001: 作为用户，我希望能够搜索商品，以便快速找到特定商品

## 3. 用例

### 3.1 用户管理用例
UC-USER-001: 用户注册用例
UC-USER-002: 用户登录用例

### 3.2 商品管理用例
UC-PRODUCT-001: 商品展示用例
UC-PRODUCT-002: 商品搜索用例

## 4. 功能需求

### 4.1 认证功能
FR-AUTH-001: 系统应支持用户注册功能
FR-AUTH-002: 系统应支持用户登录验证
FR-AUTH-003: 系统应支持密码重置功能

### 4.2 商品功能
FR-PRODUCT-001: 系统应支持商品信息展示
FR-PRODUCT-002: 系统应支持商品搜索功能
FR-PRODUCT-003: 系统应支持商品分类浏览

## 5. 非功能需求

### 5.1 性能要求
NFR-PERF-001: 页面加载时间应在2秒内
NFR-PERF-002: 搜索响应时间应在1秒内

### 5.2 安全要求
NFR-SEC-001: 用户密码应加密存储
NFR-SEC-002: 支持HTTPS加密传输

## 6. 接口需求

### 6.1 API接口
IFR-API-001: 用户认证API接口
IFR-API-002: 商品查询API接口

## 7. 数据需求

### 7.1 用户数据
DAR-USER-001: 用户基础信息数据结构
DAR-USER-002: 用户行为数据结构

## 8. 假设、依赖和约束

### 8.1 系统假设
ADC-ASSU-001: 假设用户具备基本的互联网使用能力
ADC-ASSU-002: 假设系统部署环境网络稳定

### 8.2 外部依赖
ADC-DEPEN-001: 依赖第三方支付接口
ADC-DEPEN-002: 依赖短信验证服务

### 8.3 系统约束
ADC-CONST-001: 必须符合数据保护法规
ADC-CONST-002: 必须在预算范围内实施

## 9. 其他内容

这里有一些不包含ID的普通文本内容。
`;

            await fs.writeFile(testSRSPath, srsContent, 'utf-8');

            // Mock VSCode configuration to use test schema
            const mockConfig = {
                get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
                    if (key === 'srs-writer.requirementScaffold.schemaPath') {
                        return { SCHEMA_PATH: testSchemaPath };
                    }
                    return defaultValue;
                })
            };

            const vscode = require('vscode');
            vscode.workspace = {
                getConfiguration: jest.fn().mockReturnValue(mockConfig),
                workspaceFolders: [{
                    uri: { fsPath: testWorkspaceDir }
                }]
            };

            // 执行脚手架生成
            const result = await requirementScaffoldToolImplementations.generateRequirementScaffold({
                srsFilePath: testSRSPath,
                scaffoldDir: testOutputDir,
                includeMetadata: true
            }) as GenerateResult;

            // 验证执行结果
            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.result!.generatedIds).toBe(28); // 总共28个ID (实际文档内容)
            expect(result.result!.outputPath).toBe(path.join(testOutputDir, 'requirements_scaffold.yaml'));

            // 验证文件确实被创建
            const scaffoldPath = result.result!.outputPath;
            const scaffoldExists = await fs.access(scaffoldPath).then(() => true).catch(() => false);
            expect(scaffoldExists).toBe(true);

            // 读取并验证生成的YAML文件
            const scaffoldContent = await fs.readFile(scaffoldPath, 'utf-8');
            const scaffoldData = yaml.load(scaffoldContent) as any;

            // 验证文件结构
            expect(scaffoldData.user_stories).toBeDefined();
            expect(scaffoldData.use_cases).toBeDefined();
            expect(scaffoldData.functional_requirements).toBeDefined();
            expect(scaffoldData.non_functional_requirements).toBeDefined();
            expect(scaffoldData.interface_requirements).toBeDefined();
            expect(scaffoldData.data_requirements).toBeDefined();
            expect(scaffoldData.assumptions).toBeDefined();
            expect(scaffoldData.dependencies).toBeDefined();
            expect(scaffoldData.constraints).toBeDefined();
            expect(scaffoldData._metadata).toBeDefined();

            // 验证实体数量
            expect(scaffoldData.user_stories).toHaveLength(4);
            expect(scaffoldData.use_cases).toHaveLength(4);
            expect(scaffoldData.functional_requirements).toHaveLength(6);
            expect(scaffoldData.non_functional_requirements).toHaveLength(4);
            expect(scaffoldData.interface_requirements).toHaveLength(2);
            expect(scaffoldData.data_requirements).toHaveLength(2);
            expect(scaffoldData.assumptions).toHaveLength(2);
            expect(scaffoldData.dependencies).toHaveLength(2);
            expect(scaffoldData.constraints).toHaveLength(2);

            // 验证实体顺序（按YAML键的出现顺序）
            const keys = Object.keys(scaffoldData).filter(key => key !== '_metadata');
            const expectedOrder = [
                'user_stories', 'use_cases', 'functional_requirements', 
                'non_functional_requirements', 'interface_requirements', 'data_requirements',
                'assumptions', 'dependencies', 'constraints'
            ];
            expect(keys).toEqual(expectedOrder);

            // 验证特定ID的存在和排序
            const usIds = scaffoldData.user_stories.map((item: any) => item.id);
            expect(usIds).toEqual(['US-AUTH-001', 'US-AUTH-002', 'US-BROWSE-001', 'US-SEARCH-001']);

            const frIds = scaffoldData.functional_requirements.map((item: any) => item.id);
            expect(frIds).toEqual([
                'FR-AUTH-001', 'FR-AUTH-002', 'FR-AUTH-003',
                'FR-PRODUCT-001', 'FR-PRODUCT-002', 'FR-PRODUCT-003'
            ]);

            // 验证元数据
            expect(scaffoldData._metadata.total_ids).toBe(28);
            expect(scaffoldData._metadata.id_breakdown.US).toBe(4);
            expect(scaffoldData._metadata.id_breakdown.UC).toBe(4);
            expect(scaffoldData._metadata.id_breakdown.FR).toBe(6);
            expect(scaffoldData._metadata.id_breakdown.NFR).toBe(4);
            expect(scaffoldData._metadata.id_breakdown.IFR).toBe(2);
            expect(scaffoldData._metadata.id_breakdown.DAR).toBe(2);
            expect(scaffoldData._metadata.id_breakdown['ADC-ASSU']).toBe(2);
            expect(scaffoldData._metadata.id_breakdown['ADC-DEPEN']).toBe(2);
            expect(scaffoldData._metadata.id_breakdown['ADC-CONST']).toBe(2);

            // 验证时间戳
            expect(scaffoldData._metadata.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        test('应该处理空的SRS文档', async () => {
            const emptySrsContent = `
# 空的SRS文档

这个文档没有任何需求ID。

## 章节1
普通文本内容。

## 章节2
更多文本，但没有符合格式的ID。
`;

            await fs.writeFile(testSRSPath, emptySrsContent, 'utf-8');

            const result = await requirementScaffoldToolImplementations.generateRequirementScaffold({
                srsFilePath: testSRSPath,
                scaffoldDir: testOutputDir,
                includeMetadata: false
            }) as GenerateResult;

            expect(result.success).toBe(false);
            expect(result.error).toContain('未在SRS文档中找到任何符合格式的需求ID');
        });

        test('应该处理不存在的SRS文件', async () => {
            const nonExistentPath = path.join(testWorkspaceDir, 'non-existent.md');

            const result = await requirementScaffoldToolImplementations.generateRequirementScaffold({
                srsFilePath: nonExistentPath,
                scaffoldDir: testOutputDir,
                includeMetadata: false
            }) as GenerateResult;

            expect(result.success).toBe(false);
            expect(result.error).toContain('SRS文件不存在');
        });

        test('应该处理包含重复ID的SRS文档', async () => {
            const duplicateIdContent = `
# SRS with Duplicate IDs

FR-AUTH-001: 第一次出现
UC-USER-001: 用例
FR-AUTH-001: 重复的功能需求
US-LOGIN-001: 用户故事
FR-AUTH-001: 再次重复
UC-USER-001: 重复的用例
`;

            await fs.writeFile(testSRSPath, duplicateIdContent, 'utf-8');

            const result = await requirementScaffoldToolImplementations.generateRequirementScaffold({
                srsFilePath: testSRSPath,
                scaffoldDir: testOutputDir,
                includeMetadata: true
            }) as GenerateResult;

            expect(result.success).toBe(true);
            expect(result.result!.generatedIds).toBe(3); // 去重后只有3个唯一ID

            // 验证生成的文件
            const scaffoldContent = await fs.readFile(result.result!.outputPath, 'utf-8');
            const scaffoldData = yaml.load(scaffoldContent) as any;

            expect(scaffoldData.functional_requirements).toHaveLength(1);
            expect(scaffoldData.use_cases).toHaveLength(1);
            expect(scaffoldData.user_stories).toHaveLength(1);

            expect(scaffoldData.functional_requirements[0].id).toBe('FR-AUTH-001');
            expect(scaffoldData.use_cases[0].id).toBe('UC-USER-001');
            expect(scaffoldData.user_stories[0].id).toBe('US-LOGIN-001');
        });

        test('应该处理复杂ID格式', async () => {
            const complexIdContent = `
# 复杂ID格式测试

FR-USER_MANAGEMENT-001: 用户管理功能
FR-DATA-SYNC-002: 数据同步功能
US-MOBILE_APP-001: 移动应用用户故事
NFR-LOAD_BALANCER-001: 负载均衡需求
ADC-ASSU-NETWORK_CONNECTIVITY-001: 网络连接假设
ADC-DEPEN-THIRD_PARTY-API-001: 第三方API依赖
`;

            await fs.writeFile(testSRSPath, complexIdContent, 'utf-8');

            const result = await requirementScaffoldToolImplementations.generateRequirementScaffold({
                srsFilePath: testSRSPath,
                scaffoldDir: testOutputDir,
                includeMetadata: true
            }) as GenerateResult;

            expect(result.success).toBe(true);
            expect(result.result!.generatedIds).toBe(6);

            const scaffoldContent = await fs.readFile(result.result!.outputPath, 'utf-8');
            const scaffoldData = yaml.load(scaffoldContent) as any;

            // 验证复杂格式ID被正确处理
            expect(scaffoldData.functional_requirements.find((item: any) => 
                item.id === 'FR-USER_MANAGEMENT-001')).toBeDefined();
            expect(scaffoldData.functional_requirements.find((item: any) => 
                item.id === 'FR-DATA-SYNC-002')).toBeDefined();
            expect(scaffoldData.assumptions.find((item: any) => 
                item.id === 'ADC-ASSU-NETWORK_CONNECTIVITY-001')).toBeDefined();
            expect(scaffoldData.dependencies.find((item: any) => 
                item.id === 'ADC-DEPEN-THIRD_PARTY-API-001')).toBeDefined();
        });
    });

    describe('工具帮助功能', () => {
        test('应该返回帮助信息', async () => {
            const result = await requirementScaffoldToolImplementations.getScaffoldHelp();

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
            expect(result.result!.length).toBeGreaterThan(0);

            const helpText = result.result!.join('\n');
            expect(helpText).toContain('需求脚手架生成器帮助');
            expect(helpText).toContain('US-xxx');
            expect(helpText).toContain('FR-xxx');
            expect(helpText).toContain('ADC-ASSU-xxx');
            expect(helpText).toContain('requirements_scaffold.yaml');
        });
    });
}); 