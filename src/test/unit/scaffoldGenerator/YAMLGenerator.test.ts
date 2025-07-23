import { YAMLGenerator } from '../../../tools/document/scaffoldGenerator/YAMLGenerator';
import { ExtractedId, SchemaConfig } from '../../../tools/document/scaffoldGenerator/types';
import * as yaml from 'js-yaml';

describe('YAMLGenerator', () => {
    // 模拟Schema配置
    const mockSchema: SchemaConfig = {
        version: "1.0",
        last_updated: "2024-01-15",
        compatible_versions: ["1.0"],
        description: "Test schema",
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
        enums: {}
    };

    describe('generateScaffold', () => {
        test('应该生成基础实体的脚手架', async () => {
            const extractedIds: ExtractedId[] = [
                { id: 'US-LOGIN-001', type: 'basic', prefix: 'US', fullMatch: 'US-LOGIN-001' },
                { id: 'UC-AUTH-001', type: 'basic', prefix: 'UC', fullMatch: 'UC-AUTH-001' },
                { id: 'FR-SECURITY-001', type: 'basic', prefix: 'FR', fullMatch: 'FR-SECURITY-001' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: true
            });

            // 验证生成的结构
            expect(result.user_stories).toBeDefined();
            expect(result.use_cases).toBeDefined();
            expect(result.functional_requirements).toBeDefined();
            expect(result._metadata).toBeDefined();

            // 验证ID正确设置
            expect(result.user_stories[0].id).toBe('US-LOGIN-001');
            expect(result.use_cases[0].id).toBe('UC-AUTH-001');
            expect(result.functional_requirements[0].id).toBe('FR-SECURITY-001');

            // 验证时间戳已设置
            expect(result.user_stories[0].metadata.created_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(result.user_stories[0].metadata.last_modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        test('应该正确处理ADC实体', async () => {
            const extractedIds: ExtractedId[] = [
                { id: 'ADC-ASSU-001', type: 'adc', prefix: 'ADC', subType: 'ASSU', fullMatch: 'ADC-ASSU-001' },
                { id: 'ADC-DEPEN-001', type: 'adc', prefix: 'ADC', subType: 'DEPEN', fullMatch: 'ADC-DEPEN-001' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: false
            });

            // 验证ADC实体生成
            expect(result.assumptions).toBeDefined();
            expect(result.dependencies).toBeDefined();
            expect(result._metadata).toBeUndefined();

            // 验证ADC实体ID
            expect(result.assumptions[0].id).toBe('ADC-ASSU-001');
            expect(result.dependencies[0].id).toBe('ADC-DEPEN-001');

            // 验证ADC实体特有字段
            expect(result.assumptions[0].assumptions).toEqual([]);
            expect(result.assumptions[0].risk_if_false).toEqual([]);
            expect(result.dependencies[0].dependencies).toEqual([]);
            expect(result.dependencies[0].risk_level).toBeNull();
        });

        test('应该按固定顺序输出实体类型', async () => {
            // 故意按非顺序提供ID
            const extractedIds: ExtractedId[] = [
                { id: 'NFR-PERF-001', type: 'basic', prefix: 'NFR', fullMatch: 'NFR-PERF-001' },
                { id: 'US-LOGIN-001', type: 'basic', prefix: 'US', fullMatch: 'US-LOGIN-001' },
                { id: 'ADC-ASSU-001', type: 'adc', prefix: 'ADC', subType: 'ASSU', fullMatch: 'ADC-ASSU-001' },
                { id: 'FR-AUTH-001', type: 'basic', prefix: 'FR', fullMatch: 'FR-AUTH-001' },
                { id: 'UC-USER-001', type: 'basic', prefix: 'UC', fullMatch: 'UC-USER-001' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: false
            });

            // 验证实体类型按固定顺序出现
            const keys = Object.keys(result);
            const expectedOrder = ['user_stories', 'use_cases', 'functional_requirements', 'non_functional_requirements', 'assumptions'];
            
            let lastIndex = -1;
            for (const key of keys) {
                const currentIndex = expectedOrder.indexOf(key);
                if (currentIndex !== -1) {
                    expect(currentIndex).toBeGreaterThan(lastIndex);
                    lastIndex = currentIndex;
                }
            }
        });

        test('应该在同一实体类型内按ID排序', async () => {
            const extractedIds: ExtractedId[] = [
                { id: 'FR-LOGIN-003', type: 'basic', prefix: 'FR', fullMatch: 'FR-LOGIN-003' },
                { id: 'FR-AUTH-001', type: 'basic', prefix: 'FR', fullMatch: 'FR-AUTH-001' },
                { id: 'FR-SECURITY-002', type: 'basic', prefix: 'FR', fullMatch: 'FR-SECURITY-002' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: false
            });

            // 验证FR实体内部排序
            const frIds = result.functional_requirements.map((item: any) => item.id);
            expect(frIds).toEqual(['FR-AUTH-001', 'FR-LOGIN-003', 'FR-SECURITY-002']);
        });

        test('应该正确生成元数据', async () => {
            const extractedIds: ExtractedId[] = [
                { id: 'US-TEST-001', type: 'basic', prefix: 'US', fullMatch: 'US-TEST-001' },
                { id: 'FR-TEST-001', type: 'basic', prefix: 'FR', fullMatch: 'FR-TEST-001' },
                { id: 'ADC-ASSU-001', type: 'adc', prefix: 'ADC', subType: 'ASSU', fullMatch: 'ADC-ASSU-001' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: true
            });

            const metadata = result._metadata;
            expect(metadata).toBeDefined();
            expect(metadata.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            expect(metadata.generator_version).toBe("1.0.0");
            expect(metadata.schema_version).toBe("1.0");
            expect(metadata.total_ids).toBe(3);
            expect(metadata.generation_mode).toBe('full_replacement');
            
            // 验证ID breakdown
            expect(metadata.id_breakdown.US).toBe(1);
            expect(metadata.id_breakdown.FR).toBe(1);
            expect(metadata.id_breakdown['ADC-ASSU']).toBe(1);
        });

        test('应该跳过未知类型的ID', async () => {
            const extractedIds: ExtractedId[] = [
                { id: 'US-VALID-001', type: 'basic', prefix: 'US', fullMatch: 'US-VALID-001' },
                { id: 'UNKNOWN-001', type: 'basic', prefix: 'UNKNOWN', fullMatch: 'UNKNOWN-001' },
                { id: 'ADC-INVALID-001', type: 'adc', prefix: 'ADC', subType: 'INVALID', fullMatch: 'ADC-INVALID-001' }
            ];

            const result = await YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: false
            });

            // 只应该生成已知类型的实体
            expect(result.user_stories).toBeDefined();
            expect(result.user_stories).toHaveLength(1);
            expect(result.user_stories[0].id).toBe('US-VALID-001');

            // 不应该有未知类型的实体
            expect(Object.keys(result)).not.toContain('unknown');
            expect(Object.keys(result)).not.toContain('invalid');
        });

        test('应该抛出错误当没有有效ID时', async () => {
            const extractedIds: ExtractedId[] = [];

            await expect(YAMLGenerator.generateScaffold({
                extractedIds,
                schemas: mockSchema,
                includeMetadata: false
            })).rejects.toMatchObject({
                message: expect.stringContaining('生成的脚手架为空')
            });
        });
    });

    describe('writeScaffoldToFile', () => {
        test('应该生成有效的YAML字符串', async () => {
            const scaffold = {
                user_stories: [
                    {
                        id: 'US-TEST-001',
                        summary: '',
                        description: [],
                        metadata: { status: 'draft' }
                    }
                ],
                _metadata: {
                    generated_at: '2024-01-15T10:00:00.000Z',
                    total_ids: 1
                }
            };

            // Mock fs.mkdir and fs.writeFile
            const fs = require('fs/promises');
            jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
            jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

            const result = await YAMLGenerator.writeScaffoldToFile('/test/dir', scaffold);

            expect(result).toBe('/test/dir/requirements_scaffold.yaml');
            expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalled();

            // 验证写入的内容是有效的YAML
            const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
            const yamlContent = writeCall[1];
            
            expect(yamlContent).toContain('# Requirements Scaffold File');
            expect(yamlContent).toContain('user_stories:');
            expect(yamlContent).toContain('US-TEST-001');
            
            // 验证可以解析为有效YAML
            expect(() => yaml.load(yamlContent)).not.toThrow();
        });
    });

    describe('getEntityOrder', () => {
        test('应该返回正确的实体顺序', () => {
            const order = YAMLGenerator.getEntityOrder();
            
            expect(order).toEqual([
                'user_stories',
                'use_cases',
                'functional_requirements',
                'non_functional_requirements',
                'interface_requirements',
                'data_requirements',
                'assumptions',
                'dependencies',
                'constraints'
            ]);
        });
    });

    describe('getOutputFilename', () => {
        test('应该返回正确的输出文件名', () => {
            expect(YAMLGenerator.getOutputFilename()).toBe('requirements_scaffold.yaml');
        });
    });
}); 