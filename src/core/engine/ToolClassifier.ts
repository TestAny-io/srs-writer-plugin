import { Logger } from '../../utils/logger';
import { toolRegistry, ToolDefinition } from '../../tools/index';
import { ExecutionStep } from './AgentState';

/**
 * 工具分类和风险评估系统 - 智能判断与风险评估
 */
export class ToolClassifier {
  private logger = Logger.getInstance();

  /**
   * 智能工具分类 - 基于工具定义和上下文
   */
  public classifyTool(
    toolCall: { name: string; args: any },
    executionHistory: ExecutionStep[]
  ): {
    type: 'autonomous' | 'confirmation' | 'interactive';
    riskLevel: 'low' | 'medium' | 'high';
    requiresConfirmation: boolean;
  } {
    const toolDef = toolRegistry.getToolDefinition(toolCall.name);
    
    // 1. 使用工具定义的属性（如果存在）
    if (toolDef?.interactionType && toolDef?.riskLevel !== undefined) {
        return {
            type: toolDef.interactionType,
            riskLevel: toolDef.riskLevel,
            requiresConfirmation: toolDef.requiresConfirmation || false
        };
    }
    
    // 2. 基于工具名称的智能推断
    const toolName = toolCall.name.toLowerCase();
    
    // 交互工具检测
    if (this.isInteractiveToolByName(toolName) || this.hasInteractiveArgs(toolCall.args)) {
        return {
            type: 'interactive',
            riskLevel: 'low',
            requiresConfirmation: false
        };
    }
    
    // 高风险工具检测
    if (this.isHighRiskTool(toolName, toolCall.args)) {
        return {
            type: 'confirmation',
            riskLevel: 'high',
            requiresConfirmation: true
        };
    }
    
    // 中风险工具检测
    if (this.isMediumRiskTool(toolName, toolCall.args)) {
        return {
            type: 'confirmation',
            riskLevel: 'medium',
            requiresConfirmation: this.shouldRequireConfirmation(toolCall, executionHistory)
        };
    }
    
    // 默认为自主工具
    return {
        type: 'autonomous',
        riskLevel: 'low',
        requiresConfirmation: false
    };
  }

  /**
   * 检测交互式工具
   */
  private isInteractiveToolByName(toolName: string): boolean {
    const interactivePatterns = [
        'ask', 'question', 'input', 'select', 'choose', 'confirm',
        'prompt', 'dialog', 'modal', 'picker'
    ];
    return interactivePatterns.some(pattern => toolName.includes(pattern));
  }

  /**
   * 检测工具参数是否包含交互元素
   */
  private hasInteractiveArgs(args: any): boolean {
    return !!(args.options || args.choices || args.question || args.prompt);
  }

  /**
   * 检测高风险工具
   */
  private isHighRiskTool(toolName: string, args: any): boolean {
    const highRiskPatterns = [
        'delete', 'remove', 'drop', 'truncate', 'destroy',
        'execute', 'run', 'command', 'shell', 'terminal',
        'admin', 'sudo', 'privileged'
    ];
    
    // 基于工具名称
    if (highRiskPatterns.some(pattern => toolName.includes(pattern))) {
        return true;
    }
    
    // 基于参数内容
    if (args.path && (args.path.includes('..') || args.path.startsWith('/'))) {
        return true; // 可能访问系统文件
    }
    
    if (args.command || args.script) {
        return true; // 执行命令
    }
    
    return false;
  }

  /**
   * 检测中风险工具
   */
  private isMediumRiskTool(toolName: string, args: any): boolean {
    const mediumRiskPatterns = [
        'write', 'create', 'modify', 'update', 'edit',
        'move', 'rename', 'copy', 'install'
    ];
    
    return mediumRiskPatterns.some(pattern => toolName.includes(pattern));
  }

  /**
   * 基于上下文决定是否需要确认
   */
  private shouldRequireConfirmation(toolCall: { name: string; args: any }, executionHistory: ExecutionStep[]): boolean {
    // 检查是否在批量操作中
    const recentToolCalls = executionHistory
        .filter(step => step.type === 'tool_call')
        .slice(-3);
    
    const sameTool = recentToolCalls.filter(step => step.toolName === toolCall.name);
    
    // 如果最近频繁调用同一个工具，降低确认频率
    if (sameTool.length >= 2) {
        return false;
    }
    
    // 检查参数规模
    if (toolCall.args.content && toolCall.args.content.length > 5000) {
        return true; // 大量内容写入需要确认
    }
    
    // 检查是否操作重要文件
    if (toolCall.args.path) {
        const importantFiles = ['package.json', 'config', 'settings', '.env'];
        if (importantFiles.some(file => toolCall.args.path.includes(file))) {
            return true;
        }
    }
    
    return false;
  }

  /**
   * 工具分类逻辑 - 核心智能判断
   */
  public isInteractiveTool(tool?: ToolDefinition): boolean {
    if (!tool) return false;
    
    const interactiveTools = [
      'askQuestion', 
      'requestUserInput', 
      'presentOptions',
      'clarifyRequirements'
    ];
    return interactiveTools.includes(tool.name);
  }

  public isConfirmationTool(tool?: ToolDefinition): boolean {
    if (!tool) return false;
    
    const confirmationTools = [
      'createDirectory', 
      'writeFile', 
      'deleteFile',
      'runCommand',
      'installPackage'
    ];
    return confirmationTools.includes(tool.name) && this.assessToolRisk(tool) !== 'low';
  }

  /**
   * 工具风险评估
   */
  public assessToolRisk(tool?: ToolDefinition): 'low' | 'medium' | 'high' {
    if (!tool) return 'medium';
    
    const highRiskTools = ['deleteFile', 'runCommand', 'modifySystemSettings'];
    const mediumRiskTools = ['writeFile', 'createDirectory', 'installPackage'];
    
    if (highRiskTools.includes(tool.name)) return 'high';
    if (mediumRiskTools.includes(tool.name)) return 'medium';
    return 'low';
  }
} 