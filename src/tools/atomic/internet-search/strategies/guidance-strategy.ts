/**
 * Guidance Strategy
 *
 * Fallback strategy that ALWAYS returns success with helpful setup instructions.
 * This implements the "elegant degradation, never fail" UX principle.
 *
 * Key Design Points:
 * - isAvailable() ALWAYS returns true (ensures there's always a working strategy)
 * - execute() returns success=true (not an error!)
 * - Provides actionable setup guidance in Chinese
 * - Includes manual search link as temporary solution
 * - NO vscode.window popups - results go directly to chat
 */

import { SearchStrategy, SearchRequest, SearchResult, StrategyStatus } from '../types';
import { Logger } from '../../../../utils/logger';

export class GuidanceStrategy implements SearchStrategy {
  readonly name = '设置指导';
  readonly priority = 999; // Lowest priority (last resort)

  private logger = Logger.getInstance();

  /**
   * ALWAYS available - this is our safety net
   */
  async isAvailable(): Promise<boolean> {
    return true; // ✅ Always return true
  }

  /**
   * Generate helpful setup guidance instead of failing
   */
  async execute(request: SearchRequest): Promise<SearchResult> {
    this.logger.info(`🎯 GuidanceStrategy: Providing setup guidance for query: "${request.query}"`);

    const guidance = this.generateGuidance(request.query);

    return {
      success: true, // ✅ Return success, not failure!
      searchData: guidance,
      metadata: {
        provider: 'guidance',
        strategy: 'fallback',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Generate comprehensive setup guidance in Chinese
   */
  private generateGuidance(query: string): string {
    const encodedQuery = encodeURIComponent(query);

    return `# 网络搜索暂未配置

您的查询: **"${query}"**

## 快速设置选项

### 选项 A: MCP 搜索服务器 (推荐,最灵活)

MCP (Model Context Protocol) 是 VS Code 官方支持的工具集成协议。配置后,搜索功能将自动可用。

**设置步骤**:
1. 在项目根目录创建 \`.vscode/mcp.json\` 文件
2. 添加以下配置 (以 Tavily MCP 为例):

\`\`\`json
{
  "mcpServers": {
    "tavily": {
      "command": "npx",
      "args": ["-y", "@tavily/mcp-server"],
      "env": {
        "TAVILY_API_KEY": "\${env:TAVILY_API_KEY}"
      }
    }
  }
}
\`\`\`

3. 设置环境变量 \`TAVILY_API_KEY\` (在 https://tavily.com 获取免费API密钥)
4. 重启 VS Code

### 选项 B: 直接 API 配置 (简单快速)

如果不想使用 MCP,可以直接配置搜索 API。

**设置步骤**:
1. 打开 VS Code 设置 (⌘+, 或 Ctrl+,)
2. 搜索 "SRS Writer Internet Search"
3. 选择以下任一选项:
   - **Tavily API Key** (国际用户推荐,有免费配额)
     获取: https://tavily.com
   - **百度 API Key + Secret Key** (中国大陆用户推荐)
     获取: https://ai.baidu.com/ai-doc/SEARCH/
   - **Bing Search API Key** (需要 Azure 账号)
     获取: https://azure.microsoft.com/services/cognitive-services/bing-web-search-api/

4. 配置完成后立即可用,无需重启

## 临时解决方案

在配置搜索功能之前,您可以先手动搜索:
- [Google 搜索](https://www.google.com/search?q=${encodedQuery})
- [百度搜索](https://www.baidu.com/s?wd=${encodedQuery})

## 需要帮助?

- 查看详细文档: [Internet Search 配置指南](https://github.com/your-repo/wiki/internet-search-setup)
- 运行诊断命令: 打开命令面板 (⌘+Shift+P),搜索 "SRS Writer: 检查网络搜索设置"

---

**提示**: 配置是可选的,您可以稍后再设置。当您准备好时,只需按照上述步骤操作即可。`;
  }

  /**
   * Status is always "available but needs setup"
   */
  async getStatus(): Promise<StrategyStatus> {
    return {
      available: true,
      message: '设置指导始终可用 (兜底策略)',
      requiresSetup: false // Guidance itself doesn't need setup
    };
  }
}
