/**
 * 思考记录管理器 - 专门处理recordThought工具的结果存储和格式化
 * 
 * 核心职责：
 * 1. 按specialist分组存储思考记录
 * 2. 提供格式化输出用于注入提示词第0章
 * 3. 管理思考记录的生命周期（specialist开始时清空）
 * 
 * 🚀 v2.0 (2025-10-08): 改为单例模式
 * - 原因：每次specialist恢复执行时会创建新的SpecialistExecutor实例
 * - 如果ThoughtRecordManager是实例变量，思考记录会丢失
 * - 改为单例确保思考记录在多次恢复中保持（符合"持续累积"的设计意图）
 */

import { Logger } from '../../utils/logger';
import { ThoughtRecord, ThinkingType } from './recordThoughtTools';

export class ThoughtRecordManager {
    private static instance: ThoughtRecordManager;  // 🚀 单例实例
    private logger: Logger;
    private thoughtsBySpecialist: Map<string, ThoughtRecord[]> = new Map();
    
    /**
     * 私有构造函数 - 防止外部直接new
     */
    private constructor() {
        this.logger = Logger.getInstance();
    }
    
    /**
     * 🚀 获取单例实例
     */
    public static getInstance(): ThoughtRecordManager {
        if (!ThoughtRecordManager.instance) {
            ThoughtRecordManager.instance = new ThoughtRecordManager();
        }
        return ThoughtRecordManager.instance;
    }
    
    /**
     * 记录思考内容 - 按specialist分组存储
     */
    recordThought(specialistId: string, thoughtRecord: ThoughtRecord): void {
        if (!this.thoughtsBySpecialist.has(specialistId)) {
            this.thoughtsBySpecialist.set(specialistId, []);
        }
        
        const thoughts = this.thoughtsBySpecialist.get(specialistId)!;
        thoughts.unshift(thoughtRecord); // 时间降序：最新的在前面
        
        // 限制数量，避免内存膨胀
        if (thoughts.length > 10) {
            thoughts.splice(10);
        }
        
        this.logger.info(`💭 [ThoughtRecordManager] 记录specialist ${specialistId}的思考: ${thoughtRecord.thinkingType}`);
    }
    
    /**
     * 获取specialist的格式化思考记录 - 用于注入提示词
     */
    getFormattedThoughts(specialistId: string): string {
        const thoughts = this.thoughtsBySpecialist.get(specialistId) || [];
        if (thoughts.length === 0) {
            return '';
        }
        
        return `💭 **Work Memory**: You have ${thoughts.length} previous thought record${thoughts.length > 1 ? 's' : ''} from your earlier iterations. Review them to maintain thinking continuity.

${thoughts.map((thought, index) => {
            const typeEmoji = this.getThinkingTypeEmoji(thought.thinkingType);
            const relativeTime = this.getRelativeTime(thought.timestamp);
            const isRecentThought = index < 3; // 最新的3轮思考记录
            
            return `
## ${typeEmoji} Thought in Iteration ${thoughts.length - index}: ${thought.thinkingType.toUpperCase()}

📍 **Context**: ${thought.context || 'No specific context provided'}
🔍 **Analysis**: ${this.formatThoughtContent(thought.content, isRecentThought)}
🎯 **Planned Actions**: ${thought.nextSteps && thought.nextSteps.length > 0 ? thought.nextSteps.join(' → ') : 'No specific next steps defined'}
⏰ **Recorded**: ${relativeTime}
🆔 **ID**: \`${thought.thoughtId}\`
`;
        }).join('\n---\n')}

⚠️ **CRITICAL GUIDANCE**: 
- 🔄 **Continue** your work based on the above thoughts
- 🚫 **Avoid** repeating analysis you've already completed
- 🎯 **Focus** on the next actions from your most recent thinking
- 💡 **Build upon** your previous insights rather than starting over

---

`;
    }
    
    /**
     * 清空specialist的思考记录 - 专家执行开始时调用
     */
    clearThoughts(specialistId: string): void {
        this.thoughtsBySpecialist.delete(specialistId);
        this.logger.info(`🧹 [ThoughtRecordManager] 清空specialist ${specialistId}的思考记录`);
    }
    
    /**
     * 获取specialist的思考记录数量 - 用于调试和监控
     */
    getThoughtCount(specialistId: string): number {
        return this.thoughtsBySpecialist.get(specialistId)?.length || 0;
    }
    
    /**
     * 获取所有specialist的思考记录统计 - 用于调试
     */
    getAllThoughtStats(): { [specialistId: string]: number } {
        const stats: { [specialistId: string]: number } = {};
        for (const [specialistId, thoughts] of this.thoughtsBySpecialist.entries()) {
            stats[specialistId] = thoughts.length;
        }
        return stats;
    }
    
    /**
     * 格式化思考内容为可读文本 - 基于recordThought工具schema
     * @param content 思考内容
     * @param isRecentThought 是否为最新的3轮思考记录（决定是否截断）
     */
    private formatThoughtContent(content: any, isRecentThought: boolean = false): string {
        if (typeof content === 'string') {
            return content;
        }
        
        if (typeof content === 'object' && content !== null) {
            // 🚀 增强格式化：为常见的思考内容字段添加emoji和结构
            const formattedEntries = Object.entries(content).map(([key, value]) => {
                const formattedKey = this.formatContentKey(key);
                const formattedValue = this.formatContentValue(value, isRecentThought);
                return `${formattedKey}: ${formattedValue}`;
            });
            
            // 🚀 关键修复：最新3轮思考记录完整显示，3轮以后可以截断
            if (isRecentThought) {
                return formattedEntries.join('\n  • ');
            } else {
                return formattedEntries.length > 3 
                    ? formattedEntries.slice(0, 3).join('\n  • ') + `\n  • ... (${formattedEntries.length - 3} more items)`
                    : formattedEntries.join('\n  • ');
            }
        }
        
        return JSON.stringify(content);
    }
    
    /**
     * 获取思考类型对应的emoji
     */
    private getThinkingTypeEmoji(thinkingType: ThinkingType): string {
        const emojiMap = {
            'planning': '📋',      // 规划
            'analysis': '🔍',      // 分析
            'synthesis': '🔗',     // 综合
            'reflection': '🤔',    // 反思
            'derivation': '➡️'     // 推导
        };
        return emojiMap[thinkingType] || '🧠';
    }
    
    /**
     * 获取相对时间描述
     */
    private getRelativeTime(timestamp: string): string {
        const now = new Date();
        const recordTime = new Date(timestamp);
        const diffMs = now.getTime() - recordTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        return recordTime.toLocaleString();
    }
    
    /**
     * 格式化内容键名 - 添加语义化表示
     */
    private formatContentKey(key: string): string {
        // 常见思考内容字段的emoji映射
        const keyEmojiMap: { [key: string]: string } = {
            'problem': '❓ Problem',
            'solution': '💡 Solution', 
            'approach': '🛤️ Approach',
            'strategy': '📈 Strategy',
            'requirements': '📝 Requirements',
            'constraints': '🚧 Constraints',
            'assumptions': '💭 Assumptions',
            'risks': '⚠️ Risks',
            'benefits': '✅ Benefits',
            'alternatives': '🔄 Alternatives',
            'dependencies': '🔗 Dependencies',
            'timeline': '⏱️ Timeline',
            'resources': '🛠️ Resources'
        };
        
        const lowerKey = key.toLowerCase();
        if (keyEmojiMap[lowerKey]) {
            return keyEmojiMap[lowerKey];
        }
        
        // 默认格式化：驼峰转换为可读格式
        const readable = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        return `📌 ${readable.charAt(0).toUpperCase() + readable.slice(1)}`;
    }
    
    /**
     * 格式化内容值
     * @param value 要格式化的值
     * @param isRecentThought 是否为最新的3轮思考记录（决定是否截断长文本）
     */
    private formatContentValue(value: any, isRecentThought: boolean = false): string {
        if (typeof value === 'string') {
            // 🚀 关键修复：最新3轮思考记录不截断，保持完整内容
            if (isRecentThought) {
                return value;
            } else {
                return value.length > 100 ? `${value.substring(0, 100)}...` : value;
            }
        }
        
        if (Array.isArray(value)) {
            // 🚀 数组内容也根据是否为最新思考决定是否截断
            if (isRecentThought) {
                return value.length > 0 ? value.join(', ') : 'None specified';
            } else {
                // 非最新思考，数组超过5个元素时截断
                if (value.length > 5) {
                    return value.slice(0, 5).join(', ') + `, ... (${value.length - 5} more items)`;
                }
                return value.length > 0 ? value.join(', ') : 'None specified';
            }
        }
        
        if (typeof value === 'object' && value !== null) {
            const keys = Object.keys(value);
            return keys.length > 0 ? `{${keys.join(', ')}}` : 'Empty object';
        }
        
        return String(value);
    }
}
