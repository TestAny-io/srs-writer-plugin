/**
 * 输入分析器 - 零成本的本地NLU预处理器
 * 
 * 架构定位：
 * - 不属于原子层：包含SRS领域知识
 * - 不属于模块层：不是完整的业务行动
 * - 归属：Orchestrator的内部预处理能力
 * 
 * 职责：
 * - 在调用昂贵的LLM之前，对用户输入进行快速的结构化分析
 * - 为AI规划提供更丰富的上下文，提升规划质量
 * - 零API成本，高速执行
 */

/**
 * 项目领域分析结果
 */
export interface DomainAnalysis {
    domain: string;
    confidence: number;
    matchedKeywords: string[];
}

/**
 * 项目类型分析结果
 */
export interface ProjectTypeAnalysis {
    type: string;
    confidence: number;
    matchedKeywords: string[];
}

/**
 * 完整的输入分析结果
 */
export interface InputAnalysisResult {
    projectName: string;
    domain: DomainAnalysis;
    projectType: ProjectTypeAnalysis;
    originalInput: string;
    timestamp: string;
}

/**
 * 输入分析器类
 */
export class InputAnalyzer {
    
    /**
     * 从用户输入中智能提取项目名称
     * 
     * 支持的模式：
     * - "做一个图书管理系统" → "srs-图书管理系统"
     * - "创建电商平台" → "srs-电商平台"
     * - "开发任务管理app" → "srs-任务管理app"
     */
    public static extractProjectName(input: string): string {
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
     * 
     * 支持的领域：
     * - ecommerce: 电商/购物相关
     * - healthcare: 医疗/健康相关
     * - education: 教育/学习相关
     * - finance: 金融/支付相关
     * - management: 管理/办公相关
     * - entertainment: 娱乐/媒体相关
     * - iot: 物联网/智能设备相关
     * - social: 社交/社区相关
     */
    public static detectDomain(input: string): DomainAnalysis {
        const domainKeywords = {
            'ecommerce': ['电商', '购物', '商城', 'ecommerce', 'shopping', 'store', '订单', '商品', '支付'],
            'healthcare': ['医疗', '健康', '医院', 'healthcare', 'medical', 'hospital', '病人', '诊断', '药品'],
            'education': ['教育', '学习', '课程', 'education', 'learning', 'course', '学生', '老师', '考试'],
            'finance': ['金融', '银行', '支付', 'finance', 'banking', 'payment', '财务', '理财', '贷款'],
            'management': ['管理', '办公', 'management', 'admin', 'office', '员工', '人事', '项目'],
            'entertainment': ['娱乐', '游戏', '媒体', 'entertainment', 'game', 'media', '视频', '音乐', '直播'],
            'iot': ['物联网', '智能', 'iot', 'smart', 'sensor', '设备', '传感器', '控制'],
            'social': ['社交', '聊天', 'social', 'chat', 'community', '用户', '朋友', '分享']
        };

        const input_lower = input.toLowerCase();
        let bestMatch = { domain: 'general', confidence: 0, keywords: [] as string[] };
        
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            const matchedKeywords = keywords.filter(keyword => input_lower.includes(keyword));
            const confidence = matchedKeywords.length / keywords.length;
            
            if (matchedKeywords.length > 0 && confidence > bestMatch.confidence) {
                bestMatch = {
                    domain,
                    confidence,
                    keywords: matchedKeywords
                };
            }
        }
        
        return {
            domain: bestMatch.domain,
            confidence: bestMatch.confidence,
            matchedKeywords: bestMatch.keywords
        };
    }

    /**
     * 检测项目类型
     * 
     * 支持的类型：
     * - web_app: 网站/网页应用
     * - mobile_app: 手机/移动应用  
     * - desktop_app: 桌面应用
     * - api_service: API/服务接口
     * - system: 系统/平台
     * - tool: 工具/插件
     */
    public static detectProjectType(input: string): ProjectTypeAnalysis {
        const typeKeywords = {
            'web_app': ['网站', '网页', 'web', 'website', 'portal', '门户', '浏览器'],
            'mobile_app': ['手机', '移动', 'mobile', 'app', 'android', 'ios', '应用', '移动端'],
            'desktop_app': ['桌面', 'desktop', '客户端', 'client', '软件', 'windows', 'mac'],
            'api_service': ['api', '接口', 'service', '服务', 'backend', '后端', '微服务'],
            'system': ['系统', 'system', '平台', 'platform', '框架', 'framework'],
            'tool': ['工具', 'tool', 'utility', '插件', 'plugin', '扩展', 'extension']
        };

        const input_lower = input.toLowerCase();
        let bestMatch = { type: 'web_app', confidence: 0, keywords: [] as string[] };
        
        for (const [type, keywords] of Object.entries(typeKeywords)) {
            const matchedKeywords = keywords.filter(keyword => input_lower.includes(keyword));
            const confidence = matchedKeywords.length / keywords.length;
            
            if (matchedKeywords.length > 0 && confidence > bestMatch.confidence) {
                bestMatch = {
                    type,
                    confidence,
                    keywords: matchedKeywords
                };
            }
        }
        
        return {
            type: bestMatch.type,
            confidence: bestMatch.confidence,
            matchedKeywords: bestMatch.keywords
        };
    }

    /**
     * 完整的输入分析
     * 
     * 一次性执行所有预处理分析，返回结构化结果
     */
    public static analyzeInput(input: string): InputAnalysisResult {
        return {
            projectName: this.extractProjectName(input),
            domain: this.detectDomain(input),
            projectType: this.detectProjectType(input),
            originalInput: input,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 生成分析摘要（用于Orchestrator的Prompt增强）
     */
    public static generateAnalysisSummary(analysis: InputAnalysisResult): string {
        const { projectName, domain, projectType } = analysis;
        
        return `# Pre-Analysis Context
- Suggested Project Name: ${projectName}
- Detected Domain: ${domain.domain} (confidence: ${(domain.confidence * 100).toFixed(1)}%)
- Detected Project Type: ${projectType.type} (confidence: ${(projectType.confidence * 100).toFixed(1)}%)
- Domain Keywords: ${domain.matchedKeywords.join(', ') || 'none'}
- Type Keywords: ${projectType.matchedKeywords.join(', ') || 'none'}`;
    }

    /**
     * 判断输入是否适合创建新项目
     * 
     * 基于关键词和模式，快速判断用户意图是否为"创建"
     */
    public static isCreationIntent(input: string): boolean {
        const creationKeywords = [
            '做', '开发', '创建', '建立', '设计', '构建',
            'create', 'build', 'develop', 'make', 'design',
            '新', '新的', 'new', '想要', '需要'
        ];
        
        const input_lower = input.toLowerCase();
        return creationKeywords.some(keyword => input_lower.includes(keyword));
    }

    /**
     * 判断输入是否适合编辑现有项目
     * 
     * 基于关键词和模式，快速判断用户意图是否为"编辑"
     */
    public static isEditIntent(input: string): boolean {
        const editKeywords = [
            '修改', '编辑', '更新', '改', '调整', '完善',
            'edit', 'modify', 'update', 'change', 'improve',
            '添加', '删除', '优化', 'add', 'remove', 'optimize'
        ];
        
        const input_lower = input.toLowerCase();
        return editKeywords.some(keyword => input_lower.includes(keyword));
    }
} 