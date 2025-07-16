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
    requiresConfirmation: false
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
    // 🚀 访问控制：互联网搜索主要用于聊天和执行任务
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 需要最新信息的任务
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA     // "最新的软件工程趋势是什么？"现在归入知识问答模式
    ]
};

export async function internetSearch(args: {
    query: string;
    maxResults?: number;
    searchType?: 'general' | 'technical' | 'documentation';
    toolInvocationToken?: vscode.ChatRequestTurn;
}): Promise<{
    success: boolean;
    results?: Array<{
        title: string;
        url: string;
        snippet: string;
        source: string;
    }>;
    error?: string;
}> {
    try {
        const maxResults = args.maxResults || 5;

        // 1. 优先尝试 VS Code Web Search 工具
        if (vscode.lm && typeof vscode.lm.invokeTool === 'function') {
            try {
                logger.info(`🔍 Calling VS Code websearch tool for: "${args.query}"`);
                
                // 直接尝试调用 websearch 工具  
                const searchResult = await vscode.lm.invokeTool(
                    'websearch',
                    { 
                        input: { query: args.query },
                        toolInvocationToken: undefined
                    }
                );
                
                // 处理搜索结果 - LanguageModelToolResult包含文本部分数组
                let searchText = '';
                if (searchResult && searchResult.content) {
                    for (const part of searchResult.content) {
                        if ((part as any).value) {
                            searchText += (part as any).value;
                        }
                    }
                }
                
                // 解析搜索结果为结构化数据
                const results = parseWebSearchResults(searchText, maxResults);
                
                if (results.length > 0) {
                    logger.info(`✅ VS Code websearch returned ${results.length} results`);
                    return { success: true, results };
                } else {
                    logger.warn('VS Code websearch returned empty results');
                    // 继续尝试降级方案
                }
                
            } catch (toolError) {
                logger.warn(`VS Code websearch failed: ${(toolError as Error).message}`);
                // 继续尝试降级方案
            }
        }
        
        // 2. 检查Web Search扩展是否已安装
        const webSearchExtension = vscode.extensions.getExtension('ms-vscode.vscode-websearchforcopilot');
        if (!webSearchExtension) {
            logger.warn('Web Search for Copilot extension not installed');
            return {
                success: true,
                results: [{
                    title: "安装搜索扩展获取实时信息",
                    url: "https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-websearchforcopilot",
                    snippet: `抱歉，无法获取"${args.query}"的实时信息。请安装 "Web Search for Copilot" 扩展以启用网络搜索功能。\n\n安装步骤：\n1. 点击上方链接访问扩展商店\n2. 安装 "Web Search for Copilot" 扩展\n3. 配置 Tavily 或 Bing API 密钥\n4. 重新尝试搜索`,
                    source: "installation_guide"
                }]
            };
        }
        
        // 3. 扩展已安装但工具可能未配置
        const config = vscode.workspace.getConfiguration('websearch');
        const preferredEngine = config.get<string>('preferredEngine', 'tavily');
        
        logger.info(`Web Search extension installed, preferred engine: ${preferredEngine}`);
        return {
            success: true,
            results: [{
                title: "配置Web Search扩展",
                url: `https://www.google.com/search?q=${encodeURIComponent(args.query)}`,
                snippet: `Web Search for Copilot 扩展已安装，但可能需要配置API密钥：\n1. 当前搜索引擎设置：${preferredEngine}\n2. 请确保已配置 ${preferredEngine === 'tavily' ? 'Tavily' : 'Bing'} API 密钥\n3. 或点击此链接在浏览器中搜索：${args.query}`,
                source: "configuration_guide"
            }]
        };
        
    } catch (error) {
        const errorMsg = `Failed to perform internet search: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
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
    requiresConfirmation: false
};

export async function enterpriseRAGCall(args: {
    query: string;
    domain?: string;
    maxResults?: number;
}): Promise<{
    success: boolean;
    results?: Array<{
        content: string;
        source: string;
        confidence: number;
        metadata?: any;
    }>;
    error?: string;
}> {
    try {
        // 检查企业RAG配置
        const config = vscode.workspace.getConfiguration('srsWriter.rag.enterprise');
        const endpoint = config.get<string>('endpoint');
        const apiKey = config.get<string>('apiKey');
        const enabled = config.get<boolean>('enabled', false);

        if (!enabled || !endpoint) {
            return {
                success: false,
                error: 'Enterprise RAG system is not configured or enabled'
            };
        }

        logger.info(`🏢 Calling enterprise RAG system for: "${args.query}"`);

        // 构造请求
        const requestBody = {
            query: args.query,
            domain: args.domain,
            max_results: args.maxResults || 5,
            include_metadata: true
        };

        // 构造请求头
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // 发送HTTP请求到企业RAG系统
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Enterprise RAG API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as any;
        
        // 标准化响应格式
        const results = Array.isArray(data?.results) ? data.results : [];
        const formattedResults = results.map((item: any) => ({
            content: item.content || item.text || '',
            source: item.source || 'enterprise_rag',
            confidence: item.confidence || item.score || 0.5,
            metadata: item.metadata || {}
        }));

        logger.info(`✅ Enterprise RAG returned ${formattedResults.length} results`);
        return { success: true, results: formattedResults };

    } catch (error) {
        const errorMsg = `Failed to call enterprise RAG system: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 🚀 企业自定义RAG检索工具 - 纯原子层实现
 */
export const customRAGRetrievalToolDefinition = {
    name: "customRAGRetrieval",
    description: "Retrieve information from enterprise/custom RAG knowledge base system",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query for knowledge retrieval"
            },
            domain: {
                type: "string",
                description: "Business domain context (e.g., 'financial_services', 'healthcare', 'e-commerce')"
            },
            maxResults: {
                type: "number",
                description: "Maximum number of results to return (default: 5)"
            }
        },
        required: ["query"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：知识检索是安全操作，支持所有知识相关模式
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 执行模式中的知识增强
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答的核心工具（现在包含通用对话）
        // CallerType.SPECIALIST,                    // 专家内容生成支持
        // CallerType.DOCUMENT                       // 文档层可能需要知识支持
    ]
};

export async function customRAGRetrieval(args: {
    query: string;
    domain?: string;
    maxResults?: number;
}): Promise<{
    success: boolean;
    results?: Array<{
        content: string;
        source: string;
        confidence: number;
        metadata?: any;
    }>;
    error?: string;
}> {
    try {
        logger.info(`🔍 Custom RAG retrieval for: "${args.query}"`);
        
        // 直接委托给 enterpriseRAGCall，保持原子层的简单性
        const result = await enterpriseRAGCall({
            query: args.query,
            domain: args.domain,
            maxResults: args.maxResults || 5
        });
        
        if (result.success) {
            logger.info(`✅ Custom RAG found ${result.results?.length || 0} results`);
        } else {
            logger.warn(`⚠️ Custom RAG retrieval failed: ${result.error}`);
        }
        
        return result;
    } catch (error) {
        const errorMsg = `Custom RAG retrieval failed: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
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
    const results: Array<{title: string; url: string; snippet: string; source: string}> = [];
    
    try {
        // 方案1: 尝试解析 markdown 链接格式
        const linkMatches = searchText.match(/\[([^\]]+)\]\(([^)]+)\)/g);
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
        if (results.length === 0 && searchText.trim()) {
            const urlMatch = searchText.match(/(https?:\/\/[^\s\)]+)/);
            const url = urlMatch ? urlMatch[1] : `https://www.google.com/search?q=${encodeURIComponent(searchText.substring(0, 50))}`;
            
            results.push({
                title: "搜索结果",
                url,
                snippet: searchText.substring(0, 300) + (searchText.length > 300 ? '...' : ''),
                source: 'websearch'
            });
        }
        
    } catch (parseError) {
        logger.warn(`Failed to parse search results: ${(parseError as Error).message}`);
        
        // 降级：将原始文本作为搜索结果返回
        if (searchText.trim()) {
            results.push({
                title: "搜索结果",
                url: `https://www.google.com/search?q=${encodeURIComponent(searchText.substring(0, 50))}`,
                snippet: searchText.substring(0, 300) + (searchText.length > 300 ? '...' : ''),
                source: 'websearch_raw'
            });
        }
    }
    
    return results.slice(0, maxResults);
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

interface LocalKnowledgeInput {
    query: string;
    searchPaths?: string[];
    fileExtensions?: string[];
    maxResults?: number;
}

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

/**
 * Local Knowledge Search Tool Implementation
 * 包装 readLocalKnowledge 函数为 VSCode LanguageModelTool
 */
export class ReadLocalKnowledgeTool implements vscode.LanguageModelTool<LocalKnowledgeInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<LocalKnowledgeInput>,
        token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        try {
            logger.info(`🔧 ReadLocalKnowledgeTool.invoke called with query: "${options.input.query}"`);
            
            const result = await readLocalKnowledge({
                query: options.input.query,
                searchPaths: options.input.searchPaths || ['templates/', 'knowledge/'],
                fileExtensions: options.input.fileExtensions || ['.md', '.yml', '.yaml', '.json'],
                maxResults: options.input.maxResults || 10
            });

            if (result.success && result.results) {
                let content = `## 本地知识文件检索结果：${options.input.query}\n\n`;
                
                result.results.forEach((item, index) => {
                    content += `### ${index + 1}. ${item.filePath}\n`;
                    content += `*相关性: ${item.relevanceScore.toFixed(1)}*\n\n`;
                    
                    // 显示相关片段
                    if (item.excerpts && item.excerpts.length > 0) {
                        content += `**相关内容片段:**\n`;
                        item.excerpts.forEach(excerpt => {
                            content += `> ${excerpt}\n`;
                        });
                        content += '\n';
                    }
                    
                    // 显示完整内容（截断处理）
                    const truncatedContent = item.content.length > 500 
                        ? item.content.substring(0, 500) + '...'
                        : item.content;
                    content += `**文件内容:**\n\`\`\`\n${truncatedContent}\n\`\`\`\n\n`;
                });

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(content)
                ]);
            } else {
                const errorMsg = result.error || '本地知识文件检索未返回结果';
                logger.warn(`ReadLocalKnowledgeTool: ${errorMsg}`);
                
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(`ℹ️ 本地知识检索: ${errorMsg}`)
                ]);
            }
        } catch (error) {
            const errorMsg = `ReadLocalKnowledgeTool error: ${(error as Error).message}`;
            logger.error(errorMsg);
            
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`❌ 工具执行错误: ${errorMsg}`)
            ]);
        }
    }
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const knowledgeToolDefinitions = [
    readLocalKnowledgeToolDefinition,
    internetSearchToolDefinition,
    enterpriseRAGCallToolDefinition,
    customRAGRetrievalToolDefinition
];

export const knowledgeToolImplementations = {
    readLocalKnowledge,
    internetSearch,
    enterpriseRAGCall,
    customRAGRetrieval
}; 