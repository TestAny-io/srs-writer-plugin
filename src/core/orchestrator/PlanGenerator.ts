import * as vscode from 'vscode';
import { jsonrepair } from 'jsonrepair';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { AIResponseMode, AIPlan } from '../../types/index';

/**
 * AI计划生成器 - 负责智能分诊和计划生成
 */
export class PlanGenerator {
  private logger = Logger.getInstance();

  /**
   * 🚀 生成统一的AI执行计划（v4.0版本：支持结构化prompt和智能分诊）
   * 
   * 重构说明：使用结构化prompt，明确分离系统指令和用户输入
   */
  public async generateUnifiedPlan(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    buildAdaptiveToolPlanningPrompt: (
      userInput: string,
      sessionContext: SessionContext,
      historyContext: string,
      toolResultsContext: string
    ) => Promise<string>,
    historyContext?: string,
    toolResultsContext?: string
  ): Promise<AIPlan> {
    try {
      // 构建结构化提示词 - 系统指令和用户输入已经分离
      const structuredPrompt = await buildAdaptiveToolPlanningPrompt(
        userInput,
        sessionContext,
        historyContext || '',
        toolResultsContext || ''
      );

      // 🚀 重构：使用结构化的User消息，符合VSCode最佳实践
      // 由于VSCode不支持System消息，我们在User消息中明确标识系统指令和用户输入
      const messages = [
        vscode.LanguageModelChatMessage.User(structuredPrompt)
      ];

      // 🐛 DEBUG: 记录消息结构
      this.logger.info(`🔍 [DEBUG] Sending structured message to AI model:`);
      this.logger.info(`🔍 [DEBUG] - Message type: User`);
      this.logger.info(`🔍 [DEBUG] - Message length: ${structuredPrompt.length}`);
      this.logger.info(`🔍 [DEBUG] - Model name: ${selectedModel.name}`);

      // 发送请求到AI模型
      const response = await selectedModel.sendRequest(messages, { 
        justification: 'Generate unified AI plan with structured prompt' 
      });

      let resultText = '';
      for await (const fragment of response.text) { 
        resultText += fragment; 
      }

      // 🐛 DEBUG: 记录AI响应
      this.logger.info(`🔍 [DEBUG] AI response received:`);
      this.logger.info(`🔍 [DEBUG] - Response length: ${resultText.length}`);
      this.logger.info(`🔍 [DEBUG] - Response preview: ${resultText.substring(0, 200)}...`);

      // 解析AI响应
      return this.parseAIPlanFromResponse(resultText);

    } catch (error) {
      this.logger.error('Failed to generate unified plan with structured prompt', error as Error);
      // 在失败时，返回一个安全的、无害的默认规划
      return {
        thought: 'Error during planning with structured prompt, defaulting to safe response.',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '抱歉，我在处理结构化提示时遇到了问题。能请您换一种方式提问吗？',
        tool_calls: []
      };
    }
  }

  /**
   * 🚀 解析AI计划响应（v3.0版本：支持智能分诊格式）
   */
  public parseAIPlanFromResponse(responseText: string): AIPlan {
    this.logger.info(`Raw AI Response:\n---\n${responseText}\n---`);

    try {
      const markdownMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonText = markdownMatch ? markdownMatch[1] : responseText;

      const repairedJsonText = jsonrepair(jsonText);
      const parsed: AIPlan = JSON.parse(repairedJsonText);

      // 基本验证
      if (parsed && parsed.response_mode) {
         this.logger.info(`Successfully parsed AI plan. Mode: ${parsed.response_mode}`);
         return parsed;
      }
      throw new Error("Parsed JSON lacks required 'response_mode' field.");

    } catch (error) {
      this.logger.error('Failed to parse AI plan JSON', error as Error);
      // 返回一个安全的降级规划
      return {
        thought: 'Failed to parse the AI\'s response, defaulting to safe response.',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '抱歉，我生成的响应格式似乎有些问题。能请您再试一次吗？',
        tool_calls: []
      };
    }
  }

  /**
   * 🚀 解析AI返回的工具规划（增强版：支持思维链格式）
   */
  public parseToolPlanFromResponse(response: string): Array<{ name: string; args: any }> {
    this.logger.info(`Raw AI Response:\n---\n${response}\n---`);
    try {
      // 尝试提取JSON对象（新格式，包含thought和tool_calls）
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // 新格式：包含thought和tool_calls
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          this.logger.info(`AI思维链: ${parsed.thought || 'No reasoning provided'}`);
          this.logger.info(`Parsed ${parsed.tool_calls.length} tool calls from AI response`);
          return parsed.tool_calls;
        }
        
        // 兼容性：如果是直接的数组格式
        if (Array.isArray(parsed)) {
          this.logger.info(`Parsed ${parsed.length} tool calls from AI response (legacy format)`);
          return parsed;
        }
      }
      
      // 回退：尝试提取JSON数组（旧格式兼容）
      const arrayMatch = response.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          this.logger.info(`Parsed ${parsed.length} tool calls from AI response (array format)`);
          return parsed;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse tool plan JSON from AI response: ${(error as Error).message}`);
    }

    this.logger.warn('No valid tool plan found in AI response');
    return [];
  }
} 