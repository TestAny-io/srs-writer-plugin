import * as vscode from 'vscode';
import { SpecialistIterationManager } from '../../core/config/SpecialistIterationManager';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { DEFAULT_SPECIALIST_ITERATION_CONFIG } from '../../core/config/SpecialistIterationConfig';

// Mock VSCode API
jest.mock('vscode', () => ({
    LanguageModelChatMessage: {
        User: jest.fn((content) => ({ role: 'user', content }))
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        }))
    }
}));

describe('🎛️ Specialist迭代限制集成测试', () => {
    let iterationManager: SpecialistIterationManager;
    let specialistExecutor: SpecialistExecutor;

    beforeEach(() => {
        // 重置配置管理器到默认状态
        iterationManager = SpecialistIterationManager.getInstance();
        iterationManager.resetToDefault();
        
        specialistExecutor = new SpecialistExecutor();
    });

    describe('配置管理器基础功能', () => {
        test('应该正确获取内容类specialist的迭代限制', () => {
            const { maxIterations, source } = iterationManager.getMaxIterations('fr_writer');
            
            expect(maxIterations).toBe(15);
            expect(source).toBe('specialistOverrides[fr_writer]');
        });

        test('应该正确获取流程类specialist的迭代限制', () => {
            const { maxIterations, source } = iterationManager.getMaxIterations('git_operator');
            
            expect(maxIterations).toBe(5);
            expect(source).toBe('specialistOverrides[git_operator]');
        });

        test('应该为未配置的specialist使用类别默认值', () => {
            // 假设有一个新的内容specialist但没有个性化配置
            const { maxIterations, source } = iterationManager.getMaxIterations('new_content_specialist');
            
            // 因为没有个性化配置，也不在分类映射中，应该使用全局默认
            expect(maxIterations).toBe(10);
            expect(source).toBe('globalDefault');
        });

        test('应该正确识别specialist类别', () => {
            expect(iterationManager.getSpecialistCategory('fr_writer')).toBe('content');
            expect(iterationManager.getSpecialistCategory('git_operator')).toBe('process');
            expect(iterationManager.getSpecialistCategory('unknown_specialist')).toBeNull();
        });
    });

    describe('配置优先级测试', () => {
        test('个性化配置应该优先于类别默认值', () => {
            // fr_writer有个性化配置15，应该优先于content类别默认15
            const { maxIterations, source } = iterationManager.getMaxIterations('fr_writer');
            
            expect(maxIterations).toBe(15);
            expect(source).toBe('specialistOverrides[fr_writer]');
        });

        test('类别默认值应该优先于全局默认值', () => {
            // 手动设置类别映射，但不设置个性化配置
            const originalMapping = require('../../core/config/SpecialistIterationConfig').SPECIALIST_CATEGORY_MAPPING;
            originalMapping['test_content_specialist'] = 'content';

            const { maxIterations, source } = iterationManager.getMaxIterations('test_content_specialist');
            
            expect(maxIterations).toBe(15); // content类别默认值
            expect(source).toBe('categoryDefaults[content]');
        });
    });

    describe('动态配置更新', () => {
        test('应该能够动态更新specialist的迭代限制', () => {
            // 更新fr_writer的配置
            iterationManager.updateConfig({
                specialistOverrides: {
                    'fr_writer': 20
                }
            });

            const { maxIterations, source } = iterationManager.getMaxIterations('fr_writer');
            
            expect(maxIterations).toBe(20);
            expect(source).toBe('specialistOverrides[fr_writer]');
        });

        test('应该能够动态更新类别默认值', () => {
            // 更新content类别的默认值
            iterationManager.updateConfig({
                categoryDefaults: {
                    content: 20,
                    process: 8
                }
            });

            // 对于没有个性化配置的content specialist，应该使用新的类别默认值
            const originalMapping = require('../../core/config/SpecialistIterationConfig').SPECIALIST_CATEGORY_MAPPING;
            originalMapping['test_content_specialist'] = 'content';

            const { maxIterations } = iterationManager.getMaxIterations('test_content_specialist');
            expect(maxIterations).toBe(20);
        });

        test('重置配置应该恢复到默认状态', () => {
            // 先修改配置
            iterationManager.updateConfig({
                specialistOverrides: {
                    'fr_writer': 25
                }
            });

            // 验证修改生效
            expect(iterationManager.getMaxIterations('fr_writer').maxIterations).toBe(25);

            // 重置配置
            iterationManager.resetToDefault();

            // 验证恢复到默认值
            expect(iterationManager.getMaxIterations('fr_writer').maxIterations).toBe(15);
        });
    });

    describe('配置概览功能', () => {
        test('应该能够获取所有specialist的配置概览', () => {
            const summary = iterationManager.getConfigSummary();
            
            // 检查一些关键specialist是否包含在概览中
            expect(summary['fr_writer']).toEqual({
                maxIterations: 15,
                source: 'specialistOverrides[fr_writer]'
            });
            
            expect(summary['git_operator']).toEqual({
                maxIterations: 5,
                source: 'specialistOverrides[git_operator]'
            });
            
            expect(summary['prototype_designer']).toEqual({
                maxIterations: 18,
                source: 'specialistOverrides[prototype_designer]'
            });
        });
    });

    describe('边界情况测试', () => {
        test('空字符串specialist ID应该使用全局默认值', () => {
            const { maxIterations, source } = iterationManager.getMaxIterations('');
            
            expect(maxIterations).toBe(10);
            expect(source).toBe('globalDefault');
        });

        test('undefined specialist ID应该使用全局默认值', () => {
            const { maxIterations, source } = iterationManager.getMaxIterations(undefined as any);
            
            expect(maxIterations).toBe(10);
            expect(source).toBe('globalDefault');
        });

        test('配置值为0的specialist应该正确返回0', () => {
            iterationManager.updateConfig({
                specialistOverrides: {
                    'zero_iteration_specialist': 0
                }
            });

            const { maxIterations, source } = iterationManager.getMaxIterations('zero_iteration_specialist');
            
            expect(maxIterations).toBe(0);
            expect(source).toBe('specialistOverrides[zero_iteration_specialist]');
        });
    });

    describe('实际场景模拟', () => {
        test('不同类型specialist应该使用不同的迭代限制', () => {
            const contentSpecialists = ['fr_writer', 'nfr_writer', 'user_journey_writer'];
            const processSpecialists = ['git_operator', 'project_initializer'];

            // 内容specialist通常应该有更多迭代次数
            for (const specialist of contentSpecialists) {
                const { maxIterations } = iterationManager.getMaxIterations(specialist);
                expect(maxIterations).toBeGreaterThanOrEqual(10);
            }

            // 流程specialist通常迭代次数较少
            for (const specialist of processSpecialists) {
                const { maxIterations } = iterationManager.getMaxIterations(specialist);
                expect(maxIterations).toBeLessThanOrEqual(10);
            }
        });

        test('原型设计师应该有最多的迭代次数', () => {
            const { maxIterations } = iterationManager.getMaxIterations('prototype_designer');
            
            // 检查是否是所有配置中最高的
            const allConfigs = Object.values(DEFAULT_SPECIALIST_ITERATION_CONFIG.specialistOverrides);
            const maxConfigValue = Math.max(...allConfigs);
            
            expect(maxIterations).toBe(maxConfigValue);
            expect(maxIterations).toBe(18);
        });
    });
}); 