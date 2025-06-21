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
   * 🚀 生成统一的AI执行计划（v3.0版本：支持智能分诊、对话式执行和状态管理）
   * 
   * Code Review优化：支持分离的上下文参数
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
    historyContext?: string, // 🚀 Code Review修复：接受字符串历史上下文
    toolResultsContext?: string // 🚀 Code Review修复：接受字符串工具结果上下文
  ): Promise<AIPlan> {
    try {
      const prompt = await buildAdaptiveToolPlanningPrompt(
        userInput,
        sessionContext,
        historyContext || '', // 传递字符串而不是数组
        toolResultsContext || '' // 传递工具结果上下文
      );

      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      const response = await selectedModel.sendRequest(messages, { justification: 'Generate unified AI plan' });

      let resultText = '';
      for await (const fragment of response.text) { resultText += fragment; }

      // 使用一个更健壮的解析器来处理AI的响应
      return this.parseAIPlanFromResponse(resultText);

    } catch (error) {
      this.logger.error('Failed to generate unified plan', error as Error);
      // 在失败时，返回一个安全的、无害的默认规划
      return {
        thought: 'Error during planning, defaulting to safe response.',
        response_mode: AIResponseMode.GENERAL_CHAT,
        direct_response: '抱歉，我在思考时遇到了一些问题。能请您换一种方式提问吗？',
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
        response_mode: AIResponseMode.GENERAL_CHAT,
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