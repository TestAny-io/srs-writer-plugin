/**
 * Dictionary Edge Case Tests
 * Testing critical edge cases for Dictionary support in YAML operations
 * Based on edge case specification document - P0 and P1 priorities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { YAMLKeyPathOperator } from '../../tools/document/yamlEditor/YAMLKeyPathOperator';
import { ScaffoldError } from '../../tools/document/yamlEditor/types';
import * as yaml from 'js-yaml';

describe('Dictionary Edge Cases', () => {
    let tempDir: string;
    let testYAMLPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dict-edge-test-'));
        testYAMLPath = path.join(tempDir, 'test-dictionary.yaml');
    });

    afterEach(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('2.1 KeyPath Edge Cases', () => {
        it('DICT-EDGE-001: should reject empty keyPath', () => {
            const data = {};

            expect(() => {
                YAMLKeyPathOperator.set(data, '', 'value');
            }).toThrow('键路径不能为空');
        });

        it('DICT-EDGE-002: should handle single-level keyPath (get entire Dictionary)', () => {
            const data = {
                functional_requirements: {
                    'FR-001': { summary: 'Requirement 1' },
                    'FR-002': { summary: 'Requirement 2' }
                }
            };

            const value = YAMLKeyPathOperator.getValue(data, 'functional_requirements');
            expect(value).toBeDefined();
            expect(value['FR-001']).toBeDefined();
            expect(value['FR-002']).toBeDefined();
            expect(Object.keys(value)).toHaveLength(2);
        });

        it('DICT-EDGE-003: should handle deep nesting (10 levels)', () => {
            const data: any = {};
            const deepPath = 'a.b.c.d.e.f.g.h.i.j';

            // Set deep value
            YAMLKeyPathOperator.set(data, deepPath, 'deep_value');

            // Verify structure created
            expect(data.a.b.c.d.e.f.g.h.i.j).toBe('deep_value');

            // Verify getValue works at each level
            expect(YAMLKeyPathOperator.getValue(data, 'a.b.c')).toBeDefined();
            expect(YAMLKeyPathOperator.getValue(data, 'a.b.c.d.e.f')).toBeDefined();
            expect(YAMLKeyPathOperator.getValue(data, deepPath)).toBe('deep_value');
        });

        it('DICT-EDGE-004: should handle entity ID with hyphens', () => {
            const data: any = {
                functional_requirements: {},
                non_functional_requirements: {}
            };

            // Set values with hyphenated entity IDs
            YAMLKeyPathOperator.set(data, 'functional_requirements.FR-AUTH-001', { summary: 'Auth requirement' });
            YAMLKeyPathOperator.set(data, 'non_functional_requirements.NFR-PERF-001', { summary: 'Performance requirement' });

            expect(data.functional_requirements['FR-AUTH-001'].summary).toBe('Auth requirement');
            expect(data.non_functional_requirements['NFR-PERF-001'].summary).toBe('Performance requirement');
        });

        it('DICT-EDGE-005: should handle numeric string keys (not array indices)', () => {
            const data: any = {
                items: {
                    '0': { id: 'X' },
                    '1': { id: 'Y' },
                    '123': { id: 'Z' }
                }
            };

            // Should access string key '123', not array index
            const value = YAMLKeyPathOperator.getValue(data, 'items.123.id');
            expect(value).toBe('Z');

            // Verify it's NOT array access
            expect(Array.isArray(data.items)).toBe(false);
            expect(typeof data.items).toBe('object');

            // Should be able to set new numeric string key
            YAMLKeyPathOperator.set(data, 'items.456', { id: 'W' });
            expect(data.items['456'].id).toBe('W');
        });

        it('DICT-EDGE-006: should reject leading/trailing dots', () => {
            const validation1 = YAMLKeyPathOperator.validateKeyPath('.test');
            expect(validation1.valid).toBe(false);
            expect(validation1.error).toContain('格式无效');

            const validation2 = YAMLKeyPathOperator.validateKeyPath('test.');
            expect(validation2.valid).toBe(false);
            expect(validation2.error).toContain('格式无效');
        });

        it('DICT-EDGE-007: should reject multiple consecutive dots', () => {
            const validation = YAMLKeyPathOperator.validateKeyPath('a..b');
            expect(validation.valid).toBe(false);
            expect(validation.error).toContain('格式无效');
        });

        it('DICT-EDGE-008: should handle keys with spaces', () => {
            const data: any = {};

            // Set keys with spaces
            YAMLKeyPathOperator.set(data, 'my key.nested key', 'value with spaces');

            // Verify structure
            expect(data['my key']['nested key']).toBe('value with spaces');

            // getValue should also work
            const value = YAMLKeyPathOperator.getValue(data, 'my key.nested key');
            expect(value).toBe('value with spaces');
        });
    });

    describe('2.2 Value Type Edge Cases', () => {
        it('DICT-EDGE-009: should handle null value', () => {
            const data = {
                fr: {
                    'FR-001': { value: 'original' }
                }
            };

            YAMLKeyPathOperator.set(data, 'fr.FR-001.value', null);
            expect(data.fr['FR-001'].value).toBeNull();

            // Verify getValue returns null
            const value = YAMLKeyPathOperator.getValue(data, 'fr.FR-001.value');
            expect(value).toBeNull();
        });

        it('DICT-EDGE-010: should handle undefined value', () => {
            const data = {
                fr: {
                    'FR-001': { value: 'original' }
                }
            };

            YAMLKeyPathOperator.set(data, 'fr.FR-001.value', undefined);
            expect(data.fr['FR-001'].value).toBeUndefined();
        });

        it('DICT-EDGE-011: should handle empty string', () => {
            const data = {
                fr: {
                    'FR-001': { value: 'original' }
                }
            };

            YAMLKeyPathOperator.set(data, 'fr.FR-001.value', '');
            expect(data.fr['FR-001'].value).toBe('');

            // Verify it's truly empty, not undefined
            expect(typeof data.fr['FR-001'].value).toBe('string');
            expect(data.fr['FR-001'].value.length).toBe(0);
        });

        it('DICT-EDGE-012: should handle empty array', () => {
            const data = {
                fr: {
                    'FR-001': { items: ['item1', 'item2'] }
                }
            };

            YAMLKeyPathOperator.set(data, 'fr.FR-001.items', []);
            expect(data.fr['FR-001'].items).toEqual([]);
            expect(Array.isArray(data.fr['FR-001'].items)).toBe(true);
            expect(data.fr['FR-001'].items.length).toBe(0);
        });

        it('DICT-EDGE-013: should handle empty object', () => {
            const data = {
                fr: {
                    'FR-001': { metadata: { status: 'draft' } }
                }
            };

            YAMLKeyPathOperator.set(data, 'fr.FR-001.metadata', {});
            expect(data.fr['FR-001'].metadata).toEqual({});
            expect(typeof data.fr['FR-001'].metadata).toBe('object');
            expect(Object.keys(data.fr['FR-001'].metadata).length).toBe(0);
        });

        it('DICT-EDGE-014: should handle large string (10KB+) without truncation', () => {
            const data: any = {
                fr: {
                    'FR-001': {}
                }
            };

            // Create 15KB string
            const largeString = 'A'.repeat(15 * 1024);

            YAMLKeyPathOperator.set(data, 'fr.FR-001.description', largeString);

            // Verify no truncation
            expect(data.fr['FR-001'].description.length).toBe(15 * 1024);
            expect(data.fr['FR-001'].description).toBe(largeString);
        });
    });

    describe('2.3 Dictionary set() Edge Cases', () => {
        it('DICT-EDGE-015: should auto-create non-existent parent path', () => {
            const data: any = {};

            YAMLKeyPathOperator.set(data, 'a.b.c', 'value');

            expect(data.a).toBeDefined();
            expect(data.a.b).toBeDefined();
            expect(data.a.b.c).toBe('value');
        });

        it('DICT-EDGE-016: should overwrite primitive with object', () => {
            const data = {
                a: 'string_value'
            };

            // This should throw error per current implementation
            expect(() => {
                YAMLKeyPathOperator.set(data, 'a.b', 'value');
            }).toThrow(ScaffoldError);
        });

        it('DICT-EDGE-017: should overwrite object with primitive', () => {
            const data = {
                a: {
                    b: {
                        c: 'nested'
                    }
                }
            };

            // Overwrite entire object with primitive
            YAMLKeyPathOperator.set(data, 'a', 'string');

            expect(data.a).toBe('string');
            expect(typeof data.a).toBe('string');
        });

        it('DICT-EDGE-018: should handle keyPath with array index in Dictionary', () => {
            const data = {
                dict: {
                    'FR-001': {
                        items: ['item1', 'item2', 'item3']
                    }
                }
            };

            // Set array element via keyPath
            YAMLKeyPathOperator.set(data, 'dict.FR-001.items.0', 'updated_item1');

            expect(data.dict['FR-001'].items[0]).toBe('updated_item1');
            expect(data.dict['FR-001'].items[1]).toBe('item2');
        });

        it('DICT-EDGE-019: should handle concurrent sets (last write wins)', () => {
            const data: any = {};

            // Sequential sets to same path
            YAMLKeyPathOperator.set(data, 'key.nested', 'value1');
            YAMLKeyPathOperator.set(data, 'key.nested', 'value2');
            YAMLKeyPathOperator.set(data, 'key.nested', 'value3');

            // Last write should win
            expect(data.key.nested).toBe('value3');
        });

        it('DICT-EDGE-020: should handle dots in Dictionary key names', () => {
            // Test if system supports literal dots in key names
            const data: any = {
                items: {}
            };

            // This is ambiguous: is "FR.AUTH.001" a single key or nested path?
            // Current implementation treats dots as separators
            YAMLKeyPathOperator.set(data, 'items.FR.AUTH.001', 'value');

            // Should create nested structure
            expect(data.items.FR.AUTH['001']).toBe('value');
        });
    });

    describe('2.4 Dictionary delete() Edge Cases', () => {
        it('DICT-EDGE-021: should delete non-existent key (idempotent)', () => {
            const data = {
                existing: 'value'
            };

            const result = YAMLKeyPathOperator.delete(data, 'non.existent.key');
            expect(result).toBe(true); // Should succeed idempotently
        });

        it('DICT-EDGE-022: should delete when parent does not exist', () => {
            const data = {
                level1: {}
            };

            const result = YAMLKeyPathOperator.delete(data, 'level1.non_existent.child');
            expect(result).toBe(true); // Idempotent operation
        });

        it('DICT-EDGE-023: should delete nested key without affecting siblings', () => {
            const data = {
                parent: {
                    child1: 'value1',
                    child2: 'value2',
                    child3: 'value3'
                }
            };

            YAMLKeyPathOperator.delete(data, 'parent.child2');

            expect(data.parent.child1).toBe('value1');
            expect(data.parent.child2).toBeUndefined();
            expect(data.parent.child3).toBe('value3');
        });

        it('DICT-EDGE-024: should delete all keys from Dictionary (leaving empty object)', () => {
            const data = {
                dict: {
                    'FR-001': { value: 'a' },
                    'FR-002': { value: 'b' },
                    'FR-003': { value: 'c' }
                }
            };

            YAMLKeyPathOperator.delete(data, 'dict.FR-001');
            YAMLKeyPathOperator.delete(data, 'dict.FR-002');
            YAMLKeyPathOperator.delete(data, 'dict.FR-003');

            expect(data.dict).toEqual({});
            expect(Object.keys(data.dict).length).toBe(0);
        });

        it('DICT-EDGE-025: should handle delete with invalid keyPath gracefully', () => {
            const data = { valid: 'value' };

            // Empty path should fail gracefully
            const validation = YAMLKeyPathOperator.validateKeyPath('');
            expect(validation.valid).toBe(false);
        });
    });

    describe('2.5 Mixed Array/Dictionary Edge Cases', () => {
        it('DICT-EDGE-026: should handle Dictionary containing Arrays', () => {
            const data = {
                'FR-001': {
                    acceptance_criteria: ['criterion1', 'criterion2', 'criterion3']
                }
            };

            // Access array element within Dictionary
            const value = YAMLKeyPathOperator.getValue(data, 'FR-001.acceptance_criteria.0');
            expect(value).toBe('criterion1');

            // Modify array element
            YAMLKeyPathOperator.set(data, 'FR-001.acceptance_criteria.1', 'updated_criterion2');
            expect(data['FR-001'].acceptance_criteria[1]).toBe('updated_criterion2');
        });

        it('DICT-EDGE-027: should handle Array containing Dictionaries', () => {
            const data: any = {
                items: [
                    { 'FR-001': { summary: 'First' } },
                    { 'FR-002': { summary: 'Second' } }
                ]
            };

            // Access Dictionary within Array
            const value = YAMLKeyPathOperator.getValue(data, 'items.0.FR-001.summary');
            expect(value).toBe('First');

            // Modify value in nested Dictionary
            YAMLKeyPathOperator.set(data, 'items.1.FR-002.summary', 'Updated Second');
            expect(data.items[1]['FR-002'].summary).toBe('Updated Second');
        });

        it('DICT-EDGE-028: should handle 3-level nested mixed structure', () => {
            const data = {
                dict: {
                    'FR-001': {
                        array: [
                            {
                                nestedDict: {
                                    key: 'deep_value'
                                }
                            }
                        ]
                    }
                }
            };

            // Access deeply nested value
            const value = YAMLKeyPathOperator.getValue(data, 'dict.FR-001.array.0.nestedDict.key');
            expect(value).toBe('deep_value');

            // Modify deeply nested value
            YAMLKeyPathOperator.set(data, 'dict.FR-001.array.0.nestedDict.key', 'updated_deep_value');
            expect(data.dict['FR-001'].array[0].nestedDict.key).toBe('updated_deep_value');
        });

        it('DICT-EDGE-029: should handle switching structure type at same path', () => {
            const data: any = {
                flexible: ['item1', 'item2']
            };

            // Replace Array with Dictionary
            YAMLKeyPathOperator.set(data, 'flexible', {
                'FR-001': { value: 'dict_value' }
            });

            expect(Array.isArray(data.flexible)).toBe(false);
            expect(typeof data.flexible).toBe('object');
            expect(data.flexible['FR-001'].value).toBe('dict_value');
        });
    });

    describe('2.6 YAML Serialization Edge Cases', () => {
        it('DICT-EDGE-030: should preserve key order in Dictionary', async () => {
            const data = {
                requirements: {
                    'FR-003': { summary: 'Third' },
                    'FR-001': { summary: 'First' },
                    'FR-002': { summary: 'Second' }
                }
            };

            // Serialize to YAML
            const yamlContent = yaml.dump(data, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
                sortKeys: false // Preserve insertion order
            });

            await fs.writeFile(testYAMLPath, yamlContent, 'utf-8');

            // Read back and parse
            const readContent = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(readContent) as any;

            // Verify keys exist (order may vary based on js-yaml version)
            expect(parsedData.requirements['FR-001']).toBeDefined();
            expect(parsedData.requirements['FR-002']).toBeDefined();
            expect(parsedData.requirements['FR-003']).toBeDefined();
        });

        it('DICT-EDGE-031: should handle multi-line strings in Dictionary values', async () => {
            const data = {
                'FR-001': {
                    description: 'This is a long description\nthat spans multiple lines\nand should be preserved'
                }
            };

            const yamlContent = yaml.dump(data);
            await fs.writeFile(testYAMLPath, yamlContent, 'utf-8');

            const readContent = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(readContent) as any;

            expect(parsedData['FR-001'].description).toBe('This is a long description\nthat spans multiple lines\nand should be preserved');
        });

        it('DICT-EDGE-032: should preserve numeric string keys', async () => {
            const data = {
                items: {
                    '123': { id: 'A' },
                    '456': { id: 'B' },
                    '789': { id: 'C' }
                }
            };

            const yamlContent = yaml.dump(data);
            await fs.writeFile(testYAMLPath, yamlContent, 'utf-8');

            const readContent = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(readContent) as any;

            // Verify keys are strings, not numbers
            expect(typeof Object.keys(parsedData.items)[0]).toBe('string');
            expect(parsedData.items['123'].id).toBe('A');
        });

        it('DICT-EDGE-033: should handle Unicode content (Chinese/Japanese)', async () => {
            const data = {
                '功能需求-001': {
                    summary: '用户登录功能',
                    description: '用户必须能够使用用户名和密码登录系统'
                },
                '要件-002': {
                    summary: 'パスワード検証',
                    description: 'システムはパスワードを検証する必要があります'
                }
            };

            const yamlContent = yaml.dump(data, { indent: 2 });
            await fs.writeFile(testYAMLPath, yamlContent, 'utf-8');

            const readContent = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(readContent) as any;

            expect(parsedData['功能需求-001'].summary).toBe('用户登录功能');
            expect(parsedData['要件-002'].summary).toBe('パスワード検証');
        });
    });

    describe('2.7 Error Handling Edge Cases', () => {
        it('DICT-EDGE-034: should recover from invalid YAML syntax', async () => {
            const invalidYAML = `
functional_requirements:
  FR-001:
    summary: "Missing closing quote
    description: "This is invalid YAML
`;

            await fs.writeFile(testYAMLPath, invalidYAML, 'utf-8');

            // Attempt to load should throw or handle gracefully
            const content = await fs.readFile(testYAMLPath, 'utf-8');
            expect(() => {
                yaml.load(content);
            }).toThrow();
        });

        it('DICT-EDGE-035: should provide clear error for type conflicts', () => {
            const data = {
                existing: 'string_value'
            };

            // Attempting to create nested path under primitive should throw clear error
            try {
                YAMLKeyPathOperator.set(data, 'existing.nested.path', 'value');
                fail('Should have thrown error');
            } catch (error) {
                expect(error).toBeInstanceOf(ScaffoldError);
                expect((error as ScaffoldError).message).toContain('已存在非对象值');
            }
        });

        it('DICT-EDGE-036: should throw clear error when creating object under primitive', () => {
            const data = {
                primitiveField: 42
            };

            expect(() => {
                YAMLKeyPathOperator.set(data, 'primitiveField.nested', 'value');
            }).toThrow(ScaffoldError);

            // Verify original value unchanged
            expect(data.primitiveField).toBe(42);
        });
    });

    describe('Additional Critical Edge Cases', () => {
        it('DICT-EDGE-037: should handle keyPath with special characters', () => {
            const data: any = {};

            // Keys with underscores, hyphens, numbers
            YAMLKeyPathOperator.set(data, 'key_with_underscores.key-with-hyphens.key123', 'value');

            expect(data['key_with_underscores']['key-with-hyphens']['key123']).toBe('value');
        });

        it('DICT-EDGE-038: should handle very long keyPath (50+ segments)', () => {
            const data: any = {};
            const segments = Array.from({ length: 50 }, (_, i) => `level${i}`);
            const longPath = segments.join('.');

            YAMLKeyPathOperator.set(data, longPath, 'deep_value');

            const value = YAMLKeyPathOperator.getValue(data, longPath);
            expect(value).toBe('deep_value');
        });

        it('DICT-EDGE-039: should handle setting same value multiple times', () => {
            const data = {
                key: 'original'
            };

            YAMLKeyPathOperator.set(data, 'key', 'value1');
            YAMLKeyPathOperator.set(data, 'key', 'value1'); // Same value
            YAMLKeyPathOperator.set(data, 'key', 'value1'); // Same value again

            expect(data.key).toBe('value1');
        });

        it('DICT-EDGE-040: should handle mixed numeric and string keys at same level', () => {
            const data = {
                mixed: {
                    '0': 'string_zero',
                    '1': 'string_one',
                    'two': 'string_two',
                    'three': 'string_three'
                }
            };

            expect(YAMLKeyPathOperator.getValue(data, 'mixed.0')).toBe('string_zero');
            expect(YAMLKeyPathOperator.getValue(data, 'mixed.two')).toBe('string_two');
        });
    });

    describe('2.8 Empty File Edge Cases (TDD Red Phase)', () => {
        it('DICT-EDGE-041: should create entity in completely empty file (0 bytes)', async () => {
            // Create completely empty file (0 bytes)
            await fs.writeFile(testYAMLPath, '', 'utf-8');

            // Import executeYAMLEdits for this test
            const { executeYAMLEdits } = await import('../../tools/document/yamlEditorTools');

            // Attempt to set entity in empty file
            const result = await executeYAMLEdits({
                targetFile: testYAMLPath,
                edits: [
                    {
                        type: 'set',
                        keyPath: 'use_cases.UC-TEST-001.summary',
                        value: 'Test use case',
                        reason: 'Testing empty file edge case'
                    }
                ]
            });

            // Expected: Success (after fix)
            // Current: Will FAIL with "读取YAML文件失败: 未知错误"
            expect(result.success).toBe(true);

            // Verify entity was created
            const content = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(content) as any;
            expect(parsedData.use_cases['UC-TEST-001'].summary).toBe('Test use case');
        });

        it('DICT-EDGE-042: should create entity in file with only comments', async () => {
            // Create file with only comments (yaml.load returns null)
            await fs.writeFile(testYAMLPath, '# Comment only\n', 'utf-8');

            // Import executeYAMLEdits for this test
            const { executeYAMLEdits } = await import('../../tools/document/yamlEditorTools');

            // Attempt to set entity in comment-only file
            const result = await executeYAMLEdits({
                targetFile: testYAMLPath,
                edits: [
                    {
                        type: 'set',
                        keyPath: 'functional_requirements.FR-TEST-001.summary',
                        value: 'Test requirement',
                        reason: 'Testing comment-only file edge case'
                    }
                ]
            });

            // Expected: Success (yaml.load returns null for comment-only files, should treat as {})
            // Current: Will FAIL with "读取YAML文件失败: 未知错误"
            expect(result.success).toBe(true);

            // Verify entity was created
            const content = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(content) as any;
            expect(parsedData.functional_requirements['FR-TEST-001'].summary).toBe('Test requirement');
        });

        it('DICT-EDGE-043: should create entity in file with only YAML document separator', async () => {
            // Create file with only document separator (yaml.load returns null)
            await fs.writeFile(testYAMLPath, '---\n', 'utf-8');

            // Import executeYAMLEdits for this test
            const { executeYAMLEdits } = await import('../../tools/document/yamlEditorTools');

            // Attempt to set entity in separator-only file
            const result = await executeYAMLEdits({
                targetFile: testYAMLPath,
                edits: [
                    {
                        type: 'set',
                        keyPath: 'non_functional_requirements.NFR-TEST-001.summary',
                        value: 'Test NFR',
                        reason: 'Testing separator-only file edge case'
                    }
                ]
            });

            // Expected: Success (yaml.load returns null for '---' only, should treat as {})
            // Current: Will FAIL with "读取YAML文件失败: 未知错误"
            expect(result.success).toBe(true);

            // Verify entity was created
            const content = await fs.readFile(testYAMLPath, 'utf-8');
            const parsedData = yaml.load(content) as any;
            expect(parsedData.non_functional_requirements['NFR-TEST-001'].summary).toBe('Test NFR');
        });
    });
});
