import { Logger } from '../../utils/logger';
import { getAvailableTools } from '../toolExecutor';
import { toolRegistry } from '../../tools/index';
import { CallerType } from '../../types/index';
import { ToolAccessController } from './ToolAccessController';

/**
 * 工具缓存管理器 - 负责工具定义的缓存和更新 + 访问控制
 * 
 * v3.0 更新：
 * - 支持 specialist ID 级别的缓存
 * - 缓存键：`${callerType}:${specialistId || 'any'}`
 */
export class ToolCacheManager {
  private logger = Logger.getInstance();
  private accessController = new ToolAccessController();
  
  // 🚀 v3.0: 缓存键包含 specialist ID
  private toolsCache: Map<string, { definitions: any[], jsonSchema: string }> = new Map();

  constructor() {
    // 🔧 立即注册工具缓存失效监听器
    this.registerCacheInvalidationListener();
  }

  /**
   * 注册缓存失效监听器（支持重试机制）
   */
  private registerCacheInvalidationListener(): void {
    const maxRetries = 5;
    let retryCount = 0;

    const tryRegister = () => {
      try {
        if (toolRegistry && typeof toolRegistry.onCacheInvalidation === 'function') {
          toolRegistry.onCacheInvalidation(() => {
            this.invalidateToolCache();
          });
          this.logger.info('🔗 Tool cache invalidation listener registered');
          return true;
        } else if (retryCount < maxRetries) {
          // 如果toolRegistry还没准备好，延迟重试
          retryCount++;
          setTimeout(tryRegister, 10 * retryCount); // 递增延迟
          return false;
        } else {
          this.logger.warn('Failed to register cache invalidation listener: toolRegistry not available after retries');
          return false;
        }
      } catch (error) {
        this.logger.warn(`Failed to register cache invalidation listener: ${(error as Error).message}`);
        return false;
      }
    };

    tryRegister();
  }

  // 🚀 v3.0: 跟踪已记录的缓存使用情况（缓存键为字符串）
  private loggedCacheUsage: Set<string> = new Set();

  /**
   * 🚀 v3.0: 获取指定调用者可访问的工具（带缓存，支持 specialist ID）
   */
  public async getTools(caller: CallerType, specialistId?: string): Promise<{ definitions: any[], jsonSchema: string }> {
    const cacheKey = this.buildCacheKey(caller, specialistId);
    
    // 如果缓存有效，直接返回
    if (this.toolsCache.has(cacheKey)) {
      const cached = this.toolsCache.get(cacheKey)!;
      // 只在第一次使用缓存时记录日志
      if (!this.loggedCacheUsage.has(cacheKey)) {
        const callerDesc = specialistId ? `${caller}:${specialistId}` : caller;
        this.logger.info(`✅ Using cached tools for ${callerDesc} (${cached.definitions.length} tools)`);
        this.loggedCacheUsage.add(cacheKey);
      }
      return cached;
    }

    // 如果没有缓存，则基于访问控制加载并创建缓存
    const callerDesc = specialistId ? `${caller}:${specialistId}` : caller;
    this.logger.info(`🛠️ Loading and caching tools for ${callerDesc}...`);
    
    const filteredDefinitions = this.accessController.getAvailableTools(caller, specialistId);
    const jsonSchema = JSON.stringify(filteredDefinitions, null, 2);

    const result = { definitions: filteredDefinitions, jsonSchema };
    this.toolsCache.set(cacheKey, result);

    this.logger.info(`✅ Cached ${filteredDefinitions.length} tools for ${callerDesc}`);
    return result;
  }
  
  /**
   * 🚀 v3.0 新增：构建缓存键
   */
  private buildCacheKey(caller: CallerType, specialistId?: string): string {
    return specialistId ? `${caller}:${specialistId}` : `${caller}:any`;
  }

  /**
   * 🚀 向后兼容：获取所有工具（无访问控制）
   */
  public async getAllTools(): Promise<{ definitions: any[], jsonSchema: string }> {
    // 使用 ORCHESTRATOR_TOOL_EXECUTION 作为默认，它有最高权限
    return await this.getTools(CallerType.ORCHESTRATOR_TOOL_EXECUTION);
  }

  /**
   * 🚀 新增：获取用于提示词的工具列表（过滤掉与输入schema无关的字段）
   * 
   * 过滤掉以下字段以减少token消耗：
   * - interactionType, riskLevel, requiresConfirmation（用户交互相关）
   * - accessibleBy（访问控制相关）
   * - layer, category（分类相关）
   */
  /**
   * 🚀 v3.0: 获取用于提示词的工具定义（清理版，支持 specialist ID）
   */
  public async getToolsForPrompt(caller: CallerType, specialistId?: string): Promise<{ definitions: any[], jsonSchema: string }> {
    // 先获取完整的工具信息
    const fullTools = await this.getTools(caller, specialistId);
    
    // 过滤掉与输入schema无关的字段
    const cleanDefinitions = fullTools.definitions.map(def => {
      const { 
        interactionType, 
        riskLevel, 
        requiresConfirmation, 
        accessibleBy, 
        layer, 
        category, 
        ...cleanDef 
      } = def;
      
      return cleanDef;
    });
    
    this.logger.debug(`🧹 Cleaned ${cleanDefinitions.length} tool definitions for prompt (removed 6 fields per tool)`);
    
    return {
      definitions: cleanDefinitions,
      jsonSchema: JSON.stringify(cleanDefinitions, null, 2)
    };
  }

  /**
   * 验证工具访问权限
   */
  public validateAccess(caller: CallerType, toolName: string): boolean {
    return this.accessController.validateAccess(caller, toolName);
  }

  /**
   * 获取访问控制统计
   */
  public getAccessStats(caller: CallerType) {
    return this.accessController.getAccessStats(caller);
  }

  /**
   * 生成访问控制报告
   */
  public generateAccessReport(caller: CallerType): string {
    return this.accessController.generateAccessReport(caller);
  }

  /**
   * 🔧 工具缓存失效机制 - 清空所有调用者的缓存
   */
  public invalidateToolCache(): void {
    const cacheSize = this.toolsCache.size;
    this.toolsCache.clear();
    this.loggedCacheUsage.clear(); // 🚀 清理日志记录状态
    this.logger.info(`🔄 Tool cache invalidated (${cacheSize} entries cleared) - tools will be reloaded on next access`);
  }
} 