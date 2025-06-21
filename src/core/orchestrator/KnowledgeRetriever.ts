import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { InputAnalyzer } from '../../utils/inputAnalyzer';

/**
 * 知识检索器 - 负责RAG知识检索和意图分析
 */
export class KnowledgeRetriever {
  private logger = Logger.getInstance();

  /**
   * 🚀 RAG知识检索：基于用户输入和上下文检索相关知识（增强版：集成预处理分析）
   */
  public async retrieveRelevantKnowledge(userInput: string, sessionContext: SessionContext): Promise<string | null> {
    try {
      // 🚀 零成本预处理：在调用昂贵的LLM之前进行本地分析
      const preAnalysis = InputAnalyzer.analyzeInput(userInput);
      
      // 识别用户输入的关键词和意图
      const keywords = this.extractKeywords(userInput);
      const intent = this.identifyIntent(userInput);
      
      // 构建知识检索结果（增强版：使用预处理分析）
      const knowledgeFragments: string[] = [];
      
      // 🚀 预处理分析摘要
      const analysisSummary = InputAnalyzer.generateAnalysisSummary(preAnalysis);
      knowledgeFragments.push(analysisSummary);
      
      // 1. 基于领域的最佳实践（来自预处理分析）
      if (preAnalysis.domain.domain !== 'general') {
        knowledgeFragments.push(`
📋 **${preAnalysis.domain.domain}领域最佳实践**：
- 项目类型：${preAnalysis.projectType.type}
- 匹配关键词：${preAnalysis.domain.matchedKeywords.join(', ')}
- 建议参考行业标准的${preAnalysis.domain.domain}系统设计模式`);
      }
      
      // 2. 基于意图的最佳实践
      if (intent === 'create_requirement') {
        knowledgeFragments.push(`
📝 **需求创建最佳实践**：
- 每个需求应具有唯一标识符和清晰描述
- 需求应包含验收标准和优先级
- 建议先检查现有需求，避免重复创建
- 功能需求应关联到具体的用户故事`);
      } else if (intent === 'edit_requirement') {
        knowledgeFragments.push(`
✏️ **需求编辑最佳实践**：
- 编辑前应先获取当前需求详情
- 重大修改应记录变更历史
- 确保修改后的需求与其他需求保持一致性
- 修改后应验证需求的完整性`);
      } else if (intent === 'manage_project') {
        knowledgeFragments.push(`
🏗️ **项目管理最佳实践**：
- 项目初始化应包含基本的目录结构
- 重要文件应使用模板确保一致性
- 定期备份重要的项目文件
- 保持项目文档的更新和同步`);
      }
      
      // 2. 基于关键词的技术知识
      if (keywords.some(k => ['用户', '登录', '认证', '授权'].includes(k))) {
        knowledgeFragments.push(`
🔐 **用户认证相关知识**：
- 用户认证通常包括用户名/密码、多因素认证
- 需要考虑密码安全策略和会话管理
- 应定义用户权限和角色管理机制`);
      }
      
      // 3. 当前项目上下文相关知识
      if (sessionContext.projectName) {
        knowledgeFragments.push(`
📊 **当前项目上下文**：
- 项目：${sessionContext.projectName}
- 活跃文件：${sessionContext.activeFiles?.length || 0}个
- 建议在操作前先了解项目当前状态`);
      }
      
      return knowledgeFragments.length > 0 ? knowledgeFragments.join('\n\n') : null;
      
    } catch (error) {
      this.logger.warn(`Failed to retrieve relevant knowledge: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 从用户输入中提取关键词
   */
  private extractKeywords(userInput: string): string[] {
    const keywords = userInput.toLowerCase()
      .split(/[\s,，。！？;；：]+/)
      .filter(word => word.length > 1);
    return keywords;
  }

  /**
   * 识别用户意图
   */
  private identifyIntent(userInput: string): string {
    const input = userInput.toLowerCase();
    
    if (input.includes('创建') || input.includes('新增') || input.includes('添加')) {
      return 'create_requirement';
    } else if (input.includes('编辑') || input.includes('修改') || input.includes('更新')) {
      return 'edit_requirement';
    } else if (input.includes('项目') || input.includes('初始化') || input.includes('创建项目')) {
      return 'manage_project';
    } else if (input.includes('查看') || input.includes('显示') || input.includes('列出')) {
      return 'view_information';
    } else if (input.includes('删除') || input.includes('移除')) {
      return 'delete_item';
    }
    
    return 'general_query';
  }
} 