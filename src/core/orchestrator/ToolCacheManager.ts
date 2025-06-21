import { Logger } from '../../utils/logger';
import { getAvailableTools } from '../toolExecutor';
import { toolRegistry } from '../../tools/index';

/**
 * 工具缓存管理器 - 负责工具定义的缓存和更新
 */
export class ToolCacheManager {
  private logger = Logger.getInstance();
  
  // 🚀 新增：缓存工具清单和其JSON字符串形式
  private availableToolsCache: any[] | null = null;
  private toolsJsonSchemaCache: string | null = null;

  constructor() {
    // 🔧 新增：注册工具缓存失效监听器
    toolRegistry.onCacheInvalidation(() => {
      this.invalidateToolCache();
    });
  }

  /**
   * 🚀 新增：一个按需加载并缓存工具的方法
   */
  public async getTools(): Promise<{ definitions: any[], jsonSchema: string }> {
    // 如果缓存有效，直接返回
    if (this.availableToolsCache && this.toolsJsonSchemaCache) {
      // 这行日志将证明缓存正在工作
      this.logger.info('✅ Using cached tool definitions.');
      return {
        definitions: this.availableToolsCache,
        jsonSchema: this.toolsJsonSchemaCache
      };
    }

    // 如果没有缓存，则加载并创建缓存
    this.logger.info('🛠️ Loading and caching tool definitions for the first time...');
    const definitions = getAvailableTools();
    const jsonSchema = JSON.stringify(definitions, null, 2);

    this.availableToolsCache = definitions;
    this.toolsJsonSchemaCache = jsonSchema;

    return { definitions, jsonSchema };
  }

  /**
   * 🔧 工具缓存失效机制 - 解决工具更新不被感知的问题
   */
  public invalidateToolCache(): void {
    this.availableToolsCache = null;
    this.toolsJsonSchemaCache = null;
    this.logger.info('🔄 Tool cache invalidated - tools will be reloaded on next access');
  }
} 