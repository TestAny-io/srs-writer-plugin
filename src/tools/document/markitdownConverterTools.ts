/**
 * MarkItDown 转换器工具
 * Document Layer 工具定义和实现
 */

import { CallerType } from '../../types';
import { Logger } from '../../utils/logger';
import { DocumentScanner } from './markitdownConverter/DocumentScanner';
import { MarkdownConverter } from './markitdownConverter/MarkdownConverter';
import { 
    ConvertOptions, 
    ConvertResult, 
    ScanResult,
    BatchConvertOptions,
    BatchConvertResult
} from './markitdownConverter/types';

const logger = Logger.getInstance();

// ============================================================================
// 工具定义
// ============================================================================

/**
 * 文档转换工具定义
 */
export const markitdownConverterToolDefinitions = [
    {
        name: "convertToMarkdown",
        description: "Convert various file formats (Word, PDF, Excel, images, etc.) to Markdown format using markitdown-ts library. Supports single file conversion with customizable options and automatic output directory management.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to be converted (relative to workspace root). Supported formats: .docx, .pdf, .xlsx, .jpg, .png, .gif, .html, .csv, .xml, .txt"
                },
                outputPath: {
                    type: "string", 
                    description: "Optional output path for the converted markdown file. If not specified, will auto-generate based on input filename and save to ./transformed_doc/ directory"
                },
                options: {
                    type: "object",
                    description: "Conversion options for customizing the conversion process",
                    properties: {
                        enableYoutubeTranscript: {
                            type: "boolean",
                            description: "Enable YouTube transcript extraction for video URLs (default: false)",
                            default: false
                        },
                        youtubeTranscriptLanguage: {
                            type: "string", 
                            description: "Language code for YouTube transcript (default: 'en')",
                            default: "en"
                        },
                        llmModel: {
                            type: "string",
                            description: "LLM model for enhanced image description (optional, requires additional setup)"
                        },
                        llmPrompt: {
                            type: "string",
                            description: "Custom prompt for LLM image description"
                        },
                        preserveOriginal: {
                            type: "boolean",
                            description: "Whether to preserve the original file (default: true)",
                            default: true
                        },
                        postProcess: {
                            type: "boolean",
                            description: "Whether to apply post-processing to clean up the markdown content (default: true)",
                            default: true
                        }
                    }
                }
            },
            required: ["filePath"]
        },
        accessibleBy: [
            // CallerType.ORCHESTRATOR_TOOL_EXECUTION,
            // CallerType.SPECIALIST,
            CallerType.DOCUMENT
        ],
        interactionType: 'autonomous',
        riskLevel: 'medium',
        requiresConfirmation: false,
        layer: 'document',
        category: 'conversion'
    },
    {
        name: "scanWorkspaceDocuments", 
        description: "Scan workspace for convertible documents and return a list of found files with metadata. Useful for discovering available documents before conversion.",
        parameters: {
            type: "object",
            properties: {
                extensions: {
                    type: "array",
                    items: { type: "string" },
                    description: "File extensions to include in scan (e.g., ['.docx', '.pdf', '.xlsx']). Default: ['.docx']",
                    default: [".docx"]
                },
                maxDepth: {
                    type: "number",
                    description: "Maximum directory depth to scan (default: 5)",
                    default: 5,
                    minimum: 1,
                    maximum: 10
                }
            }
        },
        accessibleBy: [
            // CallerType.ORCHESTRATOR_TOOL_EXECUTION,
            // CallerType.SPECIALIST,
            CallerType.DOCUMENT
        ],
        interactionType: 'autonomous',
        riskLevel: 'low',
        requiresConfirmation: false,
        layer: 'document',
        category: 'scan'
    },
    {
        name: "batchConvertToMarkdown",
        description: "Batch convert multiple documents to Markdown format. Efficient for processing multiple files with progress tracking and error handling.",
        parameters: {
            type: "object",
            properties: {
                fileList: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of file paths to convert (relative to workspace root)"
                },
                outputDirectory: {
                    type: "string",
                    description: "Output directory for converted files (default: './transformed_doc')",
                    default: "./transformed_doc"
                },
                options: {
                    type: "object",
                    description: "Batch conversion options",
                    properties: {
                        maxConcurrent: {
                            type: "number",
                            description: "Maximum number of concurrent conversions (default: 3)",
                            default: 3,
                            minimum: 1,
                            maximum: 10
                        },
                        overwriteExisting: {
                            type: "boolean",
                            description: "Whether to overwrite existing output files (default: true)",
                            default: true
                        },
                        postProcess: {
                            type: "boolean",
                            description: "Whether to apply post-processing to all files (default: true)",
                            default: true
                        }
                    }
                }
            },
            required: ["fileList"]
        },
        accessibleBy: [
            // CallerType.SPECIALIST,
            CallerType.DOCUMENT
        ],
        interactionType: 'autonomous',
        riskLevel: 'medium',
        requiresConfirmation: false,
        layer: 'document',
        category: 'batch-conversion'
    },
    {
        name: "previewConversion",
        description: "Preview the conversion result without saving to file. Useful for checking conversion quality before committing to full conversion.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to preview conversion (relative to workspace root)"
                },
                options: {
                    type: "object",
                    description: "Preview options (same as convertToMarkdown options)",
                    properties: {
                        postProcess: {
                            type: "boolean",
                            description: "Whether to apply post-processing in preview (default: true)",
                            default: true
                        }
                    }
                }
            },
            required: ["filePath"]
        },
        accessibleBy: [
            // CallerType.ORCHESTRATOR_TOOL_EXECUTION,
            // CallerType.SPECIALIST,
            CallerType.DOCUMENT
        ],
        interactionType: 'autonomous',
        riskLevel: 'low',
        requiresConfirmation: false,
        layer: 'document',
        category: 'preview'
    }
];

// ============================================================================
// 工具实现
// ============================================================================

/**
 * 工具实现映射
 */
export const markitdownConverterToolImplementations = {
    /**
     * 转换单个文档为Markdown
     */
    async convertToMarkdown(args: {
        filePath: string;
        outputPath?: string;
        options?: ConvertOptions;
    }): Promise<ConvertResult> {
        logger.info(`🔄 Converting document: ${args.filePath}`);
        
        try {
            const converter = new MarkdownConverter();
            const result = await converter.convertFile(args.filePath, args.options || {});
            
            if (result.success) {
                logger.info(`✅ Conversion completed successfully: ${args.filePath} -> ${result.outputPath}`);
            } else {
                logger.warn(`❌ Conversion failed: ${args.filePath} - ${result.error}`);
            }
            
            return result;
            
        } catch (error) {
            logger.error('convertToMarkdown tool failed', error as Error);
            
            return {
                success: false,
                title: null,
                markdownContent: '',
                originalPath: args.filePath,
                metadata: {
                    fileSize: 0,
                    conversionTime: 0,
                    detectedFormat: '',
                    contentLength: 0,
                    timestamp: new Date().toISOString(),
                    isSupported: false
                },
                error: `Conversion failed: ${(error as Error).message}`
            };
        }
    },

    /**
     * 扫描workspace中的文档
     */
    async scanWorkspaceDocuments(args: {
        extensions?: string[];
        maxDepth?: number;
    }): Promise<ScanResult> {
        logger.info(`🔍 Scanning workspace for documents: extensions=${JSON.stringify(args.extensions || ['.docx'])}`);
        
        try {
            const scanner = new DocumentScanner();
            const result = await scanner.scanWorkspaceDocuments(args.extensions || ['.docx']);
            
            logger.info(`✅ Scan completed: found ${result.documents.length} documents`);
            return result;
            
        } catch (error) {
            logger.error('scanWorkspaceDocuments tool failed', error as Error);
            
            return {
                success: false,
                documents: [],
                totalCount: 0,
                directoriesScanned: 0,
                scanTime: 0,
                error: (error as Error).message
            };
        }
    },

    /**
     * 批量转换文档
     */
    async batchConvertToMarkdown(args: {
        fileList: string[];
        outputDirectory?: string;
        options?: {
            maxConcurrent?: number;
            overwriteExisting?: boolean;
            postProcess?: boolean;
        };
    }): Promise<BatchConvertResult[]> {
        logger.info(`🔄 Starting batch conversion: ${args.fileList.length} files`);
        
        try {
            const converter = new MarkdownConverter();
            const scanner = new DocumentScanner();
            
            // 获取文件信息
            const documents = [];
            for (const filePath of args.fileList) {
                const fileInfo = await scanner.getFileInfo(filePath);
                if (fileInfo) {
                    documents.push(fileInfo);
                } else {
                    logger.warn(`File not found or inaccessible: ${filePath}`);
                }
            }
            
            // 执行批量转换
            const batchOptions: BatchConvertOptions = {
                fileExtensions: [], // 不限制，因为已经有了具体文件列表
                outputDirectory: args.outputDirectory || './transformed_doc',
                maxConcurrent: args.options?.maxConcurrent || 3,
                overwriteExisting: args.options?.overwriteExisting !== false
            };
            
            const results = await converter.batchConvert(documents, batchOptions);
            
            const successCount = results.filter(r => r.success).length;
            logger.info(`✅ Batch conversion completed: ${successCount}/${args.fileList.length} files converted successfully`);
            
            return results;
            
        } catch (error) {
            logger.error('batchConvertToMarkdown tool failed', error as Error);
            
            // 返回失败结果
            return args.fileList.map(filePath => ({
                inputFile: filePath,
                outputFile: '',
                success: false,
                error: (error as Error).message
            }));
        }
    },

    /**
     * 预览转换结果
     */
    async previewConversion(args: {
        filePath: string;
        options?: ConvertOptions;
    }): Promise<{
        success: boolean;
        preview: string;
        metadata?: any;
        error?: string;
    }> {
        logger.info(`👁️ Previewing conversion: ${args.filePath}`);
        
        try {
            const converter = new MarkdownConverter();
            const result = await converter.previewConversion(args.filePath, args.options || {});
            
            if (result.success) {
                logger.info(`✅ Preview generated successfully: ${args.filePath}`);
            } else {
                logger.warn(`❌ Preview generation failed: ${args.filePath} - ${result.error}`);
            }
            
            return result;
            
        } catch (error) {
            logger.error('previewConversion tool failed', error as Error);
            
            return {
                success: false,
                preview: '',
                error: (error as Error).message
            };
        }
    }
};

// ============================================================================
// 工具分类信息
// ============================================================================

/**
 * 工具分类信息
 */
export const markitdownConverterToolsCategory = {
    name: 'markitdownConverter',
    description: '文档转换工具集：将各种文件格式转换为Markdown，支持独立使用和编程调用',
    tools: markitdownConverterToolDefinitions.map(def => def.name),
    layer: 'document',
    features: [
        '单文件转换',
        '批量转换',
        '文档扫描',
        '转换预览',
        '格式检查',
        '进度跟踪',
        'VS Code集成',
        '错误处理'
    ],
    supportedFormats: {
        implemented: ['.docx', '.pdf', '.xlsx', '.jpg', '.png', '.gif', '.html', '.csv', '.xml', '.txt'],
        planned: ['.pptx', '.mp3', '.wav', '.ipynb', '.zip']
    },
    configuration: {
        defaultOutputDir: './transformed_doc',
        maxFileSize: '100MB',
        maxConcurrentConversions: 3,
        postProcessingEnabled: true
    }
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取工具状态信息
 */
export async function getConverterStatus(): Promise<{
    isReady: boolean;
    supportedFormats: string[];
    recentActivity: string;
    configurationStatus: string;
}> {
    try {
        const converter = new MarkdownConverter();
        const scanner = new DocumentScanner();
        
        // 检查基本功能
        const supportedFormats = converter.getSupportedFormats();
        
        // 快速扫描检查
        const quickScan = await scanner.scanWorkspaceDocuments(['.docx']);
        
        return {
            isReady: true,
            supportedFormats,
            recentActivity: `Found ${quickScan.documents.length} convertible documents`,
            configurationStatus: 'Ready'
        };
        
    } catch (error) {
        logger.error('Failed to get converter status', error as Error);
        
        return {
            isReady: false,
            supportedFormats: [],
            recentActivity: 'Status check failed',
            configurationStatus: `Error: ${(error as Error).message}`
        };
    }
}

/**
 * 验证工具依赖
 */
export function validateDependencies(): {
    isValid: boolean;
    missingDependencies: string[];
    warnings: string[];
} {
    const missingDependencies: string[] = [];
    const warnings: string[] = [];
    
    try {
        // 检查markitdown-ts是否可用
        require('markitdown-ts');
    } catch (error) {
        missingDependencies.push('markitdown-ts');
    }
    
    // 检查VS Code API
    try {
        require('vscode');
    } catch (error) {
        missingDependencies.push('vscode');
    }
    
    // 检查其他依赖
    const optionalDependencies = ['youtube-transcript', 'unzipper'];
    for (const dep of optionalDependencies) {
        try {
            require(dep);
        } catch (error) {
            warnings.push(`Optional dependency ${dep} not available - some features may be limited`);
        }
    }
    
    return {
        isValid: missingDependencies.length === 0,
        missingDependencies,
        warnings
    };
}