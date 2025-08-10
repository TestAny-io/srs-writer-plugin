import { Logger } from '../../utils/logger';
import { 
    SpecialistIterationConfig, 
    SpecialistCategory,
    DEFAULT_SPECIALIST_ITERATION_CONFIG,
    SPECIALIST_CATEGORY_MAPPING,
    getSpecialistCategory,
    HistoryManagementConfig
} from './SpecialistIterationConfig';
import { getSpecialistRegistry } from '../specialistRegistry';
import type { SpecialistRegistry } from '../specialistRegistry';

/**
 * Specialist迭代限制管理器 - 单例模式
 * 
 * 功能：
 * 1. 根据specialist ID或类别获取最大迭代次数
 * 2. 支持动态配置更新
 * 3. 提供配置来源追踪（调试用）
 */
export class SpecialistIterationManager {
    private static instance: SpecialistIterationManager;
    private logger = Logger.getInstance();
    private config: SpecialistIterationConfig;
    private specialistRegistry: SpecialistRegistry;

    private constructor() {
        this.config = { ...DEFAULT_SPECIALIST_ITERATION_CONFIG };
        this.specialistRegistry = getSpecialistRegistry();
        this.logger.info('🎛️ SpecialistIterationManager initialized with default config and registry integration');
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): SpecialistIterationManager {
        if (!SpecialistIterationManager.instance) {
            SpecialistIterationManager.instance = new SpecialistIterationManager();
        }
        return SpecialistIterationManager.instance;
    }

    /**
     * 获取指定specialist的最大迭代次数
     * 
     * 🚀 新优先级（集成SpecialistRegistry）：
     * 1. SpecialistRegistry中的iteration_config.max_iterations（动态配置）
     * 2. specialistOverrides中的个性化配置（硬编码配置）
     * 3. 根据specialist类别的默认配置
     * 4. 全局默认值
     * 
     * @param specialistId specialist标识符
     * @returns { maxIterations: number, source: string } 最大迭代次数和配置来源
     */
    public getMaxIterations(specialistId: string): { maxIterations: number; source: string } {
        // 🚀 1. 优先检查SpecialistRegistry中的动态配置
        try {
            const specialist = this.specialistRegistry.getSpecialist(specialistId);
            if (specialist?.config.iteration_config?.max_iterations !== undefined) {
                const maxIterations = specialist.config.iteration_config.max_iterations;
                this.logger.info(`🎯 [SpecialistIterationManager] Using dynamic config for ${specialistId}: ${maxIterations} iterations`);
                return {
                    maxIterations,
                    source: `specialist_config.iteration_config.max_iterations[${specialistId}]`
                };
            }
        } catch (error) {
            this.logger.warn(`⚠️ [SpecialistIterationManager] Failed to read dynamic config for ${specialistId}: ${(error as Error).message}`);
        }

        // 🔄 2. 回退到硬编码的个性化配置
        if (this.config.specialistOverrides[specialistId] !== undefined) {
            const maxIterations = this.config.specialistOverrides[specialistId];
            return {
                maxIterations,
                source: `specialistOverrides[${specialistId}]`
            };
        }

        // 🔄 3. 根据类别获取默认配置
        const category = this.getSpecialistCategory(specialistId);
        if (category) {
            const maxIterations = this.config.categoryDefaults[category];
            return {
                maxIterations,
                source: `categoryDefaults[${category}]`
            };
        }

        // 🔄 4. 使用全局默认值
        return {
            maxIterations: this.config.globalDefault,
            source: 'globalDefault'
        };
    }

    /**
     * 获取specialist的类别
     * @param specialistId specialist标识符
     * @returns SpecialistCategory | null
     */
    public getSpecialistCategory(specialistId: string): SpecialistCategory | null {
        return SPECIALIST_CATEGORY_MAPPING[specialistId] || null;
    }

    /**
     * 更新配置（支持运行时动态配置）
     * @param newConfig 新的配置
     */
    public updateConfig(newConfig: Partial<SpecialistIterationConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            categoryDefaults: {
                ...this.config.categoryDefaults,
                ...(newConfig.categoryDefaults || {})
            },
            specialistOverrides: {
                ...this.config.specialistOverrides,
                ...(newConfig.specialistOverrides || {})
            }
        };
        
        this.logger.info('🔄 SpecialistIterationManager config updated');
    }

    /**
     * 获取当前完整配置（调试用）
     */
    public getCurrentConfig(): SpecialistIterationConfig {
        return { ...this.config };
    }

    /**
     * 重置为默认配置
     */
    public resetToDefault(): void {
        this.config = { ...DEFAULT_SPECIALIST_ITERATION_CONFIG };
        this.logger.info('🔄 SpecialistIterationManager reset to default config');
    }

    /**
     * 获取所有已配置specialist的迭代限制概览（调试用）
     */
    public getConfigSummary(): { [specialistId: string]: { maxIterations: number; source: string } } {
        const summary: { [specialistId: string]: { maxIterations: number; source: string } } = {};
        
        // 获取所有已知的specialist
        const allSpecialists = [
            ...Object.keys(this.config.specialistOverrides),
            ...Object.keys(SPECIALIST_CATEGORY_MAPPING)
        ];
        
        // 去重并获取配置
        const uniqueSpecialists = [...new Set(allSpecialists)];
        for (const specialistId of uniqueSpecialists) {
            summary[specialistId] = this.getMaxIterations(specialistId);
        }
        
        return summary;
    }

    /**
     * 🚀 新增：获取历史管理配置
     */
    public getHistoryConfig(): HistoryManagementConfig | null {
        return this.config.historyConfig || null;
    }
} 