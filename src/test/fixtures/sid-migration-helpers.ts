/**
 * SID迁移辅助函数
 * 帮助将旧的path数组转换为新的SID格式
 */

/**
 * 将旧的path数组转换为SID
 */
export function pathToSid(path: string[]): string {
    if (!path || path.length === 0) {
        return '/root';
    }
    
    // 将章节名称标准化为SID格式
    const normalizedPath = path.map(segment => {
        // 移除数字前缀（如 "1. 引言" -> "引言"）
        let normalized = segment.replace(/^\d+\.\s*/, '');
        
        // 移除特殊标记（如 "**US-INFO-001**" -> "us-info-001"）
        normalized = normalized.replace(/\*\*/g, '').toLowerCase();
        
        // 将中文和空格转换为连字符
        normalized = normalized
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
            
        return normalized;
    });
    
    return '/' + normalizedPath.join('/');
}

/**
 * 常见的SID映射表
 */
export const commonSidMapping: Record<string, string> = {
    // 功能需求相关
    '功能需求': '/functional-requirements',
    '用户管理': '/functional-requirements/user-management', 
    '数据管理': '/functional-requirements/data-management',
    
    // 引言相关
    '引言': '/introduction',
    '概述': '/overview',
    '系统概述': '/system-overview',
    
    // 非功能需求
    '非功能需求': '/non-functional-requirements',
    '性能需求': '/non-functional-requirements/performance',
    
    // 用户故事
    '用户故事': '/user-stories',
    
    // 数据相关
    '数据需求': '/data-requirements',
    
    // 附录
    '附录': '/appendix',
    '假设、依赖和约束': '/assumptions-dependencies-constraints',
    
    // 特殊格式
    '**US-INFO-001**': '/user-stories/us-info-001',
    '**UC-INFO-001**': '/use-cases/uc-info-001',
    '**US-ALERT-001**': '/user-stories/us-alert-001',
    '**UC-ALERT-001**': '/use-cases/uc-alert-001',
    
    // 技术相关
    '技术规范': '/technical-specifications',
    '相关页面及规则说明': '/related-pages-and-rules',
    '非长险规则配置': '/non-long-term-insurance-rules',
    '5 相关页面及规则说明': '/related-pages-and-rules',
    '5.4 非长险规则配置': '/related-pages-and-rules/non-long-term-insurance-rules'
};

/**
 * 智能SID转换
 * 优先使用映射表，否则使用路径转换
 */
export function smartPathToSid(path: string[]): string {
    if (!path || path.length === 0) {
        return '/root';
    }
    
    // 尝试完整路径匹配
    const fullPath = path.join(' / ');
    if (commonSidMapping[fullPath]) {
        return commonSidMapping[fullPath];
    }
    
    // 尝试最后一个段落匹配
    const lastSegment = path[path.length - 1];
    if (commonSidMapping[lastSegment]) {
        return commonSidMapping[lastSegment];
    }
    
    // 尝试第一个段落匹配（处理嵌套情况）
    const firstSegment = path[0];
    if (commonSidMapping[firstSegment] && path.length > 1) {
        const baseSid = commonSidMapping[firstSegment];
        const subPath = path.slice(1).map(segment => 
            segment.replace(/^\d+\.\s*/, '')
                   .replace(/\*\*/g, '')
                   .toLowerCase()
                   .replace(/\s+/g, '-')
                   .replace(/[^\w\-]/g, '')
        ).join('/');
        return `${baseSid}/${subPath}`;
    }
    
    // 回退到路径转换
    return pathToSid(path);
}
