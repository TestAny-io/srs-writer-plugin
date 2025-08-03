/**
 * 🚀 Iteration Config集成测试
 * 
 * 测试specialist配置文件中的iteration_config是否被正确读取和使用
 */

import { SpecialistIterationManager } from '../../core/config/SpecialistIterationManager';
import { getSpecialistRegistry } from '../../core/specialistRegistry';

// Mock VSCode API
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn(() => ({
            extensionPath: require('path').join(__dirname, '../../../')
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

describe('Iteration Config Integration Tests', () => {
    let iterationManager: SpecialistIterationManager;
    
    beforeEach(async () => {
        // 获取iteration manager实例
        iterationManager = SpecialistIterationManager.getInstance();
        
        // 确保specialist registry已经初始化
        const registry = getSpecialistRegistry();
        await registry.scanAndRegister();
    });

    describe('🔍 动态配置读取', () => {
        test('应该优先使用specialist配置文件中的iteration_config', async () => {
            // 测试fr_writer（在配置文件中设置了max_iterations: 5）
            const frWriterResult = iterationManager.getMaxIterations('fr_writer');
            
            console.log(`✅ fr_writer迭代配置: ${frWriterResult.maxIterations} iterations (来源: ${frWriterResult.source})`);
            
            // 验证是否使用了动态配置
            expect(frWriterResult.maxIterations).toBe(5);
            expect(frWriterResult.source).toContain('specialist_config.iteration_config.max_iterations');
        });

        test('应该优先使用project_initializer配置文件中的iteration_config', async () => {
            // 测试project_initializer（在配置文件中设置了max_iterations: 3）
            const projectInitResult = iterationManager.getMaxIterations('project_initializer');
            
            console.log(`✅ project_initializer迭代配置: ${projectInitResult.maxIterations} iterations (来源: ${projectInitResult.source})`);
            
            // 验证是否使用了动态配置
            expect(projectInitResult.maxIterations).toBe(3);
            expect(projectInitResult.source).toContain('specialist_config.iteration_config.max_iterations');
        });

        test('对于没有iteration_config的specialist应该回退到硬编码配置', async () => {
            // 测试legacy specialist（比如nfr_writer，应该没有新格式的配置）
            const nfrWriterResult = iterationManager.getMaxIterations('nfr_writer');
            
            console.log(`✅ nfr_writer迭代配置: ${nfrWriterResult.maxIterations} iterations (来源: ${nfrWriterResult.source})`);
            
            // 应该回退到硬编码配置或类别默认值
            expect(nfrWriterResult.maxIterations).toBeGreaterThan(0);
            expect(nfrWriterResult.source).not.toContain('specialist_config.iteration_config');
        });

        test('对于不存在的specialist应该使用全局默认值', () => {
            const unknownResult = iterationManager.getMaxIterations('unknown_specialist');
            
            console.log(`✅ unknown_specialist迭代配置: ${unknownResult.maxIterations} iterations (来源: ${unknownResult.source})`);
            
            // 应该使用全局默认值
            expect(unknownResult.maxIterations).toBeGreaterThan(0);
            expect(unknownResult.source).toBe('globalDefault');
        });
    });

    describe('📊 配置优先级验证', () => {
        test('应该验证完整的配置优先级', async () => {
            // 获取几个不同类型specialist的配置，验证优先级
            const specialists = [
                'fr_writer',           // 有新配置
                'project_initializer', // 有新配置
                'nfr_writer',         // 应该回退到硬编码
                'unknown_specialist'   // 应该使用全局默认
            ];
            
            console.log('\n📋 配置优先级测试结果:');
            
            for (const specialistId of specialists) {
                const result = iterationManager.getMaxIterations(specialistId);
                console.log(`  ${specialistId}: ${result.maxIterations} iterations (${result.source})`);
                
                // 验证都有合理的迭代次数
                expect(result.maxIterations).toBeGreaterThan(0);
                expect(result.maxIterations).toBeLessThan(100); // 合理的上限
            }
        });
    });

    describe('🔧 配置来源追踪', () => {
        test('应该正确标识配置来源', async () => {
            // 测试动态配置的specialist
            const dynamicConfigResult = iterationManager.getMaxIterations('fr_writer');
            expect(dynamicConfigResult.source).toMatch(/specialist_config\.iteration_config\.max_iterations\[.*\]/);
            
            // 测试硬编码配置的specialist（如果存在）
            const hardcodedResult = iterationManager.getMaxIterations('prototype_designer');
            
            // prototype_designer可能有硬编码配置，也可能回退到类别默认值
            expect(hardcodedResult.source).toMatch(/(specialistOverrides|categoryDefaults|globalDefault)/);
            
            console.log(`📊 配置来源追踪测试:`);
            console.log(`  动态配置: ${dynamicConfigResult.source}`);
            console.log(`  硬编码配置: ${hardcodedResult.source}`);
        });
    });

    describe('🚀 实际使用场景模拟', () => {
        test('应该能处理specialist执行时的迭代限制', async () => {
            // 模拟specialist执行时获取迭代限制的场景
            const testSpecialists = ['fr_writer', 'project_initializer', 'nfr_writer'];
            
            for (const specialistId of testSpecialists) {
                const { maxIterations, source } = iterationManager.getMaxIterations(specialistId);
                
                // 验证迭代次数在合理范围内
                expect(maxIterations).toBeGreaterThanOrEqual(1);
                expect(maxIterations).toBeLessThanOrEqual(50);
                
                // 验证来源信息不为空
                expect(source).toBeTruthy();
                
                console.log(`🎯 ${specialistId} 执行限制: 最多${maxIterations}次迭代 (${source})`);
            }
        });
    });
});

/**
 * 🚀 性能测试
 */
describe('Iteration Config Performance Tests', () => {
    test('配置读取性能应该在合理范围内', async () => {
        const iterationManager = SpecialistIterationManager.getInstance();
        
        const startTime = Date.now();
        
        // 连续读取多次配置
        for (let i = 0; i < 100; i++) {
            iterationManager.getMaxIterations('fr_writer');
            iterationManager.getMaxIterations('project_initializer');
            iterationManager.getMaxIterations('unknown_specialist');
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`⚡ 配置读取性能: 300次读取用时${duration}ms`);
        
        // 100次读取应该在100ms内完成
        expect(duration).toBeLessThan(100);
    });
});