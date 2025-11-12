/**
 * YAMLKeyPathOperator 单元测试
 * 测试键路径操作的核心逻辑
 */

import { YAMLKeyPathOperator } from '../../../tools/document/yamlEditor/YAMLKeyPathOperator';
import { ScaffoldError } from '../../../tools/document/yamlEditor/types';

describe('YAMLKeyPathOperator', () => {
    let testData: any;

    beforeEach(() => {
        // 创建测试数据
        testData = {
            level1: {
                level2: {
                    level3: 'deep_value',
                    array_field: ['item1', 'item2'],
                    object_field: {
                        nested: 'nested_value'
                    }
                },
                simple_field: 'simple_value'
            },
            root_array: [
                { id: 1, name: 'first' },
                { id: 2, name: 'second' }
            ],
            root_string: 'root_value'
        };
    });

    describe('parsePath', () => {
        it('should parse simple path correctly', () => {
            const result = YAMLKeyPathOperator.parsePath('key1.key2.key3');
            expect(result).toEqual(['key1', 'key2', 'key3']);
        });

        it('should handle single key', () => {
            const result = YAMLKeyPathOperator.parsePath('singlekey');
            expect(result).toEqual(['singlekey']);
        });

        it('should trim whitespace', () => {
            const result = YAMLKeyPathOperator.parsePath(' key1 . key2 . key3 ');
            expect(result).toEqual(['key1', 'key2', 'key3']);
        });

        it('should throw error for empty path', () => {
            expect(() => YAMLKeyPathOperator.parsePath('')).toThrow(ScaffoldError);
            expect(() => YAMLKeyPathOperator.parsePath('   ')).toThrow(ScaffoldError);
        });
    });

    describe('getValue', () => {
        it('should get deep nested value', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'level1.level2.level3');
            expect(value).toBe('deep_value');
        });

        it('should get root value', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'root_string');
            expect(value).toBe('root_value');
        });

        it('should get array value', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'level1.level2.array_field');
            expect(value).toEqual(['item1', 'item2']);
        });

        it('should get array item by index', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'root_array.0.name');
            expect(value).toBe('first');
        });

        it('should return undefined for non-existent path', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'non.existent.path');
            expect(value).toBeUndefined();
        });

        it('should handle invalid path gracefully', () => {
            const value = YAMLKeyPathOperator.getValue(testData, 'level1.level2.level3.invalid');
            expect(value).toBeUndefined();
        });
    });

    describe('exists', () => {
        it('should return true for existing path', () => {
            expect(YAMLKeyPathOperator.exists(testData, 'level1.level2.level3')).toBe(true);
            expect(YAMLKeyPathOperator.exists(testData, 'root_string')).toBe(true);
            expect(YAMLKeyPathOperator.exists(testData, 'root_array.0.id')).toBe(true);
        });

        it('should return false for non-existent path', () => {
            expect(YAMLKeyPathOperator.exists(testData, 'non.existent.path')).toBe(false);
            expect(YAMLKeyPathOperator.exists(testData, 'level1.invalid')).toBe(false);
            expect(YAMLKeyPathOperator.exists(testData, 'root_array.5.name')).toBe(false);
        });

        it('should handle invalid paths gracefully', () => {
            expect(YAMLKeyPathOperator.exists(testData, '')).toBe(false);
            expect(YAMLKeyPathOperator.exists(testData, '..invalid..')).toBe(false);
        });
    });

    describe('set', () => {
        it('should set existing value', () => {
            YAMLKeyPathOperator.set(testData, 'level1.level2.level3', 'new_value');
            expect(testData.level1.level2.level3).toBe('new_value');
        });

        it('should create new path automatically', () => {
            YAMLKeyPathOperator.set(testData, 'new.nested.path', 'created_value');
            expect(testData.new.nested.path).toBe('created_value');
        });

        it('should handle complex values', () => {
            const complexValue = {
                nested: 'object',
                array: [1, 2, 3],
                boolean: true
            };
            
            YAMLKeyPathOperator.set(testData, 'complex.field', complexValue);
            expect(testData.complex.field).toEqual(complexValue);
        });

        it('should overwrite existing object with new value', () => {
            YAMLKeyPathOperator.set(testData, 'level1.level2', 'replaced_object');
            expect(testData.level1.level2).toBe('replaced_object');
        });

        it('should handle array index setting', () => {
            YAMLKeyPathOperator.set(testData, 'root_array.0.name', 'updated_first');
            expect(testData.root_array[0].name).toBe('updated_first');
        });

        it('should throw error for invalid path on non-object', () => {
            expect(() => {
                YAMLKeyPathOperator.set(testData, 'root_string.invalid.path', 'value');
            }).toThrow(ScaffoldError);
        });

        it('should throw error for empty path', () => {
            expect(() => {
                YAMLKeyPathOperator.set(testData, '', 'value');
            }).toThrow(ScaffoldError);
        });
    });

    describe('delete', () => {
        it('should delete existing key', () => {
            const result = YAMLKeyPathOperator.delete(testData, 'level1.level2.level3');
            expect(result).toBe(true);
            expect(testData.level1.level2.level3).toBeUndefined();
            expect('level3' in testData.level1.level2).toBe(false);
        });

        it('should delete root key', () => {
            const result = YAMLKeyPathOperator.delete(testData, 'root_string');
            expect(result).toBe(true);
            expect(testData.root_string).toBeUndefined();
        });

        it('should handle non-existent key gracefully (idempotent)', () => {
            const result = YAMLKeyPathOperator.delete(testData, 'non.existent.key');
            expect(result).toBe(true); // 幂等操作应该返回成功
        });

        it('should handle partial non-existent path', () => {
            const result = YAMLKeyPathOperator.delete(testData, 'level1.non_existent.key');
            expect(result).toBe(true); // 路径不存在时也应该返回成功
        });

        it('should not affect other keys when deleting', () => {
            const originalOtherValue = testData.level1.level2.array_field;
            YAMLKeyPathOperator.delete(testData, 'level1.level2.level3');
            
            expect(testData.level1.level2.array_field).toEqual(originalOtherValue);
            expect(testData.level1.simple_field).toBe('simple_value');
        });
    });

    describe('extractAllKeyPaths', () => {
        it('should extract all key paths', () => {
            const paths = YAMLKeyPathOperator.extractAllKeyPaths(testData);
            
            expect(paths).toContain('level1');
            expect(paths).toContain('level1.level2');
            expect(paths).toContain('level1.level2.level3');
            expect(paths).toContain('level1.level2.array_field');
            expect(paths).toContain('level1.level2.object_field');
            expect(paths).toContain('level1.level2.object_field.nested');
            expect(paths).toContain('level1.simple_field');
            expect(paths).toContain('root_array');
            expect(paths).toContain('root_string');
        });

        it('should respect max depth', () => {
            const paths = YAMLKeyPathOperator.extractAllKeyPaths(testData, '', 2);
            
            expect(paths).toContain('level1');
            expect(paths).toContain('level1.level2');
            expect(paths).not.toContain('level1.level2.level3'); // 超过深度限制
        });

        it('should handle empty object', () => {
            const paths = YAMLKeyPathOperator.extractAllKeyPaths({});
            expect(paths).toEqual([]);
        });

        it('should handle primitive values', () => {
            const paths = YAMLKeyPathOperator.extractAllKeyPaths('string_value');
            expect(paths).toEqual([]);
        });
    });

    describe('inferValueType', () => {
        it('should infer correct types', () => {
            expect(YAMLKeyPathOperator.inferValueType('string')).toBe('string');
            expect(YAMLKeyPathOperator.inferValueType(123)).toBe('number');
            expect(YAMLKeyPathOperator.inferValueType(true)).toBe('boolean');
            expect(YAMLKeyPathOperator.inferValueType([1, 2, 3])).toBe('array');
            expect(YAMLKeyPathOperator.inferValueType({ key: 'value' })).toBe('object');
            expect(YAMLKeyPathOperator.inferValueType(null)).toBe('string'); // 默认
            expect(YAMLKeyPathOperator.inferValueType(undefined)).toBe('string'); // 默认
        });
    });

    describe('validateKeyPath', () => {
        it('should validate correct paths', () => {
            expect(YAMLKeyPathOperator.validateKeyPath('valid.path')).toEqual({ valid: true });
            expect(YAMLKeyPathOperator.validateKeyPath('single')).toEqual({ valid: true });
            expect(YAMLKeyPathOperator.validateKeyPath('very.deep.nested.path')).toEqual({ valid: true });
        });

        it('should reject invalid paths', () => {
            expect(YAMLKeyPathOperator.validateKeyPath('')).toEqual({
                valid: false,
                error: '键路径不能为空'
            });

            expect(YAMLKeyPathOperator.validateKeyPath('  ')).toEqual({
                valid: false,
                error: '键路径不能为空'
            });

            expect(YAMLKeyPathOperator.validateKeyPath('.invalid')).toEqual({
                valid: false,
                error: expect.stringContaining('格式无效')
            });

            expect(YAMLKeyPathOperator.validateKeyPath('invalid.')).toEqual({
                valid: false,
                error: expect.stringContaining('格式无效')
            });

            expect(YAMLKeyPathOperator.validateKeyPath('invalid..path')).toEqual({
                valid: false,
                error: expect.stringContaining('格式无效')
            });
        });
    });

    describe('Dictionary Structure Support', () => {
        let dictData: any;

        beforeEach(() => {
            // 创建Dictionary测试数据 (entity ID作为键的对象结构)
            dictData = {
                functional_requirements: {
                    'FR-AUTH-001': {
                        id: 'FR-AUTH-001',
                        summary: 'User authentication requirement',
                        description: ['System shall authenticate users via username/password'],
                        priority: 'high',
                        acceptance_criteria: [
                            'Valid credentials grant access',
                            'Invalid credentials show error'
                        ],
                        metadata: {
                            status: 'draft',
                            version: '1.0'
                        }
                    },
                    'FR-AUTH-002': {
                        id: 'FR-AUTH-002',
                        summary: 'Password strength validation',
                        priority: 'medium',
                        metadata: {
                            status: 'draft',
                            version: '1.0'
                        }
                    }
                },
                non_functional_requirements: {
                    'NFR-PERF-001': {
                        id: 'NFR-PERF-001',
                        summary: 'Response time requirements',
                        priority: 'high'
                    }
                }
            };
        });

        describe('getValue() - Dictionary', () => {
            it('should get value from Dictionary by entity ID', () => {
                // Act: 通过entity ID访问Dictionary中的字段
                const value = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001.summary'
                );

                // Assert
                expect(value).toBe('User authentication requirement');
            });

            it('should get entire Dictionary entry', () => {
                // Act: 获取整个Dictionary条目
                const entry = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001'
                );

                // Assert: 验证返回完整的对象
                expect(entry).toEqual({
                    id: 'FR-AUTH-001',
                    summary: 'User authentication requirement',
                    description: ['System shall authenticate users via username/password'],
                    priority: 'high',
                    acceptance_criteria: [
                        'Valid credentials grant access',
                        'Invalid credentials show error'
                    ],
                    metadata: {
                        status: 'draft',
                        version: '1.0'
                    }
                });
            });

            it('should get nested object in Dictionary entry', () => {
                // Act: 访问Dictionary条目中的嵌套对象
                const metadata = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001.metadata'
                );

                // Assert
                expect(metadata).toEqual({
                    status: 'draft',
                    version: '1.0'
                });

                // Act: 访问嵌套对象中的字段
                const status = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001.metadata.status'
                );

                // Assert
                expect(status).toBe('draft');
            });

            it('should return undefined for non-existent entity ID', () => {
                // Act: 访问不存在的entity ID
                const value = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-NONEXISTENT.summary'
                );

                // Assert
                expect(value).toBeUndefined();
            });

            it('should return undefined for partially existing path', () => {
                // Act: 路径部分存在，但完整路径不存在
                const value = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001.nonexistent_field'
                );

                // Assert
                expect(value).toBeUndefined();
            });
        });

        describe('set() - Dictionary', () => {
            it('should set value in existing Dictionary entry', () => {
                // Act: 更新已存在的Dictionary条目中的字段
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-001.summary',
                    'Updated authentication requirement'
                );

                // Assert: 验证值已更新
                expect(dictData.functional_requirements['FR-AUTH-001'].summary)
                    .toBe('Updated authentication requirement');

                // Assert: 验证其他字段未受影响
                expect(dictData.functional_requirements['FR-AUTH-001'].priority)
                    .toBe('high');
            });

            it('should create new Dictionary entry from scratch', () => {
                // Act: 创建新的Dictionary条目
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-NEW-001.summary',
                    'New requirement'
                );

                // Assert: 验证新条目已创建
                expect(dictData.functional_requirements['FR-NEW-001']).toEqual({
                    summary: 'New requirement'
                });
            });

            it('should auto-create intermediate Dictionary keys (nested path)', () => {
                // Act: 创建深层嵌套的Dictionary结构
                YAMLKeyPathOperator.set(
                    dictData,
                    'security_requirements.SEC-001.details.encryption.algorithm',
                    'AES-256'
                );

                // Assert: 验证中间路径已自动创建
                expect(dictData.security_requirements).toBeDefined();
                expect(dictData.security_requirements['SEC-001']).toBeDefined();
                expect(dictData.security_requirements['SEC-001'].details).toBeDefined();
                expect(dictData.security_requirements['SEC-001'].details.encryption).toBeDefined();
                expect(dictData.security_requirements['SEC-001'].details.encryption.algorithm)
                    .toBe('AES-256');
            });

            it('should overwrite primitive with object in Dictionary', () => {
                // Arrange: 设置初始primitive值
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-001.priority',
                    'high'
                );

                // Act: 用对象覆盖primitive值
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-001.priority',
                    { level: 'high', justification: 'Security critical' }
                );

                // Assert
                expect(dictData.functional_requirements['FR-AUTH-001'].priority).toEqual({
                    level: 'high',
                    justification: 'Security critical'
                });
            });

            it('should set null value in Dictionary', () => {
                // Act: 设置null值
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-001.deprecated',
                    null
                );

                // Assert
                expect(dictData.functional_requirements['FR-AUTH-001'].deprecated).toBeNull();
            });

            it('should set empty object as Dictionary value', () => {
                // Act: 设置空对象
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-001.custom_data',
                    {}
                );

                // Assert
                expect(dictData.functional_requirements['FR-AUTH-001'].custom_data).toEqual({});
            });
        });

        describe('delete() - Dictionary', () => {
            it('should delete entire Dictionary entry (verify key removed)', () => {
                // Arrange: 验证条目存在
                expect('FR-AUTH-001' in dictData.functional_requirements).toBe(true);

                // Act: 删除整个Dictionary条目
                const result = YAMLKeyPathOperator.delete(
                    dictData,
                    'functional_requirements.FR-AUTH-001'
                );

                // Assert: 验证删除成功
                expect(result).toBe(true);

                // Assert: 验证键已完全移除
                expect('FR-AUTH-001' in dictData.functional_requirements).toBe(false);
                expect(dictData.functional_requirements['FR-AUTH-001']).toBeUndefined();
            });

            it('should delete nested field in Dictionary entry (preserve rest of entry)', () => {
                // Arrange: 记录原始数据
                const originalId = dictData.functional_requirements['FR-AUTH-001'].id;
                const originalPriority = dictData.functional_requirements['FR-AUTH-001'].priority;

                // Act: 删除嵌套字段
                const result = YAMLKeyPathOperator.delete(
                    dictData,
                    'functional_requirements.FR-AUTH-001.summary'
                );

                // Assert: 验证删除成功
                expect(result).toBe(true);

                // Assert: 验证字段已删除
                expect('summary' in dictData.functional_requirements['FR-AUTH-001']).toBe(false);

                // Assert: 验证其他字段保持不变
                expect(dictData.functional_requirements['FR-AUTH-001'].id).toBe(originalId);
                expect(dictData.functional_requirements['FR-AUTH-001'].priority).toBe(originalPriority);
            });

            it('should handle non-existent entity ID gracefully (idempotent)', () => {
                // Act: 删除不存在的entity ID
                const result = YAMLKeyPathOperator.delete(
                    dictData,
                    'functional_requirements.FR-NONEXISTENT'
                );

                // Assert: 幂等操作应返回成功
                expect(result).toBe(true);

                // Assert: 验证现有数据未受影响
                expect(dictData.functional_requirements['FR-AUTH-001']).toBeDefined();
            });

            it('should verify other Dictionary entries not affected after deletion', () => {
                // Arrange: 记录其他条目的引用
                const auth002Entry = dictData.functional_requirements['FR-AUTH-002'];
                const nfrEntry = dictData.non_functional_requirements['NFR-PERF-001'];

                // Act: 删除一个Dictionary条目
                YAMLKeyPathOperator.delete(
                    dictData,
                    'functional_requirements.FR-AUTH-001'
                );

                // Assert: 验证其他条目完全未受影响
                expect(dictData.functional_requirements['FR-AUTH-002']).toBe(auth002Entry);
                expect(dictData.functional_requirements['FR-AUTH-002'].summary)
                    .toBe('Password strength validation');

                expect(dictData.non_functional_requirements['NFR-PERF-001']).toBe(nfrEntry);
                expect(dictData.non_functional_requirements['NFR-PERF-001'].summary)
                    .toBe('Response time requirements');
            });

            it('should delete from empty Dictionary', () => {
                // Arrange: 创建空Dictionary
                dictData.empty_section = {};

                // Act: 从空Dictionary删除
                const result = YAMLKeyPathOperator.delete(
                    dictData,
                    'empty_section.NON-EXISTENT'
                );

                // Assert: 幂等操作返回成功
                expect(result).toBe(true);
            });

            it('should verify no null/undefined keys remain after deletion', () => {
                // Act: 删除嵌套字段
                YAMLKeyPathOperator.delete(
                    dictData,
                    'functional_requirements.FR-AUTH-001.metadata.status'
                );

                // Assert: 验证键已完全删除，不留下null或undefined
                expect('status' in dictData.functional_requirements['FR-AUTH-001'].metadata)
                    .toBe(false);

                // Assert: 验证父对象仍存在且其他字段正常
                expect(dictData.functional_requirements['FR-AUTH-001'].metadata.version)
                    .toBe('1.0');
            });
        });

        describe('exists() - Dictionary', () => {
            it('should return true for existing Dictionary entry', () => {
                // Act & Assert: 检查完整的Dictionary条目
                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-AUTH-001'
                )).toBe(true);

                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'non_functional_requirements.NFR-PERF-001'
                )).toBe(true);
            });

            it('should return true for nested field in Dictionary', () => {
                // Act & Assert: 检查Dictionary条目中的嵌套字段
                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-AUTH-001.summary'
                )).toBe(true);

                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-AUTH-001.metadata.status'
                )).toBe(true);
            });

            it('should return false for non-existent entity ID', () => {
                // Act & Assert: 检查不存在的entity ID
                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-NONEXISTENT'
                )).toBe(false);

                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-INVALID-999.summary'
                )).toBe(false);
            });

            it('should return false for nested field in non-existent entry', () => {
                // Act & Assert: 检查不存在条目中的嵌套字段
                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-NONEXISTENT.summary'
                )).toBe(false);

                expect(YAMLKeyPathOperator.exists(
                    dictData,
                    'functional_requirements.FR-AUTH-001.nonexistent_field'
                )).toBe(false);
            });
        });

        describe('extractAllKeyPaths() - Dictionary', () => {
            it('should extract all paths including entity IDs', () => {
                // Act: 提取所有键路径
                const paths = YAMLKeyPathOperator.extractAllKeyPaths(dictData);

                // Assert: 验证包含顶层键
                expect(paths).toContain('functional_requirements');
                expect(paths).toContain('non_functional_requirements');

                // Assert: 验证包含entity ID作为路径
                expect(paths).toContain('functional_requirements.FR-AUTH-001');
                expect(paths).toContain('functional_requirements.FR-AUTH-002');
                expect(paths).toContain('non_functional_requirements.NFR-PERF-001');

                // Assert: 验证包含entity内部字段
                expect(paths).toContain('functional_requirements.FR-AUTH-001.id');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.summary');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.priority');
            });

            it('should verify entity IDs appear in path list', () => {
                // Act
                const paths = YAMLKeyPathOperator.extractAllKeyPaths(dictData);

                // Assert: 验证entity ID本身作为路径存在
                // 这对于Dictionary结构很重要 - entity ID既是键也应该是可访问的路径
                expect(paths).toContain('functional_requirements.FR-AUTH-001');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.summary');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.description');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.acceptance_criteria');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.metadata');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.metadata.status');
                expect(paths).toContain('functional_requirements.FR-AUTH-001.metadata.version');
            });

            it('should respect maxDepth with Dictionary structure', () => {
                // Act: 限制深度为2
                const paths = YAMLKeyPathOperator.extractAllKeyPaths(dictData, '', 2);

                // Assert: 深度1 - 应该包含
                expect(paths).toContain('functional_requirements');

                // Assert: 深度2 - 应该包含
                expect(paths).toContain('functional_requirements.FR-AUTH-001');

                // Assert: 深度3 - 不应该包含 (超过maxDepth)
                expect(paths).not.toContain('functional_requirements.FR-AUTH-001.summary');
                expect(paths).not.toContain('functional_requirements.FR-AUTH-001.metadata');
            });
        });

        describe('Special Cases - Dictionary', () => {
            it('should handle entity IDs with hyphens', () => {
                // Act: 访问包含多个连字符的entity ID
                const value1 = YAMLKeyPathOperator.getValue(
                    dictData,
                    'functional_requirements.FR-AUTH-001.summary'
                );

                const value2 = YAMLKeyPathOperator.getValue(
                    dictData,
                    'non_functional_requirements.NFR-PERF-001.summary'
                );

                // Assert: 连字符不应被误解析为路径分隔符
                expect(value1).toBe('User authentication requirement');
                expect(value2).toBe('Response time requirements');

                // Act: 设置和读取带连字符的新entity ID
                YAMLKeyPathOperator.set(
                    dictData,
                    'functional_requirements.FR-AUTH-LOGIN-001.summary',
                    'Multi-hyphen entity ID'
                );

                // Assert
                expect(dictData.functional_requirements['FR-AUTH-LOGIN-001'].summary)
                    .toBe('Multi-hyphen entity ID');
            });

            it('should handle keys with spaces', () => {
                // Arrange: 创建包含空格的键
                dictData['Functional Requirements'] = {
                    'FR-001': {
                        summary: 'Space in parent key'
                    }
                };

                // Act: 访问包含空格的键路径
                const value = YAMLKeyPathOperator.getValue(
                    dictData,
                    'Functional Requirements.FR-001.summary'
                );

                // Assert: 空格应正确处理
                expect(value).toBe('Space in parent key');

                // Act: 设置值
                YAMLKeyPathOperator.set(
                    dictData,
                    'Functional Requirements.FR-001.priority',
                    'high'
                );

                // Assert
                expect(dictData['Functional Requirements']['FR-001'].priority).toBe('high');
            });

            it('should differentiate string key "0" from array index 0', () => {
                // Arrange: 创建同时包含数组和字符串键"0"的结构
                dictData.mixed_structure = {
                    array_field: ['zero-index-value', 'one-index-value'],
                    '0': 'string-key-zero-value'
                };

                // Act: 访问数组索引0
                const arrayValue = YAMLKeyPathOperator.getValue(
                    dictData,
                    'mixed_structure.array_field.0'
                );

                // Assert: 应该返回数组第一个元素
                expect(arrayValue).toBe('zero-index-value');

                // Act: 访问字符串键"0"
                const stringKeyValue = YAMLKeyPathOperator.getValue(
                    dictData,
                    'mixed_structure.0'
                );

                // Assert: 应该返回对象键"0"的值
                expect(stringKeyValue).toBe('string-key-zero-value');
            });
        });
    });
}); 