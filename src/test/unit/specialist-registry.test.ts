/**
 * 🚀 SpecialistRegistry单元测试
 * 
 * 专门测试SpecialistRegistry的核心功能，避免复杂的依赖
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistRegistry } from '../../core/specialistRegistry';

// Mock VSCode API
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn(() => ({
            extensionPath: path.join(__dirname, '../../../')
        }))
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        }))
    }
}));

describe('SpecialistRegistry Unit Tests', () => {
    let registry: SpecialistRegistry;
    
    beforeEach(() => {
        registry = new SpecialistRegistry();
    });

    afterEach(() => {
        registry.clear();
    });

    describe('🔍 基础功能', () => {
        test('应该能够创建SpecialistRegistry实例', () => {
            expect(registry).toBeDefined();
            expect(registry).toBeInstanceOf(SpecialistRegistry);
        });

        test('应该能够清理注册表', () => {
            registry.clear();
            const stats = registry.getStats();
            expect(stats.totalSpecialists).toBe(0);
        });

        test('应该能够检查不存在的specialist', () => {
            const nonExistent = registry.getSpecialist('non_existent');
            expect(nonExistent).toBeUndefined();
            
            const isAvailable = registry.isSpecialistAvailable('non_existent');
            expect(isAvailable).toBe(false);
            
            const type = registry.getSpecialistType('non_existent');
            expect(type).toBeNull();
        });
    });

    describe('📊 统计功能', () => {
        test('应该返回正确的空统计信息', () => {
            const stats = registry.getStats();
            
            expect(stats.totalSpecialists).toBe(0);
            expect(stats.enabledSpecialists).toBe(0);
            expect(stats.disabledSpecialists).toBe(0);
            expect(stats.byCategory.content).toBe(0);
            expect(stats.byCategory.process).toBe(0);
            expect(stats.lastScanTime).toBe(0);
        });

        test('应该能够查询空的specialist列表', () => {
            const allSpecialists = registry.getAllSpecialists();
            expect(allSpecialists).toEqual([]);
            
            const contentSpecialists = registry.getAllSpecialists({ category: 'content' });
            expect(contentSpecialists).toEqual([]);
            
            const processSpecialists = registry.getAllSpecialists({ category: 'process' });
            expect(processSpecialists).toEqual([]);
        });
    });

    describe('🧪 配置验证', () => {
        test('应该验证specialist配置格式', () => {
            // 测试配置验证逻辑（通过私有方法）
            const validateMethod = (registry as any).validateSpecialistConfig;
            
            if (validateMethod) {
                // 测试有效配置
                const validConfig = {
                    enabled: true,
                    id: 'test_specialist',
                    name: 'Test Specialist',
                    category: 'content' as const
                };
                
                const validResult = validateMethod.call(registry, validConfig);
                expect(validResult.isValid).toBe(true);
                expect(validResult.errors).toEqual([]);
                
                // 测试无效配置
                const invalidConfig = {
                    enabled: true,
                    id: '', // 空ID
                    name: 'Test Specialist',
                    category: 'invalid' as any
                };
                
                const invalidResult = validateMethod.call(registry, invalidConfig);
                expect(invalidResult.isValid).toBe(false);
                expect(invalidResult.errors.length).toBeGreaterThan(0);
            }
        });
    });
});

/**
 * 🚀 YAML解析测试
 */
describe('SpecialistRegistry YAML Parsing Tests', () => {
    let registry: SpecialistRegistry;
    
    beforeEach(() => {
        registry = new SpecialistRegistry();
    });

    afterEach(() => {
        registry.clear();
    });

    test('应该能够解析新格式的specialist配置', () => {
        const parseMethod = (registry as any).parseNewFormat;
        
        if (parseMethod) {
            const mockConfig = {
                enabled: true,
                id: 'test_writer',
                name: 'Test Writer',
                category: 'content',
                version: '1.0.0',
                description: 'Test description',
                capabilities: ['writing', 'editing'],
                tags: ['test', 'writer']
            };
            
            const result = parseMethod.call(registry, mockConfig, 'content', 'test_writer.md');
            
            expect(result.enabled).toBe(true);
            expect(result.id).toBe('test_writer');
            expect(result.category).toBe('content');
            expect(result.capabilities).toEqual(['writing', 'editing']);
            expect(result.tags).toEqual(['test', 'writer']);
        }
    });

    test('应该能够解析旧格式的assembly配置', () => {
        const parseMethod = (registry as any).parseOldFormat;
        
        if (parseMethod) {
            const mockAssemblyConfig = {
                specialist_type: 'content',
                specialist_name: 'Legacy Writer'
            };
            
            const result = parseMethod.call(registry, mockAssemblyConfig, 'content', 'legacy_writer.md');
            
            expect(result.enabled).toBe(true);
            expect(result.id).toBe('legacy_writer');
            expect(result.name).toBe('Legacy Writer');
            expect(result.category).toBe('content');
            expect(result.tags).toContain('legacy');
        }
    });
});

/**
 * 🚀 向后兼容性测试
 */
describe('SpecialistRegistry Backward Compatibility Tests', () => {
    let registry: SpecialistRegistry;
    
    beforeEach(() => {
        registry = new SpecialistRegistry();
    });

    afterEach(() => {
        registry.clear();
    });

    test('应该能够处理各种specialist名称格式', () => {
        const testCases = [
            'fr_writer',
            'project_initializer', 
            'user_journey_writer',
            'complex_specialist_name'
        ];
        
        testCases.forEach(specialistId => {
            // 测试getSpecialistType方法的向后兼容性
            const type = registry.getSpecialistType(specialistId);
            
            // 如果specialist不存在，应该返回null（而不是抛出错误）
            expect(type).toBeNull();
        });
    });
});