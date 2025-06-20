import { BaseStrategy } from './base-strategy';
import { StrategyOutput, SessionContext } from '../types/session';

/**
 * 创建SRS策略
 * 处理创建新项目的确定性逻辑
 */
export class CreateSrsStrategy extends BaseStrategy {
    
    /**
     * 执行创建SRS的策略
     */
    public async execute(input: string, session: SessionContext): Promise<StrategyOutput> {
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for SRS creation');
            }

            const context = this.prepareContext(input, session);
            
            this.logger.info('CreateSrsStrategy: Preparing to create new SRS project');
            
            return {
                contextForRule: context,
                ruleToInvoke: '100_create_srs',
                skipAI: false
            };
            
        } catch (error) {
            this.handleError(error as Error, 'CreateSrsStrategy.execute');
        }
    }

    /**
     * 验证创建SRS的输入
     */
    protected validateInput(input: string): boolean {
        // 基本验证：确保输入不为空且有实际内容
        if (!input || typeof input !== 'string') {
            return false;
        }
        
        const trimmedInput = input.trim();
        if (trimmedInput.length < 5) {
            this.logger.warn('Input too short for SRS creation');
            return false;
        }
        
        return true;
    }

    /**
     * 为创建规则准备上下文
     */
    protected prepareContext(input: string, session: SessionContext): any {
        // 提取项目名称的智能逻辑
        const projectName = this.extractProjectName(input);
        
        // 分析输入的领域和类型
        const domain = this.detectDomain(input);
        const projectType = this.detectProjectType(input);
        
        return {
            userInput: input,
            suggestedProjectName: projectName,
            detectedDomain: domain,
            detectedProjectType: projectType,
            creationTimestamp: new Date().toISOString(),
            strategy: 'create',
            sessionId: session.metadata?.created || 'unknown'
        };
    }

    /**
     * 从用户输入中智能提取项目名称
     */
    private extractProjectName(input: string): string {
        const input_lower = input.toLowerCase();
        
        // 常见的项目类型模式
        const patterns = [
            /(?:做|开发|创建|建立|设计).*?([\u4e00-\u9fa5a-zA-Z0-9]+(?:系统|平台|应用|工具|管理|网站|app|system|platform|tool|management))/i,
            /([\u4e00-\u9fa5a-zA-Z0-9]+)(?:系统|平台|应用|工具|管理|网站|app|system|platform)/i,
            /(?:for|about|关于)\s+([\u4e00-\u9fa5a-zA-Z0-9\s]+)/i
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match[1]) {
                let projectName = match[1].trim()
                    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
                    .replace(/\s+/g, '-')
                    .toLowerCase();
                
                if (projectName.length > 2) {
                    return `srs-${projectName}`;
                }
            }
        }
        
        // 如果无法提取，生成基于时间的默认名称
        const timestamp = Date.now().toString(36);
        return `srs-project-${timestamp}`;
    }

    /**
     * 检测项目领域
     */
    private detectDomain(input: string): string {
        const domainKeywords = {
            'ecommerce': ['电商', '购物', '商城', 'ecommerce', 'shopping', 'store', '订单'],
            'healthcare': ['医疗', '健康', '医院', 'healthcare', 'medical', 'hospital', '病人'],
            'education': ['教育', '学习', '课程', 'education', 'learning', 'course', '学生'],
            'finance': ['金融', '银行', '支付', 'finance', 'banking', 'payment', '财务'],
            'management': ['管理', '办公', 'management', 'admin', 'office', '员工'],
            'entertainment': ['娱乐', '游戏', '媒体', 'entertainment', 'game', 'media', '视频'],
            'iot': ['物联网', '智能', 'iot', 'smart', 'sensor', '设备'],
            'social': ['社交', '聊天', 'social', 'chat', 'community', '用户']
        };

        const input_lower = input.toLowerCase();
        
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(keyword => input_lower.includes(keyword))) {
                return domain;
            }
        }
        
        return 'general';
    }

    /**
     * 检测项目类型
     */
    private detectProjectType(input: string): string {
        const typeKeywords = {
            'web_app': ['网站', '网页', 'web', 'website', 'portal', '门户'],
            'mobile_app': ['手机', '移动', 'mobile', 'app', 'android', 'ios', '应用'],
            'desktop_app': ['桌面', 'desktop', '客户端', 'client', '软件'],
            'api_service': ['api', '接口', 'service', '服务', 'backend', '后端'],
            'system': ['系统', 'system', '平台', 'platform'],
            'tool': ['工具', 'tool', 'utility', '插件', 'plugin']
        };

        const input_lower = input.toLowerCase();
        
        for (const [type, keywords] of Object.entries(typeKeywords)) {
            if (keywords.some(keyword => input_lower.includes(keyword))) {
                return type;
            }
        }
        
        return 'web_app'; // 默认为web应用
    }
}
