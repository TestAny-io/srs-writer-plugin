import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';

/**
 * 知识检索工具 - RAG (检索增强生成) 基础功能
 * 
 * 包含功能：
 * - 本地知识库检索
 * - 互联网搜索
 * - 企业RAG调用
 * - 自定义RAG检索
 */

const logger = Logger.getInstance();

// ============================================================================
// 企业RAG客户端实现
// ============================================================================

/**
 * 企业RAG客户端 - 支持token管理和API调用
 */
class EnterpriseRAGClient {
    private baseUrl: string;
    private appKey: string;
    private appSecret: string;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private logger = Logger.getInstance();

    constructor(baseUrl: string, appKey: string, appSecret: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除尾部斜杠
        this.appKey = appKey;
        this.appSecret = appSecret;
    }

    /**
     * 获取访问令牌
     */
    private async getAccessToken(): Promise<string> {
        const now = Date.now();
        
        // 如果token还没过期，直接返回
        if (this.accessToken && now < this.tokenExpiry) {
            return this.accessToken;
        }

        this.logger.info('🔑 获取企业RAG访问令牌...');

        try {
            const response = await fetch(`${this.baseUrl}/openapi/access_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app_key: this.appKey,
                    app_secret: this.appSecret
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as any;
            
            if (data.code !== 0) {
                throw new Error(`认证失败: ${data.message || '未知错误'}`);
            }

            if (!data.payload?.access_token) {
                throw new Error('服务器返回的token格式不正确');
            }

            this.accessToken = data.payload.access_token;
            // 设置token过期时间（假设1小时有效期，提前5分钟刷新）
            this.tokenExpiry = now + (55 * 60 * 1000);
            
            this.logger.info('✅ 企业RAG访问令牌获取成功');
            return this.accessToken!; // 使用非空断言，因为上面已经验证过

        } catch (error) {
            this.logger.error(`❌ 获取企业RAG访问令牌失败: ${(error as Error).message}`);
            throw new Error(`Token获取失败: ${(error as Error).message}`);
        }
    }

    /**
     * 执行RAG检索
     */
    async search(params: {
        query: string;
        dataset_id: string;
        search_method?: 'semantic_search' | 'full_text_search' | 'hybrid_search';
        top_k?: number;
        domain?: string;
        reranking_enable?: boolean;
        score_threshold?: number;
        score_threshold_enabled?: boolean;
    }): Promise<{
        success: boolean;
        results?: Array<{
            content: string;
            source: string;
            confidence: number;
            metadata?: any;
        }>;
        raw_response?: any;
        error?: string;
        error_type?: 'config' | 'auth' | 'network' | 'api' | 'parse';
    }> {
        try {
            const token = await this.getAccessToken();
            
            this.logger.info(`🔍 执行企业RAG检索: "${params.query}" (dataset: ${params.dataset_id})`);

            const requestBody = {
                query: params.query,
                search_method: params.search_method || 'semantic_search',
                reranking_enable: params.reranking_enable ?? true,
                reranking_mode: 'reranking_model',
                reranking_model: {
                    reranking_provider_name: 'xinference',
                    reranking_model_name: 'bge-reranker-large'
                },
                weights: {
                    keyword_setting: {
                        keyword_weight: 0.8
                    },
                    vector_setting: {
                        vector_weight: 0.2,
                        embedding_model_name: '',
                        embedding_provider_name: ''
                    }
                },
                top_k: params.top_k || 4,
                score_threshold_enabled: params.score_threshold_enabled ?? false,
                score_threshold: params.score_threshold || 0.1
            };

            const response = await fetch(
                `${this.baseUrl}/openapi/knowledge/datasets/${params.dataset_id}/hit-testing`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                let errorType: 'auth' | 'api' | 'network' = 'network';
                if (response.status === 401 || response.status === 403) {
                    errorType = 'auth';
                } else if (response.status >= 400 && response.status < 500) {
                    errorType = 'api';
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}|${errorType}`);
            }

            const data = await response.json();
            
            // 解析和标准化响应数据
            const results = this.parseRAGResponse(data);
            
            this.logger.info(`✅ 企业RAG检索成功，返回 ${results.length} 个结果`);
            
            return {
                success: true,
                results,
                raw_response: data
            };

        } catch (error) {
            const errorMsg = (error as Error).message;
            const parts = errorMsg.split('|');
            const actualMsg = parts[0];
            const errorType = parts[1] as 'config' | 'auth' | 'network' | 'api' | 'parse' || 'network';
            
            this.logger.error(`❌ 企业RAG检索失败: ${actualMsg}`);
            return {
                success: false,
                error: actualMsg,
                error_type: errorType
            };
        }
    }

    /**
     * 解析RAG响应数据，转换为标准格式
     * 根据真实的RAG API响应格式：
     * {
     *   "code": 0,
     *   "payload": {
     *     "records": [
     *       {
     *         "segment": {
     *           "content": "实际内容",
     *           "document": {
     *             "original_document_name": "文档名"
     *           }
     *         },
     *         "score": 0.384
     *       }
     *     ]
     *   }
     * }
     */
    private parseRAGResponse(data: any): Array<{
        content: string;
        source: string;
        confidence: number;
        metadata?: any;
    }> {
        try {
            if (!data) {
                this.logger.warn('⚠️ RAG响应数据为空');
                return [];
            }

            // 检查响应状态
            if (data.code !== 0) {
                this.logger.warn(`⚠️ RAG响应错误: ${data.message || '未知错误'}`);
                return [];
            }

            // 获取records数组
            const records = data.payload?.records;
            if (!Array.isArray(records)) {
                this.logger.warn('⚠️ RAG响应中没有找到records数组');
                return [];
            }

            this.logger.info(`📋 解析RAG响应: 找到 ${records.length} 个记录`);

            return records.map((record: any, index: number) => {
                const segment = record.segment || {};
                const document = segment.document || {};
                
                // 提取内容
                const content = segment.content || '无内容';
                
                // 提取来源信息
                const originalDocName = document.original_document_name || '';
                const docName = document.name || '';
                const source = originalDocName || docName || `结果 ${index + 1}`;
                
                // 提取得分
                const confidence = record.score || 0;
                
                // 构建元数据
                const metadata = {
                    segment_id: segment.id,
                    document_id: segment.document_id,
                    position: segment.position,
                    word_count: segment.word_count,
                    tokens: segment.tokens,
                    keywords: segment.keywords || [],
                    document: {
                        id: document.id,
                        data_source_type: document.data_source_type,
                        original_document_id: document.original_document_id,
                        original_document_name: document.original_document_name,
                        original_document_oss_object_name: document.original_document_oss_object_name,
                        original_document_summary: document.original_document_summary
                    },
                    tsne_position: record.tsne_position
                };

                this.logger.debug(`📄 解析记录 ${index + 1}: ${content.substring(0, 50)}... (得分: ${confidence})`);

                return {
                    content,
                    source,
                    confidence,
                    metadata
                };
            });

        } catch (error) {
            this.logger.error(`❌ 解析RAG响应失败: ${(error as Error).message}`);
            this.logger.error(`❌ 响应数据结构: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
            return [];
        }
    }
}

/**
 * 单例模式的RAG客户端管理器
 */
class RAGClientManager {
    private static instance: RAGClientManager;
    private clients: Map<string, EnterpriseRAGClient> = new Map();

    static getInstance(): RAGClientManager {
        if (!RAGClientManager.instance) {
            RAGClientManager.instance = new RAGClientManager();
        }
        return RAGClientManager.instance;
    }

    getClient(config: {
        baseUrl: string;
        appKey: string;
        appSecret: string;
    }): EnterpriseRAGClient {
        const key = `${config.baseUrl}_${config.appKey}`;
        
        if (!this.clients.has(key)) {
            this.clients.set(key, new EnterpriseRAGClient(
                config.baseUrl,
                config.appKey,
                config.appSecret
            ));
        }
        
        return this.clients.get(key)!;
    }
}

// ============================================================================
// 本地知识检索工具
// ============================================================================

/**
 * 读取本地知识库文件 (templates/ 和 knowledge/ 目录)
 */
export const readLocalKnowledgeToolDefinition = {
    name: "readLocalKnowledge",
    description: "Search and read local knowledge files from templates/ and knowledge/ directories",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query to find relevant knowledge files"
            },
            searchPaths: {
                type: "array",
                items: { type: "string" },
                description: "Paths to search in (default: ['templates/', 'knowledge/'])"
            },
            fileExtensions: {
                type: "array", 
                items: { type: "string" },
                description: "File extensions to include (default: ['.md', '.yml', '.yaml', '.json'])"
            },
            maxResults: {
                type: "number",
                description: "Maximum number of files to return (default: 10)"
            }
        },
        required: ["query"]
    },
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：本地知识查询，允许两种模式使用
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答模式
        // CallerType.ORCHESTRATOR_TOOL_EXECUTION   // 工具执行模式（当任务需要查阅本地知识时）
    ]
};

export async function readLocalKnowledge(args: {
    query: string;
    searchPaths?: string[];
    fileExtensions?: string[];
    maxResults?: number;
}): Promise<{
    success: boolean;
    results?: Array<{
        filePath: string;
        relevanceScore: number;
        content: string;
        excerpts: string[];
    }>;
    error?: string;
}> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const searchPaths = args.searchPaths || ['templates/', 'knowledge/'];
        const fileExtensions = args.fileExtensions || ['.md', '.yml', '.yaml', '.json'];
        const maxResults = args.maxResults || 10;
        const queryLower = args.query.toLowerCase();

        const results: Array<{
            filePath: string;
            relevanceScore: number;
            content: string;
            excerpts: string[];
        }> = [];

        // 搜索每个路径
        for (const searchPath of searchPaths) {
            try {
                const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, searchPath);
                const entries = await vscode.workspace.fs.readDirectory(dirUri);

                for (const [fileName, fileType] of entries) {
                    // 只处理文件，且符合扩展名要求
                    if (fileType === vscode.FileType.File && 
                        fileExtensions.some(ext => fileName.toLowerCase().endsWith(ext))) {
                        
                        const filePath = `${searchPath}${fileName}`;
                        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
                        
                        try {
                            const fileData = await vscode.workspace.fs.readFile(fileUri);
                            const content = new TextDecoder().decode(fileData);
                            
                            // 计算相关性分数
                            const relevanceScore = _calculateRelevanceScore(queryLower, fileName, content);
                            
                            if (relevanceScore > 0) {
                                // 提取相关片段
                                const excerpts = _extractRelevantExcerpts(queryLower, content);
                                
                                results.push({
                                    filePath,
                                    relevanceScore,
                                    content,
                                    excerpts
                                });
                            }
                        } catch (fileError) {
                            logger.warn(`Failed to read file ${filePath}: ${fileError}`);
                        }
                    }
                }
            } catch (dirError) {
                logger.warn(`Failed to read directory ${searchPath}: ${dirError}`);
            }
        }

        // 按相关性排序并限制结果数量
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        const limitedResults = results.slice(0, maxResults);

        logger.info(`✅ Found ${limitedResults.length} relevant knowledge files for query: "${args.query}"`);
        return { success: true, results: limitedResults };

    } catch (error) {
        const errorMsg = `Failed to search local knowledge: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// 互联网搜索工具
// ============================================================================

/**
 * 互联网搜索工具 (通过VSCode Copilot或其他搜索服务)
 */
export const internetSearchToolDefinition = {
    name: "internetSearch",
    description: "Search the internet using available search providers (VSCode Copilot, etc.)",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query for internet search"
            },
            maxResults: {
                type: "number",
                description: "Maximum number of search results (default: 5)"
            },
            searchType: {
                type: "string",
                enum: ["general", "technical", "documentation"],
                description: "Type of search to perform (default: general)"
            }
        },
        required: ["query"]
    },
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚫 工具已禁用 - 避免Language Model Tools API依赖
    // 重新启用方法：取消注释下面的 accessibleBy 配置
    accessibleBy: [
        // CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // "什么是最新的软件工程趋势？" - 知识问答模式
        // CallerType.ORCHESTRATOR_TOOL_EXECUTION   // "搜索最新的TypeScript版本信息" - 工具执行模式
    ]
};

export async function internetSearch(args: {
    query: string;
    maxResults?: number;
    searchType?: 'general' | 'technical' | 'documentation';
    toolInvocationToken?: vscode.ChatRequestTurn;
}): Promise<{
    success: boolean;
    searchData?: string;
    searchQuery?: string;
    searchType?: string;
    timestamp?: string;
    source?: string;
    dataLength?: number;
    results?: Array<{
        title: string;
        url: string;
        snippet: string;
        source: string;
    }>;
    error?: string;
}> {
    try {
        logger.info(`🚀 InternetSearch 开始执行，参数: query="${args.query}", maxResults=${args.maxResults || 5}, searchType=${args.searchType || 'general'}, hasToken=${!!args.toolInvocationToken}`);
        
        const maxResults = args.maxResults || 5;

        // 1. 优先尝试 VS Code Web Search 工具
        logger.info(`🔍 检查 VS Code Language Model API 可用性: lm=${!!vscode.lm}, invokeTool=${!!(vscode.lm && typeof vscode.lm.invokeTool === 'function')}`);
        
        if (vscode.lm && typeof vscode.lm.invokeTool === 'function') {
            try {
                logger.info(`🔍 开始尝试调用 VS Code websearch 工具，查询: "${args.query}"`);
                
                // 检查可用工具列表
                const availableTools = vscode.lm.tools || [];
                logger.info(`📋 当前可用工具列表 (${availableTools.length}个): ${availableTools.map(t => t.name).join(', ')}`);
                
                // 正确方式：先查找 vscode-websearchforcopilot_webSearch 工具
                const websearchTool = vscode.lm.tools.find(tool => tool.name === 'vscode-websearchforcopilot_webSearch');
                if (!websearchTool) {
                    logger.warn('❌ vscode-websearchforcopilot_webSearch 工具未找到！可用工具: ' + availableTools.map(t => `"${t.name}"`).join(', '));
                    // 继续尝试降级方案
                } else {
                    logger.info(`✅ 找到 websearch 工具: name="${websearchTool.name}", description="${websearchTool.description}"`);
                    
                    // 调用 websearch 工具，传递正确的参数结构
                    logger.info(`📤 调用 vscode-websearchforcopilot_webSearch 工具，参数: { input: { query: "${args.query}" } }`);
                    const searchResult = await vscode.lm.invokeTool(
                        'vscode-websearchforcopilot_webSearch',
                        { 
                            input: { query: args.query },
                            toolInvocationToken: undefined as any
                        }
                    );
                    
                    logger.info(`📥 Websearch 工具调用完成，结果类型: ${typeof searchResult}, hasContent: ${!!(searchResult && searchResult.content)}`);
                    
                    // 处理搜索结果 - LanguageModelToolResult包含内容部分数组
                    let searchText = '';
                    if (searchResult && searchResult.content) {
                        logger.info(`📄 搜索结果包含 ${searchResult.content.length} 个内容部分`);
                        
                        for (let i = 0; i < searchResult.content.length; i++) {
                            const part = searchResult.content[i];
                            logger.info(`📝 内容部分 ${i}: type=${typeof part}, hasValue=${(part as any).value !== undefined}, hasText=${(part as any).text !== undefined}`);
                            
                            // 检查不同类型的内容部分
                            if ((part as any).value !== undefined) {
                                const value = (part as any).value;
                                // 🔧 修复：安全处理不同类型的 value
                                const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                                searchText += valueStr;
                                logger.info(`➕ 添加 value 内容 (${valueStr.length} 字符): ${valueStr.substring(0, 100)}...`);
                            } else if ((part as any).text !== undefined) {
                                const text = (part as any).text;
                                // 🔧 修复：安全处理不同类型的 text
                                const textStr = typeof text === 'string' ? text : JSON.stringify(text);
                                searchText += textStr;
                                logger.info(`➕ 添加 text 内容 (${textStr.length} 字符): ${textStr.substring(0, 100)}...`);
                            }
                        }
                    } else {
                        logger.warn(`⚠️ 搜索结果为空或缺少内容: searchResult=${!!searchResult}, content=${!!(searchResult && searchResult.content)}`);
                    }
                    
                    logger.info(`📝 提取的完整搜索文本长度: ${searchText.length} 字符`);
                    if (searchText.length > 0) {
                        logger.info(`📝 搜索文本预览: ${searchText.substring(0, 200)}...`);
                        
                        // 🚀 新设计：直接返回完整的搜索数据，让AI处理
                        logger.info(`✅ VS Code websearch 成功获取数据，将完整结果交给AI处理`);
                        return { 
                            success: true, 
                            searchData: searchText,
                            searchQuery: args.query,
                            searchType: args.searchType || 'general',
                            timestamp: new Date().toISOString(),
                            source: 'vscode-websearchforcopilot',
                            dataLength: searchText.length
                        };
                    } else {
                        logger.warn('⚠️ VS Code websearch 返回空数据，开始尝试降级方案');
                        // 继续尝试降级方案
                    }
                }
                
            } catch (toolError) {
                logger.error(`❌ VS Code websearch 调用失败: ${(toolError as Error).message}`);
                logger.error(`❌ 错误堆栈: ${(toolError as Error).stack}`);
                // 继续尝试降级方案
            }
        }
        
        // 2. 检查Web Search扩展是否已安装
        logger.info(`🔍 检查 Web Search for Copilot 扩展安装状态...`);
        const webSearchExtension = vscode.extensions.getExtension('ms-vscode.vscode-websearchforcopilot');
        
        if (!webSearchExtension) {
            logger.warn('⚠️ Web Search for Copilot 扩展未安装，返回安装指导');
            const installationGuide = `安装指导：Web Search for Copilot 扩展未安装

查询："${args.query}"

无法获取实时信息。请安装 "Web Search for Copilot" 扩展以启用网络搜索功能。

安装步骤：
1. 访问扩展商店：https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-websearchforcopilot
2. 安装 "Web Search for Copilot" 扩展
3. 配置 Tavily 或 Bing API 密钥
4. 重新尝试搜索`;

            const fallbackResult = {
                success: true,
                searchData: installationGuide,
                searchQuery: args.query,
                searchType: args.searchType || 'general',
                timestamp: new Date().toISOString(),
                source: 'installation_guide',
                dataLength: installationGuide.length
            };
            logger.info(`📤 返回安装指导信息: ${installationGuide.length} 字符`);
            return fallbackResult;
        }
        
        // 3. 扩展已安装但工具可能未配置
        logger.info(`✅ Web Search for Copilot 扩展已安装，检查配置...`);
        const config = vscode.workspace.getConfiguration('websearch');
        const preferredEngine = config.get<string>('preferredEngine', 'tavily');
        
        logger.info(`⚙️ Web Search 扩展配置: preferredEngine="${preferredEngine}"`);
        
        const configurationGuide = `配置指导：Web Search for Copilot 扩展已安装

查询："${args.query}"

扩展已安装，但可能需要配置API密钥：

当前配置：
- 搜索引擎设置：${preferredEngine}

建议操作：
1. 请确保已配置 ${preferredEngine === 'tavily' ? 'Tavily' : 'Bing'} API 密钥
2. 检查扩展设置中的API密钥配置
3. 或者在浏览器中搜索：https://www.google.com/search?q=${encodeURIComponent(args.query)}

如果配置正确但仍有问题，请检查网络连接和API密钥的有效性。`;

        const configResult = {
            success: true,
            searchData: configurationGuide,
            searchQuery: args.query,
            searchType: args.searchType || 'general',
            timestamp: new Date().toISOString(),
            source: 'configuration_guide',
            dataLength: configurationGuide.length
        };
        logger.info(`📤 返回配置指导信息: ${configurationGuide.length} 字符`);
        return configResult;
        
    } catch (error) {
        const errorMsg = `Failed to perform internet search: ${(error as Error).message}`;
        logger.error(`❌ InternetSearch 执行过程中发生未捕获错误: ${errorMsg}`);
        logger.error(`❌ 错误堆栈: ${(error as Error).stack}`);
        
        const errorResult = { 
            success: false, 
            error: errorMsg,
            searchQuery: args.query,
            timestamp: new Date().toISOString()
        };
        logger.info(`📤 返回错误结果: ${errorMsg}`);
        return errorResult;
    }
}

// ============================================================================
// 企业RAG系统工具
// ============================================================================

/**
 * 企业RAG系统调用工具
 */
export const enterpriseRAGCallToolDefinition = {
    name: "enterpriseRAGCall",
    description: "Call external enterprise RAG system via HTTP API",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Query to send to enterprise RAG system"
            },
            domain: {
                type: "string",
                description: "Business domain context (optional)"
            },
            maxResults: {
                type: "number",
                description: "Maximum number of results to return (default: 5)"
            }
        },
        required: ["query"]
    },
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：企业RAG查询，允许两种模式使用
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答模式
        CallerType.ORCHESTRATOR_TOOL_EXECUTION   // 工具执行模式（当任务需要企业知识时）
    ]
};

export async function enterpriseRAGCall(args: {
    query: string;
    dataset_id?: string;
    search_method?: 'semantic_search' | 'full_text_search' | 'hybrid_search';
    domain?: string;
    maxResults?: number;
    score_threshold?: number;
    score_threshold_enabled?: boolean;
}): Promise<{
    success: boolean;
    results?: Array<{
        content: string;
        source: string;
        confidence: number;
        metadata?: any;
    }>;
    ragData?: any;
    query?: string;
    domain?: string;
    timestamp?: string;
    source?: string;
    resultCount?: number;
    error?: string;
    error_type?: 'config' | 'auth' | 'network' | 'api' | 'parse';
}> {
    try {
        // 获取企业RAG配置
        const config = vscode.workspace.getConfiguration('srs-writer.rag.enterprise');
        const baseUrl = config.get<string>('baseUrl');
        const appKey = config.get<string>('appKey');
        const appSecret = config.get<string>('appSecret');
        const defaultDatasetId = config.get<string>('defaultDatasetId');
        const enabled = config.get<boolean>('enabled', false);

        // 配置验证 - 提供详细的错误信息
        if (!enabled) {
            return {
                success: false,
                error: '企业RAG功能未启用。请在设置中启用 srs-writer.rag.enterprise.enabled',
                error_type: 'config'
            };
        }

        if (!baseUrl) {
            return {
                success: false,
                error: '企业RAG服务器地址未配置。请设置 srs-writer.rag.enterprise.baseUrl（例如：http://192.168.1.100:8080）',
                error_type: 'config'
            };
        }

        if (!appKey || !appSecret) {
            return {
                success: false,
                error: '企业RAG认证信息未配置。请设置 srs-writer.rag.enterprise.appKey 和 srs-writer.rag.enterprise.appSecret',
                error_type: 'config'
            };
        }

        const dataset_id = args.dataset_id || defaultDatasetId;
        if (!dataset_id) {
            return {
                success: false,
                error: '数据集ID未指定。请在调用参数中提供dataset_id或在设置中配置 srs-writer.rag.enterprise.defaultDatasetId',
                error_type: 'config'
            };
        }

        logger.info(`🏢 调用企业RAG系统: "${args.query}" (数据集: ${dataset_id}, 方法: ${args.search_method || 'semantic_search'})`);

        // 获取RAG客户端并执行检索
        const ragManager = RAGClientManager.getInstance();
        const client = ragManager.getClient({ baseUrl, appKey, appSecret });
        
        const result = await client.search({
            query: args.query,
            dataset_id,
            search_method: args.search_method || 'semantic_search',
            top_k: args.maxResults || 4,
            domain: args.domain,
            score_threshold: args.score_threshold,
            score_threshold_enabled: args.score_threshold_enabled
        });

        if (result.success && result.results) {
            logger.info(`✅ 企业RAG检索成功，返回 ${result.results.length} 个结果`);
            return {
                success: true,
                results: result.results,
                ragData: result.raw_response,
                query: args.query,
                domain: args.domain,
                timestamp: new Date().toISOString(),
                source: 'enterprise_rag',
                resultCount: result.results.length
            };
        } else {
            logger.warn(`⚠️ 企业RAG检索失败: ${result.error}`);
            return {
                success: false,
                error: result.error || '企业RAG检索失败',
                error_type: result.error_type || 'api'
            };
        }

    } catch (error) {
        const errorMsg = `企业RAG系统调用异常: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { 
            success: false, 
            error: errorMsg,
            error_type: 'network'
        };
    }
}

/**
 * 🚀 企业自定义RAG检索工具 - 纯原子层实现
 */
export const customRAGRetrievalToolDefinition = {
    name: "customRAGRetrieval",
    description: "检索企业/自定义RAG知识库信息。支持语义检索、全文检索和混合检索模式。注意：此工具需要用户预先配置企业RAG系统连接信息，如果用户未配置或配置错误，工具将报告失败并提供具体的配置指导。",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "搜索查询内容，用于在企业知识库中检索相关信息"
            },
            dataset_id: {
                type: "string", 
                description: "数据集ID，用于指定要搜索的知识库数据集。如果未提供，将使用用户配置的默认数据集ID。如果用户未配置默认数据集，则必须提供此参数"
            },
            search_method: {
                type: "string",
                enum: ["semantic_search", "full_text_search", "hybrid_search"],
                description: "搜索方法：semantic_search(语义检索，基于语义相似度)、full_text_search(全文检索，基于关键词匹配)、hybrid_search(混合检索，结合语义和关键词)",
                default: "semantic_search"
            },
            domain: {
                type: "string",
                description: "业务领域上下文，可选参数，有助于提高检索的准确性（例如：'financial_services', 'healthcare', 'e-commerce', 'technology'）"
            },
            maxResults: {
                type: "integer",
                description: "返回结果的最大数量，默认为4，取值范围1-20",
                default: 4,
                minimum: 1,
                maximum: 20
            },
            score_threshold: {
                type: "number",
                description: "得分阈值，只返回得分高于此值的结果，取值范围0.0-1.0",
                minimum: 0.0,
                maximum: 1.0
            },
            score_threshold_enabled: {
                type: "boolean",
                description: "是否启用得分阈值过滤",
                default: false
            }
        },
        required: ["query"]
    },
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    accessibleBy: [
        CallerType.SPECIALIST_CONTENT,   // 内容专家可以调用
        CallerType.SPECIALIST_PROCESS,    // 流程专家可以调用
        CallerType.ORCHESTRATOR_TOOL_EXECUTION  // 编排器工具执行模式
    ]
};

export async function customRAGRetrieval(args: {
    query: string;
    dataset_id?: string;
    search_method?: 'semantic_search' | 'full_text_search' | 'hybrid_search';
    domain?: string;
    maxResults?: number;
    score_threshold?: number;
    score_threshold_enabled?: boolean;
}): Promise<{
    success: boolean;
    results?: Array<{
        content: string;
        source: string;
        confidence: number;
        metadata?: any;
    }>;
    error?: string;
    errorType?: 'config' | 'auth' | 'network' | 'api' | 'parse';
    aiInstructions?: string;
}> {
    try {
        logger.info(`🔍 Custom RAG retrieval: "${args.query}" (${args.search_method || 'semantic_search'})`);
        
        // 调用底层企业RAG函数
        const result = await enterpriseRAGCall({
            query: args.query,
            dataset_id: args.dataset_id,
            search_method: args.search_method,
            domain: args.domain,
            maxResults: args.maxResults || 4,
            score_threshold: args.score_threshold,
            score_threshold_enabled: args.score_threshold_enabled
        });
        
        if (result.success && result.results) {
            logger.info(`✅ Custom RAG 检索成功，找到 ${result.results.length} 个结果`);
            return {
                success: true,
                results: result.results
            };
        } else {
            // 🚀 AI友好的错误处理 - 根据错误类型提供不同的指导
            logger.warn(`⚠️ Custom RAG 检索失败: ${result.error}`);
            
            let aiInstructions = '';
            
            switch (result.error_type) {
                case 'config':
                    aiInstructions = `企业RAG工具不可用：${result.error}。请不要再尝试调用此工具，改用其他方式获取信息，如VS Code内置的搜索功能或告知用户需要配置企业RAG系统。`;
                    break;
                
                case 'auth':
                    aiInstructions = `企业RAG认证失败：${result.error}。此工具在当前会话中不可用，请不要再次调用。建议告知用户检查认证配置或使用其他信息获取方式。`;
                    break;
                
                case 'network':
                    aiInstructions = `企业RAG网络连接失败：${result.error}。可能是临时网络问题，可以尝试一次重试，但如果仍然失败，请改用其他方式。`;
                    break;
                
                case 'api':
                    aiInstructions = `企业RAG API调用失败：${result.error}。可能是参数错误或服务端问题，请检查参数后可尝试一次重试。`;
                    break;
                
                default:
                    aiInstructions = `企业RAG检索失败：${result.error}。请尝试其他方式获取所需信息。`;
            }
            
            return {
                success: false,
                error: result.error || '企业RAG检索失败',
                errorType: result.error_type,
                aiInstructions
            };
        }
        
    } catch (error) {
        const errorMsg = `Custom RAG 检索异常: ${(error as Error).message}`;
        logger.error(errorMsg);
        
        return { 
            success: false, 
            error: errorMsg,
            errorType: 'network',
            aiInstructions: `企业RAG工具发生异常：${errorMsg}。此工具在当前会话中可能不稳定，建议使用其他方式获取信息。`
        };
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析Web Search工具返回的markdown格式结果
 */
function parseWebSearchResults(searchText: string, maxResults: number): Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
}> {
    logger.info(`🔍 开始解析搜索结果文本，长度: ${searchText.length}, maxResults: ${maxResults}`);
    const results: Array<{title: string; url: string; snippet: string; source: string}> = [];
    
    try {
        // 🔧 新增：尝试解析 vscode-websearchforcopilot 的特殊格式
        if (searchText.includes('Here is some relevent context from webpages across the internet:')) {
            logger.info(`📋 检测到 vscode-websearchforcopilot 格式，尝试解析...`);
            
            // 尝试提取 JSON 数据部分
            const jsonMatch = searchText.match(/\[{.*}\]/s);
            if (jsonMatch) {
                try {
                    const searchData = JSON.parse(jsonMatch[0]);
                    logger.info(`📊 成功解析 JSON 数据，包含 ${searchData.length} 个结果`);
                    
                    // 🔍 调试：显示数据结构样本
                    if (searchData.length > 0) {
                        const firstItem = searchData[0];
                        logger.info(`📋 数据结构样本: ${JSON.stringify(firstItem).substring(0, 200)}...`);
                        logger.info(`📋 是否包含 file 对象: ${!!firstItem.file}`);
                    }
                    
                    // 转换为标准格式 - 处理 vscode-websearchforcopilot 的特殊 file 结构
                    for (let i = 0; i < Math.min(searchData.length, maxResults); i++) {
                        const item = searchData[i];
                        
                        // 🔧 处理 file 对象结构
                        if (item.file) {
                            const file = item.file;
                            const url = `${file.scheme}://${file.authority}${file.path || ''}`;
                            const title = file.authority || `搜索结果 ${i + 1}`;
                            let snippet = file.fragment || file.description || '网页内容';
                            
                            // 🔧 清理和解码 fragment 内容
                            if (snippet && snippet.includes(':~:text=')) {
                                snippet = snippet.replace(':~:text=', '').replace(/,/g, ' ');
                                try {
                                    snippet = decodeURIComponent(snippet);
                                } catch (e) {
                                    // 如果解码失败，保持原始内容
                                    logger.warn(`⚠️ 解码fragment失败: ${e}`);
                                }
                            }
                            
                            results.push({
                                title: title,
                                url: url,
                                snippet: snippet,
                                source: 'vscode-websearchforcopilot'
                            });
                            
                            logger.info(`🔗 解析结果 ${i + 1}: "${title}" -> ${url}`);
                        } else {
                            // 🔧 降级处理：标准格式
                            results.push({
                                title: item.title || `搜索结果 ${i + 1}`,
                                url: item.url || item.link || `#result-${i + 1}`,
                                snippet: item.snippet || item.content || item.description || '搜索结果内容',
                                source: 'vscode-websearchforcopilot'
                            });
                            
                            logger.info(`🔗 解析结果 ${i + 1} (标准格式): "${item.title || `搜索结果 ${i + 1}`}" -> ${item.url || item.link}`);
                        }
                    }
                    
                    if (results.length > 0) {
                        logger.info(`✅ 成功解析 vscode-websearchforcopilot 格式，得到 ${results.length} 个结果`);
                        return results.slice(0, maxResults);
                    }
                } catch (parseError) {
                    logger.warn(`⚠️ JSON 解析失败: ${(parseError as Error).message}`);
                }
            }
        }
        // 方案1: 尝试解析 markdown 链接格式
        logger.info(`📋 方案1: 尝试解析 markdown 链接格式...`);
        const linkMatches = searchText.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        logger.info(`🔗 找到 ${linkMatches ? linkMatches.length : 0} 个 markdown 链接`);
        
        if (linkMatches) {
            linkMatches.slice(0, maxResults).forEach((match, index) => {
                const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (linkMatch) {
                    const title = linkMatch[1];
                    const url = linkMatch[2];
                    
                    // 尝试提取该链接附近的文本作为摘要
                    const linkIndex = searchText.indexOf(match);
                    const beforeText = searchText.substring(Math.max(0, linkIndex - 200), linkIndex);
                    const afterText = searchText.substring(linkIndex + match.length, linkIndex + match.length + 200);
                    const snippet = (beforeText + afterText).replace(/\n+/g, ' ').trim();
                    
                    results.push({
                        title,
                        url,
                        snippet: snippet || `来自 ${url} 的搜索结果`,
                        source: 'websearch'
                    });
                }
            });
        }
        
        // 方案2: 如果没有找到链接，尝试将整个文本作为一个结果
        logger.info(`📋 方案2: 检查是否需要使用原始文本作为结果，当前结果数: ${results.length}`);
        if (results.length === 0 && searchText.trim()) {
            logger.info(`📝 使用原始文本创建结果...`);
            const urlMatch = searchText.match(/(https?:\/\/[^\s\)]+)/);
            const url = urlMatch ? urlMatch[1] : `https://www.google.com/search?q=${encodeURIComponent(searchText.substring(0, 50))}`;
            logger.info(`🔗 提取的URL: ${url}`);
            
            results.push({
                title: "搜索结果",
                url,
                snippet: searchText.substring(0, 300) + (searchText.length > 300 ? '...' : ''),
                source: 'websearch'
            });
            logger.info(`✅ 创建了1个原始文本结果`);
        }
        
    } catch (parseError) {
        logger.error(`❌ 解析搜索结果时发生错误: ${(parseError as Error).message}`);
        
        // 降级：将原始文本作为搜索结果返回
        logger.info(`🔄 使用降级方案创建结果...`);
        if (searchText.trim()) {
            results.push({
                title: "搜索结果",
                url: `https://www.google.com/search?q=${encodeURIComponent(searchText.substring(0, 50))}`,
                snippet: searchText.substring(0, 300) + (searchText.length > 300 ? '...' : ''),
                source: 'websearch_raw'
            });
            logger.info(`✅ 创建了1个降级结果`);
        }
    }
    
    const finalResults = results.slice(0, maxResults);
    logger.info(`📤 解析完成，返回 ${finalResults.length} 个结果 (限制: ${maxResults})`);
    finalResults.forEach((result, index) => {
        logger.info(`📋 最终结果 ${index + 1}: "${result.title}" -> ${result.url} [${result.source}]`);
    });
    
    return finalResults;
}

/**
 * 🔧 内部辅助函数：计算文件相关性分数
 */
function _calculateRelevanceScore(queryLower: string, fileName: string, content: string): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    const fileNameLower = fileName.toLowerCase();

    // 文件名匹配 (高权重)
    if (fileNameLower.includes(queryLower)) {
        score += 50;
    }

    // 查询词在内容中的频率
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
        if (word.length > 2) { // 忽略太短的词
            const regex = new RegExp(word, 'gi');
            const matches = content.match(regex);
            if (matches) {
                score += matches.length * 2;
            }
        }
    }

    // 特殊关键词加权
    const specialKeywords = ['srs', 'requirement', '需求', 'template', '模板'];
    for (const keyword of specialKeywords) {
        if (contentLower.includes(keyword)) {
            score += 10;
        }
    }

    return score;
}

/**
 * 🔧 内部辅助函数：提取相关文本片段
 */
function _extractRelevantExcerpts(queryLower: string, content: string, maxExcerpts: number = 3): string[] {
    const lines = content.split('\n');
    const excerpts: Array<{ line: string; score: number; index: number }> = [];

    lines.forEach((line, index) => {
        const lineLower = line.toLowerCase();
        let score = 0;

        // 计算每行的相关性
        const queryWords = queryLower.split(/\s+/);
        for (const word of queryWords) {
            if (word.length > 2 && lineLower.includes(word)) {
                score += 1;
            }
        }

        if (score > 0 && line.trim().length > 10) {
            excerpts.push({ line: line.trim(), score, index });
        }
    });

    // 排序并取前几个最相关的片段
    excerpts.sort((a, b) => b.score - a.score);
    return excerpts.slice(0, maxExcerpts).map(e => e.line);
}

/**
 * 获取当前工作区文件夹
 */
function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0];
}

// ============================================================================
// VSCode Language Model Tool 实现类
// ============================================================================

// 定义输入类型接口
interface InternetSearchInput {
    query: string;
    maxResults?: number;
    searchType?: 'general' | 'technical' | 'documentation';
}

interface CustomRAGInput {
    query: string;
    domain?: string;
    maxResults?: number;
}

// LocalKnowledgeInput接口已移除 - readLocalKnowledge工具不再需要Language Model Tool包装类

/**
 * Internet Search Tool Implementation
 * 包装 internetSearch 函数为 VSCode LanguageModelTool
 */
export class InternetSearchTool implements vscode.LanguageModelTool<InternetSearchInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<InternetSearchInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            logger.info(`🔧 InternetSearchTool.invoke called with query: "${options.input.query}"`);
            
            const result = await internetSearch({
                query: options.input.query,
                maxResults: options.input.maxResults || 5,
                searchType: options.input.searchType || 'general',
                toolInvocationToken: options.toolInvocationToken
            });

            if (result.success && result.results) {
                // 格式化搜索结果为markdown
                let content = `## 搜索结果：${options.input.query}\n\n`;
                
                result.results.forEach((item, index) => {
                    content += `### ${index + 1}. [${item.title}](${item.url})\n`;
                    content += `${item.snippet}\n`;
                    content += `*来源: ${item.source}*\n\n`;
                });

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(content)
                ]);
            } else {
                const errorMsg = result.error || '搜索未返回结果';
                logger.error(`InternetSearchTool failed: ${errorMsg}`);
                
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`❌ 搜索失败: ${errorMsg}`)
                ]);
            }
        } catch (error) {
            const errorMsg = `InternetSearchTool error: ${(error as Error).message}`;
            logger.error(errorMsg);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ 工具执行错误: ${errorMsg}`)
            ]);
        }
    }
}

/**
 * Custom RAG Retrieval Tool Implementation
 * 包装 customRAGRetrieval 函数为 VSCode LanguageModelTool
 */
export class CustomRAGRetrievalTool implements vscode.LanguageModelTool<CustomRAGInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<CustomRAGInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            logger.info(`🔧 CustomRAGRetrievalTool.invoke called with query: "${options.input.query}"`);
            
            const result = await customRAGRetrieval({
                query: options.input.query,
                domain: options.input.domain,
                maxResults: options.input.maxResults || 5
            });

            if (result.success && result.results) {
                let content = `## 知识库检索结果：${options.input.query}\n\n`;
                
                result.results.forEach((item, index) => {
                    content += `### ${index + 1}. ${item.source}\n`;
                    content += `${item.content}\n`;
                    content += `*置信度: ${(item.confidence * 100).toFixed(1)}%*\n\n`;
                });

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(content)
                ]);
            } else {
                const errorMsg = result.error || '知识库检索未返回结果';
                logger.warn(`CustomRAGRetrievalTool: ${errorMsg}`);
                
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ 知识库检索: ${errorMsg}`)
                ]);
            }
        } catch (error) {
            const errorMsg = `CustomRAGRetrievalTool error: ${(error as Error).message}`;
            logger.error(errorMsg);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ 工具执行错误: ${errorMsg}`)
            ]);
        }
    }
}

// ReadLocalKnowledgeTool类已移除 - readLocalKnowledge工具现在直接通过内部工具调用系统使用
// 核心的readLocalKnowledge函数保持不变，提供完整的本地知识文件搜索功能

// ============================================================================
// 导出定义和实现
// ============================================================================

export const knowledgeToolDefinitions = [
    readLocalKnowledgeToolDefinition,
    internetSearchToolDefinition,  // 通过 accessibleBy: [] 禁用
    enterpriseRAGCallToolDefinition,
    customRAGRetrievalToolDefinition
];

export const knowledgeToolImplementations = {
    readLocalKnowledge,
    internetSearch,  // 通过 accessibleBy: [] 禁用
    enterpriseRAGCall,
    customRAGRetrieval
}; 