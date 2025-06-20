import { StrategyOutput, RuleContext, SessionContext } from '../types/session';
import { Logger } from '../utils/logger';

/**
 * 策略基类
 * 为确定性的代码逻辑提供共同接口
 */
export abstract class BaseStrategy {
    protected logger = Logger.getInstance();

    /**
     * 策略的主要执行方法
     * @param input 用户输入或UI事件数据
     * @param session 当前会话状态
     * @returns StrategyOutput 包含给规则的上下文和要调用的规则名称
     */
    public abstract execute(input: any, session: SessionContext): Promise<StrategyOutput>;

    /**
     * 验证输入的有效性
     */
    protected abstract validateInput(input: any): boolean;

    /**
     * 准备给规则层的上下文数据
     */
    protected abstract prepareContext(input: any, session: SessionContext): any;

    /**
     * 通用的错误处理
     */
    protected handleError(error: Error, context: string): never {
        this.logger.error(`Strategy error in ${context}`, error);
        throw new Error(`Strategy execution failed: ${error.message}`);
    }
}
