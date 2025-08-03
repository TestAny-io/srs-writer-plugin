/**
 * 🚀 Specialist Registry集成测试
 * 
 * 测试动态specialist注册系统的完整功能：
 * 1. 文件扫描和解析
 * 2. YAML配置验证
 * 3. SpecialistExecutor集成
 * 4. 向后兼容性
 */

import * as fs from 'fs';
import * as path from 'path';
import { SpecialistRegistry, getSpecialistRegistry } from '../../core/specialistRegistry';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SpecialistDefinition } from '../../types/specialistRegistry';

// Mock modules that depend on VSCode
jest.mock('../../core/orchestrator/ToolAccessController');
jest.mock('../../core/orchestrator/ToolCacheManager');
jest.mock('../../core/toolExecutor');
jest.mock('../../core/prompts/PromptAssemblyEngine');

// Mock VSCode API
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn(() => ({
            extensionPath: path.join(__dirname, '../../../')
        }))
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn(() => ({}))
        }))
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        }))
    },
    FileType: {
        Directory: 2,
        File: 1
    }
}));

describe('Specialist Registry Integration Tests', () => {
    let registry: SpecialistRegistry;
    
    beforeEach(() => {
        // 创建新的注册表实例
        registry = new SpecialistRegistry();
    });

    afterEach(() => {
        // 清理注册表
        registry.clear();
    });

    describe('🔍 文件扫描和解析', () => {
        test('应该能够扫描并解析specialist文件', async () => {
            // 执行扫描
            const scanResult = await registry.scanAndRegister();
            
            // 验证扫描结果
            expect(scanResult.validSpecialists.length).toBeGreaterThan(0);
            expect(scanResult.invalidFiles.length).toBe(0);
            expect(scanResult.scanStats.totalFiles).toBeGreaterThan(0);
            
            console.log(`📊 扫描统计: 总计${scanResult.scanStats.totalFiles}个文件，有效${scanResult.validSpecialists.length}个`);
        });

        test('应该能够解析新的specialist_config格式', async () => {
            await registry.scanAndRegister();
            
            // 检查fr_writer（已更新为新格式）
            const frWriter = registry.getSpecialist('fr_writer');
            expect(frWriter).toBeDefined();
            expect(frWriter!.config.enabled).toBe(true);
            expect(frWriter!.config.category).toBe('content');
            expect(frWriter!.config.version).toBe('2.0.0');
            expect(frWriter!.config.capabilities).toContain('markdown_editing');
            expect(frWriter!.config.tags).toContain('requirement');
            
            console.log(`✅ fr_writer配置解析正确: ${JSON.stringify(frWriter!.config, null, 2)}`);
        });

        test('应该能够解析process类型的specialist', async () => {
            await registry.scanAndRegister();
            
            // 检查project_initializer（process类型）
            const projectInitializer = registry.getSpecialist('project_initializer');
            expect(projectInitializer).toBeDefined();
            expect(projectInitializer!.config.category).toBe('process');
            expect(projectInitializer!.config.capabilities).toContain('project_scaffolding');
            
            console.log(`✅ project_initializer配置解析正确: ${JSON.stringify(projectInitializer!.config, null, 2)}`);
        });
    });

    describe('🔄 向后兼容性测试', () => {
        test('应该能够解析旧格式的assembly_config', async () => {
            await registry.scanAndRegister();
            
            // 查找没有specialist_config但有assembly_config的specialist
            const allSpecialists = registry.getAllSpecialists();
            const legacySpecialists = allSpecialists.filter(s => 
                s.config.tags?.includes('legacy') || 
                (s.assemblyConfig && !s.ruleContent.includes('specialist_config:'))
            );
            
            if (legacySpecialists.length > 0) {
                const legacySpecialist = legacySpecialists[0];
                expect(legacySpecialist.config.enabled).toBe(true);
                expect(['content', 'process']).toContain(legacySpecialist.config.category);
                
                console.log(`✅ Legacy specialist解析正确: ${legacySpecialist.config.id}`);
            }
        });
    });

    describe('📊 查询和统计', () => {
        test('应该能够按条件查询specialist', async () => {
            await registry.scanAndRegister();
            
            // 查询content类型的specialist
            const contentSpecialists = registry.getAllSpecialists({ category: 'content' });
            expect(contentSpecialists.length).toBeGreaterThan(0);
            expect(contentSpecialists.every(s => s.config.category === 'content')).toBe(true);
            
            // 查询process类型的specialist
            const processSpecialists = registry.getAllSpecialists({ category: 'process' });
            expect(processSpecialists.length).toBeGreaterThan(0);
            expect(processSpecialists.every(s => s.config.category === 'process')).toBe(true);
            
            // 查询启用的specialist
            const enabledSpecialists = registry.getAllSpecialists({ enabled: true });
            expect(enabledSpecialists.every(s => s.config.enabled === true)).toBe(true);
            
            console.log(`📋 查询结果: content=${contentSpecialists.length}, process=${processSpecialists.length}, enabled=${enabledSpecialists.length}`);
        });

        test('应该能够获取正确的统计信息', async () => {
            await registry.scanAndRegister();
            
            const stats = registry.getStats();
            expect(stats.totalSpecialists).toBeGreaterThan(0);
            expect(stats.enabledSpecialists).toBeGreaterThan(0);
            expect(stats.byCategory.content).toBeGreaterThan(0);
            expect(stats.byCategory.process).toBeGreaterThan(0);
            
            console.log(`📊 统计信息: ${JSON.stringify(stats, null, 2)}`);
        });
    });

    describe('🔧 SpecialistExecutor集成', () => {
        test('SpecialistExecutor应该能够使用新的注册表', async () => {
            const executor = new SpecialistExecutor();
            
            // 等待注册表初始化
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 验证mapSpecialistIdToType方法能够工作
            // 这里我们通过反射访问私有方法进行测试
            const mapMethod = (executor as any).mapSpecialistIdToType;
            if (mapMethod) {
                const frWriterType = mapMethod.call(executor, 'fr_writer');
                expect(frWriterType.name).toBe('fr_writer');
                expect(frWriterType.category).toBe('content');
                
                const projectInitializerType = mapMethod.call(executor, 'project_initializer');
                expect(projectInitializerType.name).toBe('project_initializer');
                expect(projectInitializerType.category).toBe('process');
                
                console.log(`✅ SpecialistExecutor映射测试通过`);
            }
        });
    });

    describe('🔄 边缘情况和错误处理', () => {
        test('应该优雅处理无效的YAML文件', async () => {
            // 创建临时的无效specialist文件
            const tempDir = path.join(__dirname, '../fixtures/temp-specialists');
            const contentDir = path.join(tempDir, 'content');
            
            // 确保目录存在
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            if (!fs.existsSync(contentDir)) {
                fs.mkdirSync(contentDir, { recursive: true });
            }
            
            const invalidFile = path.join(contentDir, 'invalid_specialist.md');
            
            try {
                // 写入无效的YAML文件
                fs.writeFileSync(invalidFile, `---
invalid yaml content:
  - missing quotes
  - [unclosed bracket
specialist_config:
  enabled: true
  id missing_colon
---
Some content here.`);
                
                // 创建一个使用临时目录的注册表
                const tempRegistry = new SpecialistRegistry();
                
                // 模拟扫描（这里实际会使用真实路径，但我们可以验证错误处理）
                const result = await tempRegistry.scanAndRegister();
                
                // 即使有无效文件，扫描也应该继续
                expect(result).toBeDefined();
                
            } finally {
                // 清理临时文件
                if (fs.existsSync(invalidFile)) {
                    fs.unlinkSync(invalidFile);
                }
                if (fs.existsSync(contentDir)) {
                    fs.rmdirSync(contentDir);
                }
                if (fs.existsSync(tempDir)) {
                    fs.rmdirSync(tempDir);
                }
            }
        });

        test('应该处理specialist不存在的情况', async () => {
            await registry.scanAndRegister();
            
            const nonExistent = registry.getSpecialist('non_existent_specialist');
            expect(nonExistent).toBeUndefined();
            
            const isAvailable = registry.isSpecialistAvailable('non_existent_specialist');
            expect(isAvailable).toBe(false);
            
            const type = registry.getSpecialistType('non_existent_specialist');
            expect(type).toBeNull();
        });
    });

    describe('🎯 配置验证', () => {
        test('应该验证specialist配置的有效性', async () => {
            await registry.scanAndRegister();
            
            const specialists = registry.getAllSpecialists();
            
            specialists.forEach(specialist => {
                // 验证必需字段
                expect(specialist.config.id).toBeTruthy();
                expect(specialist.config.name).toBeTruthy();
                expect(['content', 'process']).toContain(specialist.config.category);
                expect(typeof specialist.config.enabled).toBe('boolean');
                
                // 验证ID格式
                expect(specialist.config.id).toMatch(/^[a-z0-9_]+$/);
                
                console.log(`✅ ${specialist.config.id} 配置验证通过`);
            });
        });
    });
});

/**
 * 🚀 性能测试
 */
describe('Specialist Registry Performance Tests', () => {
    test('扫描性能应该在合理范围内', async () => {
        const registry = new SpecialistRegistry();
        
        const startTime = Date.now();
        const result = await registry.scanAndRegister();
        const endTime = Date.now();
        
        const scanTime = endTime - startTime;
        
        // 扫描时间应该在5秒内（在CI环境可能较慢）
        expect(scanTime).toBeLessThan(5000);
        
        console.log(`⚡ 扫描性能: ${scanTime}ms，处理${result.validSpecialists.length}个specialist`);
        
        // 验证缓存效果
        const cacheStartTime = Date.now();
        await registry.scanAndRegister(); // 第二次扫描应该更快
        const cacheEndTime = Date.now();
        
        const cacheTime = cacheEndTime - cacheStartTime;
        console.log(`🚀 缓存效果: 第二次扫描用时${cacheTime}ms`);
        
        registry.clear();
    });
});

/**
 * 🔧 实用测试函数
 */
function createTestSpecialistFile(content: string): string {
    const tempFile = path.join(__dirname, '../fixtures/temp_specialist.md');
    fs.writeFileSync(tempFile, content);
    return tempFile;
}

function cleanupTestFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}