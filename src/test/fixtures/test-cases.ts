/**
 * 标准测试用例数据
 * 用于性能基准测试和功能验证
 */

export interface TestCase {
    name: string;
    description: string;
    input: string;
    expectedFiles: string[];
    expectedFRCount: number;
    expectedNFRCount: number;
    maxParseTime: number;
    category: 'small' | 'medium' | 'large';
}

export const TestCases: TestCase[] = [
    // 小型项目测试用例
    {
        name: "small_blog_system",
        description: "个人博客系统 - 小型项目",
        input: "开发一个个人博客系统，支持文章发布、评论、用户管理、标签分类、搜索功能",
        expectedFiles: ['SRS.md', 'fr.yaml', 'nfr.yaml', 'glossary.yaml', 'classification_decision.md', 'questions_for_clarification.md', 'writer_log.json'],
        expectedFRCount: 5,
        expectedNFRCount: 3,
        maxParseTime: 200,
        category: 'small'
    },
    
    // 中型项目测试用例
    {
        name: "medium_ecommerce_platform",
        description: "电商平台 - 中型项目",
        input: "构建一个电商平台，包含商品管理、订单处理、支付集成、用户账户、库存管理、推荐系统、评价系统、优惠券管理、数据分析等功能",
        expectedFiles: ['SRS.md', 'fr.yaml', 'nfr.yaml', 'glossary.yaml', 'classification_decision.md', 'questions_for_clarification.md', 'writer_log.json'],
        expectedFRCount: 12,
        expectedNFRCount: 5,
        maxParseTime: 500,
        category: 'medium'
    },
    
    // 大型项目测试用例
    {
        name: "large_erp_system",
        description: "企业ERP系统 - 大型项目",
        input: "开发一个企业级ERP系统，涵盖人力资源管理、财务管理、供应链管理、客户关系管理、项目管理、报表分析、移动端支持、API集成、权限管理、审批流程、数据备份、多租户支持等全面功能",
        expectedFiles: ['SRS.md', 'fr.yaml', 'nfr.yaml', 'glossary.yaml', 'classification_decision.md', 'questions_for_clarification.md', 'writer_log.json'],
        expectedFRCount: 25,
        expectedNFRCount: 8,
        maxParseTime: 1000,
        category: 'large'
    },
    
    // 移动应用测试用例
    {
        name: "mobile_fitness_app",
        description: "健身追踪APP - 移动应用",
        input: "开发一个健身追踪APP，记录运动数据、制定健身计划、营养管理、社交分享、个人成就、健身课程、设备连接、数据同步等功能",
        expectedFiles: ['SRS.md', 'fr.yaml', 'nfr.yaml', 'glossary.yaml', 'classification_decision.md', 'questions_for_clarification.md', 'writer_log.json'],
        expectedFRCount: 10,
        expectedNFRCount: 6,
        maxParseTime: 300,
        category: 'medium'
    }
];

/**
 * 错误处理测试用例
 */
export const ErrorTestCases = [
    {
        name: "empty_input",
        description: "空输入测试",
        input: "",
        expectedBehavior: "应返回友好的错误提示"
    },
    {
        name: "very_short_input",
        description: "输入过短测试",
        input: "做个app",
        expectedBehavior: "应提示需要更详细的描述"
    },
    {
        name: "very_long_input",
        description: "输入过长测试",
        input: "a".repeat(3000),
        expectedBehavior: "应提示输入过长"
    }
];

/**
 * 性能基准要求
 */
export const PerformanceBenchmarks = {
    smallProject: 200,     // <20需求: <200ms
    mediumProject: 500,    // 20-50需求: <500ms
    largeProject: 1000,    // >50需求: <1000ms
    maxAcceptable: 2000,   // 绝对上限: 2000ms
    memoryLimit: 100,      // 内存使用上限: 100MB
    concurrentRequests: 3  // 并发请求数量
};

/**
 * 文件验证规则接口
 */
export interface FileValidationRule {
    requiredSections?: string[];
    minLength?: number;
    format: string;
    requiredFields?: string[];
    requiredSubFields?: string[];
}

/**
 * 预期的文件格式验证规则
 */
export const FileValidationRules: Record<string, FileValidationRule> = {
    'SRS.md': {
        requiredSections: ['引言', '整体说明', '功能需求', '非功能性需求'],
        minLength: 500,
        format: 'markdown'
    },
    'fr.yaml': {
        requiredFields: ['functional_requirements'],
        requiredSubFields: ['id', 'title', 'description', 'priority'],
        format: 'yaml'
    },
    'nfr.yaml': {
        requiredFields: ['non_functional_requirements'],
        requiredSubFields: ['id', 'title', 'description', 'priority', 'category'],
        format: 'yaml'
    },
    'glossary.yaml': {
        requiredFields: ['glossary'],
        requiredSubFields: ['term', 'definition'],
        format: 'yaml'
    },
    'writer_log.json': {
        requiredFields: ['timestamp', 'parser_version', 'files_generated', 'success'],
        format: 'json'
    }
};
