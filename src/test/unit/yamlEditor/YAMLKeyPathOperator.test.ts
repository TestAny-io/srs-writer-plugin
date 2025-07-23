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
}); 