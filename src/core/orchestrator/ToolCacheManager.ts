import { Logger } from '../../utils/logger';
import { getAvailableTools } from '../toolExecutor';
import { toolRegistry } from '../../tools/index';
import { CallerType } from '../../types/index';
import { ToolAccessController } from './ToolAccessController';

/**
 * 工具缓存管理器 - 负责工具定义的缓存和更新 + 访问控制
 */
export class ToolCacheManager {
  private logger = Logger.getInstance();
  private accessController = new ToolAccessController();
  
  // 🚀 更新：支持基于调用者的缓存
  private toolsCache: Map<CallerType, { definitions: any[], jsonSchema: string }> = new Map();

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

  // 🚀 新增：跟踪已记录的缓存使用情况，避免重复日志
  private loggedCacheUsage: Set<CallerType> = new Set();

  /**
   * 🚀 获取指定调用者可访问的工具（带缓存）
   */
  public async getTools(caller: CallerType): Promise<{ definitions: any[], jsonSchema: string }> {
    // 如果缓存有效，直接返回
    if (this.toolsCache.has(caller)) {
      const cached = this.toolsCache.get(caller)!;
      // 🚀 修复：只在第一次使用缓存时记录日志，避免重复打印
      if (!this.loggedCacheUsage.has(caller)) {
        this.logger.info(`✅ Using cached tools for ${caller} (${cached.definitions.length} tools)`);
        this.loggedCacheUsage.add(caller);
      }
      return cached;
    }

    // 如果没有缓存，则基于访问控制加载并创建缓存
    this.logger.info(`🛠️ Loading and caching tools for ${caller}...`);
    
    const filteredDefinitions = this.accessController.getAvailableTools(caller);
    const jsonSchema = JSON.stringify(filteredDefinitions, null, 2);

    const result = { definitions: filteredDefinitions, jsonSchema };
    this.toolsCache.set(caller, result);

    this.logger.info(`✅ Cached ${filteredDefinitions.length} tools for ${caller}`);
    return result;
  }

  /**
   * 🚀 向后兼容：获取所有工具（无访问控制）
   */
  public async getAllTools(): Promise<{ definitions: any[], jsonSchema: string }> {
    // 使用 ORCHESTRATOR_TOOL_EXECUTION 作为默认，它有最高权限
    return await this.getTools(CallerType.ORCHESTRATOR_TOOL_EXECUTION);
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