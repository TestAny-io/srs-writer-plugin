/**
 * 系统内部工具 - 系统控制和管理工具
 * 
 * 架构定位：
 * - 内部控制层：不直接操作外部资源，而是控制系统行为
 * - AI系统交互：为AI提供明确的任务完成、状态控制信号
 * - 流程管理：控制对话流程、任务边界、系统状态
 */

import { CallerType } from '../../types/index';

/**
 * 最终答案结构
 */
export interface FinalAnswer {
    summary: string;
    achievements: string[];
    nextSteps: string[];
    metadata?: {
        taskType?: string;
        executionTime?: number;
        toolsUsed?: number;
    };
}

/**
 * 系统状态信息
 */
export interface SystemStatus {
    mode: string;
    activeProject?: string;
    toolsAvailable: number;
    sessionInfo: {
        created: string;
        lastModified: string;
        version: string;
    };
}

/**
 * 系统内部工具定义
 */
export const systemToolDefinitions = [
    {
        name: 'ragRetrieval',
        description: `Multi-layer RAG (Retrieval-Augmented Generation) orchestrator tool. 
        
This is a fat tool that intelligently coordinates different knowledge sources in order of priority:
1. Enterprise RAG system (if configured) - highest priority
2. Local plugin knowledge base (templates/, knowledge/) - medium priority  
3. Internet search via VSCode Copilot - fallback option

Use this tool when you need relevant knowledge to:
- Make intelligent expert routing decisions
- Generate high-quality SRS content
- Answer domain-specific questions
- Find templates and best practices

The tool automatically determines the best retrieval strategy based on query type and available sources.`,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query for knowledge retrieval'
                },
                domain: {
                    type: 'string',
                    description: 'Business domain context (e.g., "financial_services", "healthcare", "e-commerce")'
                },
                layerPreference: {
                    type: 'string',
                    enum: ['enterprise', 'builtin', 'internet', 'auto'],
                    description: 'Preferred knowledge source layer (default: auto)'
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum total results to return across all sources (default: 10)'
                },
                contextType: {
                    type: 'string',
                    enum: ['routing', 'content_generation', 'qa', 'templates'],
                    description: 'Type of context this knowledge will be used for (default: routing)'
                }
            },
            required: ['query']
        },
        // 🚀 访问控制：所有AI层都可以使用RAG检索
        accessibleBy: [
            CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 执行模式中的知识增强
            CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答的核心工具
            CallerType.SPECIALIST                     // 专家内容生成支持
        ]
    },
    {
        name: 'finalAnswer',
        description: `Provide the final answer and mark task completion. REQUIRED when you have completed all user requests.
        
Key purposes:
- Signal explicit task completion (stops conversation loop)
- Provide comprehensive task summary
- List concrete achievements 
- Suggest logical next steps

Usage: Call this when you have successfully completed the user's request, whether it's creating a project, editing files, running checks, or providing information.`,
        parameters: {
            type: 'object',
            properties: {
                summary: {
                    type: 'string',
                    description: 'Comprehensive summary of what was accomplished'
                },
                achievements: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of concrete achievements/deliverables'
                },
                nextSteps: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Suggested logical next steps for the user'
                },
                taskType: {
                    type: 'string',
                    description: 'Type of task completed (e.g. "project_creation", "file_editing", "status_inquiry")'
                }
            },
            required: ['summary', 'achievements', 'nextSteps']
        },
        // 🚀 访问控制：只有执行任务的AI可以标记完成
        accessibleBy: [
            CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 主要任务完成
            CallerType.SPECIALIST                     // 专家任务完成
        ]
    },
    {
        name: 'reportProgress',
        description: `Report current progress on a multi-step task. Use for long-running operations to keep user informed.`,
        parameters: {
            type: 'object',
            properties: {
                currentStep: {
                    type: 'string',
                    description: 'Description of current step being executed'
                },
                completedSteps: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of steps already completed'
                },
                remainingSteps: {
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'List of steps still to be completed'
                },
                estimatedTimeRemaining: {
                    type: 'string',
                    description: 'Estimated time to completion (optional)'
                }
            },
            required: ['currentStep', 'completedSteps', 'remainingSteps']
        }
    },
    {
        name: 'getSystemStatus',
        description: `Get comprehensive system status including current project, available tools, and session information.`,
        parameters: {
            type: 'object',
            properties: {
                includeToolInventory: {
                    type: 'boolean',
                    description: 'Whether to include detailed tool inventory in response'
                },
                includeSessionDetails: {
                    type: 'boolean', 
                    description: 'Whether to include detailed session information'
                }
            }
        }
    }
];

/**
 * RAG检索结果接口
 */
export interface RAGResult {
    content: string;
    source: string;
    relevanceScore?: number;
    metadata?: {
        filePath?: string;
        url?: string;
        confidence?: number;
        excerpts?: string[];
    };
}

/**
 * RAG检索响应接口
 */
export interface RAGResponse {
    success: boolean;
    results: RAGResult[];
    strategy: string;
    sources: string[];
    error?: string;
    metadata: {
        query: string;
        totalResults: number;
        executionTime: number;
        layersUsed: string[];
    };
}

/**
 * 系统内部工具实现
 */
export const systemToolImplementations = {
    
    /**
     * 多层RAG检索编排工具 - 胖工具实现
     */
    ragRetrieval: async (params: {
        query: string;
        domain?: string;
        layerPreference?: 'enterprise' | 'builtin' | 'internet' | 'auto';
        maxResults?: number;
        contextType?: 'routing' | 'content_generation' | 'qa' | 'templates';
    }): Promise<RAGResponse> => {
        const startTime = Date.now();
        const maxResults = params.maxResults || 10;
        const layerPreference = params.layerPreference || 'auto';
        const contextType = params.contextType || 'routing';
        
        console.log(`[RAG] Starting retrieval for: "${params.query}" (${contextType})`);
        
        const allResults: RAGResult[] = [];
        const layersUsed: string[] = [];
        const sources: string[] = [];
        
        try {
            // 动态导入原子层工具执行器
            const { atomicToolImplementations } = await import('../atomic/atomicTools');
            
            // Layer 1: 企业RAG系统 (最高优先级)
            if (layerPreference === 'auto' || layerPreference === 'enterprise') {
                try {
                    const enterpriseResult = await atomicToolImplementations.enterpriseRAGCall({
                        query: params.query,
                        domain: params.domain,
                        maxResults: Math.min(maxResults, 5)
                    });
                    
                    if (enterpriseResult.success && enterpriseResult.results) {
                        layersUsed.push('enterprise');
                        sources.push('Enterprise RAG');
                        
                        const formattedResults = enterpriseResult.results.map(item => ({
                            content: item.content,
                            source: 'enterprise_rag',
                            relevanceScore: item.confidence,
                            metadata: {
                                confidence: item.confidence,
                                ...item.metadata
                            }
                        }));
                        
                        allResults.push(...formattedResults);
                        
                        // 如果企业RAG有高质量结果，可能不需要继续其他层
                        const highQualityResults = formattedResults.filter(r => 
                            (r.relevanceScore || 0) > 0.8
                        );
                        
                        if (highQualityResults.length >= 3) {
                            console.log(`[RAG] Enterprise RAG provided ${highQualityResults.length} high-quality results, skipping other layers`);
                            return _formatRAGResponse(allResults, layersUsed, sources, params.query, startTime);
                        }
                    }
                } catch (enterpriseError) {
                    console.log(`[RAG] Enterprise RAG failed: ${enterpriseError}, falling back to other layers`);
                }
            }
            
            // Layer 2: 本地知识库 (中等优先级)
            if ((layerPreference === 'auto' || layerPreference === 'builtin') && allResults.length < maxResults) {
                try {
                    const builtinResult = await atomicToolImplementations.readLocalKnowledge({
                        query: params.query,
                        maxResults: maxResults - allResults.length
                    });
                    
                    if (builtinResult.success && builtinResult.results) {
                        layersUsed.push('builtin');
                        sources.push('Local Knowledge Base');
                        
                        const formattedResults = builtinResult.results.map(item => ({
                            content: item.content,
                            source: 'local_knowledge',
                            relevanceScore: item.relevanceScore,
                            metadata: {
                                filePath: item.filePath,
                                excerpts: item.excerpts
                            }
                        }));
                        
                        allResults.push(...formattedResults);
                    }
                } catch (builtinError) {
                    console.log(`[RAG] Local knowledge search failed: ${builtinError}`);
                }
            }
            
            // Layer 3: 互联网搜索 (兜底方案)
            if ((layerPreference === 'auto' || layerPreference === 'internet') && allResults.length < maxResults) {
                try {
                    const searchType = _determineInternetSearchType(contextType);
                    const internetResult = await atomicToolImplementations.internetSearch({
                        query: params.query,
                        maxResults: Math.min(maxResults - allResults.length, 3),
                        searchType
                    });
                    
                    if (internetResult.success && internetResult.results) {
                        layersUsed.push('internet');
                        sources.push('Internet Search');
                        
                        const formattedResults = internetResult.results.map(item => ({
                            content: item.snippet,
                            source: 'internet_search',
                            relevanceScore: 0.5, // 默认相关性
                            metadata: {
                                url: item.url,
                                title: item.title
                            }
                        }));
                        
                        allResults.push(...formattedResults);
                    }
                } catch (internetError) {
                    console.log(`[RAG] Internet search failed: ${internetError}`);
                }
            }
            
            // 按相关性排序并限制结果数量
            const sortedResults = allResults
                .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
                .slice(0, maxResults);
            
            return _formatRAGResponse(sortedResults, layersUsed, sources, params.query, startTime);
            
        } catch (error) {
            console.error(`[RAG] Retrieval failed: ${error}`);
            return {
                success: false,
                results: [],
                strategy: 'failed',
                sources: [],
                error: (error as Error).message,
                metadata: {
                    query: params.query,
                    totalResults: 0,
                    executionTime: Date.now() - startTime,
                    layersUsed: []
                }
            };
        }
    },
    
    /**
     * 提供最终答案并标记任务完成
     */
    finalAnswer: async (params: {
        summary: string;
        achievements: string[];
        nextSteps: string[];
        taskType?: string;
    }): Promise<FinalAnswer> => {
        const finalAnswer: FinalAnswer = {
            summary: params.summary,
            achievements: params.achievements,
            nextSteps: params.nextSteps,
            metadata: {
                taskType: params.taskType || 'general',
                executionTime: Date.now(),
                toolsUsed: 0 // This will be filled by the caller
            }
        };

        // 记录任务完成日志
        console.log(`[SystemTools] Task completed: ${params.taskType || 'general'}`);
        console.log(`[SystemTools] Achievements: ${params.achievements.length} items`);
        console.log(`[SystemTools] Next steps: ${params.nextSteps.length} suggestions`);

        return finalAnswer;
    },

    /**
     * 报告当前进度
     */
    reportProgress: async (params: {
        currentStep: string;
        completedSteps: string[];
        remainingSteps: string[];
        estimatedTimeRemaining?: string;
    }): Promise<{ status: string; progress: any }> => {
        const totalSteps = params.completedSteps.length + 1 + params.remainingSteps.length;
        const progressPercentage = Math.round((params.completedSteps.length / totalSteps) * 100);

        const progress = {
            currentStep: params.currentStep,
            completedSteps: params.completedSteps,
            remainingSteps: params.remainingSteps,
            progressPercentage,
            estimatedTimeRemaining: params.estimatedTimeRemaining,
            totalSteps
        };

        console.log(`[SystemTools] Progress Update: ${progressPercentage}% complete`);
        console.log(`[SystemTools] Current Step: ${params.currentStep}`);

        return {
            status: 'progress_reported',
            progress
        };
    },

    /**
     * 获取系统状态
     */
    getSystemStatus: async (params: {
        includeToolInventory?: boolean;
        includeSessionDetails?: boolean;
    } = {}): Promise<SystemStatus> => {
        // 这里需要从实际的系统组件获取状态
        // 暂时返回模拟数据，实际实现时会注入真实的状态获取逻辑
        
        const status: SystemStatus = {
            mode: 'AI_TOOL_AGENT',
            activeProject: undefined, // Will be filled by actual session manager
            toolsAvailable: 0, // Will be filled by actual tool registry
            sessionInfo: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: '2.0'
            }
        };

        console.log(`[SystemTools] System status requested`);
        console.log(`[SystemTools] Mode: ${status.mode}`);

        return status;
    }
};

/**
 * 系统工具类别信息
 */
export const systemToolsCategory = {
    name: 'System Control Tools',
    description: 'Internal tools for system control, task completion signaling, and status management',
    tools: systemToolDefinitions.map(tool => tool.name),
    layer: 'internal'
};

// ============================================================================
// 🔧 RAG辅助函数
// ============================================================================

/**
 * 格式化RAG响应结果
 */
function _formatRAGResponse(
    results: RAGResult[], 
    layersUsed: string[], 
    sources: string[], 
    query: string, 
    startTime: number
): RAGResponse {
    const strategy = layersUsed.length > 1 ? 'multi-layer' : layersUsed[0] || 'none';
    
    return {
        success: true,
        results,
        strategy,
        sources,
        metadata: {
            query,
            totalResults: results.length,
            executionTime: Date.now() - startTime,
            layersUsed
        }
    };
}

/**
 * 根据上下文类型确定互联网搜索类型
 */
function _determineInternetSearchType(
    contextType: 'routing' | 'content_generation' | 'qa' | 'templates'
): 'general' | 'technical' | 'documentation' {
    switch (contextType) {
        case 'content_generation':
        case 'templates':
            return 'documentation';
        case 'qa':
            return 'technical';
        case 'routing':
        default:
            return 'general';
    }
} 