/**
 * Markdown转换器
 * 核心转换引擎，负责将各种文档格式转换为Markdown
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { MarkItDown } from 'markitdown-ts';
import { Logger } from '../../../utils/logger';
import { 
    ConvertOptions, 
    ConvertResult, 
    ConversionMetadata, 
    BatchConvertOptions, 
    BatchConvertResult,
    ConverterError,
    ConverterErrorType,
    DocumentInfo
} from './types';
import { 
    DEFAULT_CONFIG,
    isSupportedFormat,
    validateFilePath,
    validateFileSize,
    ensureDirectoryExists,
    cleanMarkdownContent,
    extractTitleFromPath,
    generateOutputPath,
    getAbsolutePath,
    getRelativePath,
    createProgressReporter
} from './utils';

const logger = Logger.getInstance();

/**
 * Markdown转换器类
 */
export class MarkdownConverter {
    private markitdown: MarkItDown;
    private config = DEFAULT_CONFIG;

    constructor() {
        this.markitdown = new MarkItDown();
        logger.info('MarkdownConverter initialized with markitdown-ts');
    }

    /**
     * 转换单个文件
     */
    async convertFile(filePath: string, options: ConvertOptions = {}): Promise<ConvertResult> {
        const startTime = Date.now();
        
        try {
            logger.info(`🔄 Starting conversion: ${filePath}`);

            // Step 1: 验证输入
            await this.validateInput(filePath, options);

            // Step 2: 准备输出路径
            const outputPath = await this.prepareOutputPath(filePath, options);

            // Step 3: 执行转换
            const rawResult = await this.performConversion(filePath, options);

            // Step 4: 后处理
            const processedContent = this.postProcessContent(rawResult.text_content, options);

            // Step 5: 保存文件
            await this.saveConvertedContent(outputPath, processedContent);

            // Step 6: 构建结果
            const conversionTime = Date.now() - startTime;
            const result = await this.buildConvertResult(
                filePath,
                outputPath,
                rawResult.title,
                processedContent,
                conversionTime
            );

            logger.info(`✅ Conversion completed: ${filePath} -> ${outputPath} (${conversionTime}ms)`);
            return result;

        } catch (error) {
            const conversionTime = Date.now() - startTime;
            const errorMessage = this.handleConversionError(error, filePath);
            
            logger.error(`❌ Conversion failed: ${filePath}`, error as Error);

            return this.buildErrorResult(filePath, errorMessage, conversionTime);
        }
    }

    /**
     * 批量转换文件
     */
    async batchConvert(
        documents: DocumentInfo[], 
        options: BatchConvertOptions
    ): Promise<BatchConvertResult[]> {
        logger.info(`🔄 Starting batch conversion: ${documents.length} files`);

        const results: BatchConvertResult[] = [];
        const { maxConcurrent = 3, onProgress } = options;

        // 确保输出目录存在
        await ensureDirectoryExists(options.outputDirectory);

        // 创建进度报告器
        const progressReporter = onProgress ? createProgressReporter(
            documents.length,
            (current, percentage, message) => onProgress(current, documents.length, message)
        ) : null;

        // 分批处理文件（控制并发数）
        const batches = this.createBatches(documents, maxConcurrent);

        for (const batch of batches) {
            const batchPromises = batch.map(async (document) => {
                try {
                    const outputPath = path.join(
                        options.outputDirectory,
                        `${path.basename(document.name, document.extension)}.md`
                    );

                    progressReporter?.increment(`Converting ${document.name}...`);

                    const result = await this.convertFile(document.absolutePath, {
                        outputPath,
                        postProcess: true
                    });

                    return {
                        inputFile: document.path,
                        outputFile: getRelativePath(outputPath),
                        success: result.success,
                        metadata: result.metadata,
                        error: result.error
                    };

                } catch (error) {
                    return {
                        inputFile: document.path,
                        outputFile: '',
                        success: false,
                        error: (error as Error).message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        progressReporter?.complete('Batch conversion completed');

        const successCount = results.filter(r => r.success).length;
        logger.info(`✅ Batch conversion completed: ${successCount}/${documents.length} files converted successfully`);

        return results;
    }

    /**
     * 验证输入参数
     */
    private async validateInput(filePath: string, options: ConvertOptions): Promise<void> {
        // 验证文件路径
        await validateFilePath(filePath);

        // 验证文件格式
        if (!isSupportedFormat(filePath, this.config)) {
            const ext = path.extname(filePath).toLowerCase();
            throw new ConverterError(
                ConverterErrorType.UNSUPPORTED_FORMAT,
                `Unsupported file format: ${ext}. Supported formats: ${this.config.supportedFormats.implemented.join(', ')}`,
                filePath
            );
        }

        // 验证文件大小
        const absolutePath = getAbsolutePath(filePath);
        await validateFileSize(absolutePath, this.config.maxFileSize);
    }

    /**
     * 准备输出路径
     */
    private async prepareOutputPath(filePath: string, options: ConvertOptions): Promise<string> {
        const outputPath = options.outputPath || generateOutputPath(filePath, this.config.defaultOutputDir);
        const outputDir = path.dirname(outputPath);
        
        // 确保输出目录存在
        await ensureDirectoryExists(outputDir);

        return getAbsolutePath(outputPath);
    }

    /**
     * 执行实际转换
     */
    private async performConversion(filePath: string, options: ConvertOptions): Promise<any> {
        try {
            const absolutePath = getAbsolutePath(filePath);
            
            // 构建markitdown-ts选项
            const markitdownOptions = {
                enableYoutubeTranscript: options.enableYoutubeTranscript || false,
                youtubeTranscriptLanguage: options.youtubeTranscriptLanguage || 'en',
                llmModel: options.llmModel,
                llmPrompt: options.llmPrompt,
                cleanup_extracted: options.cleanup_extracted !== false
            };

            logger.debug(`Converting file with options: ${JSON.stringify(markitdownOptions)}`);

            const result = await this.markitdown.convert(absolutePath, markitdownOptions);

            if (!result) {
                throw new ConverterError(
                    ConverterErrorType.CONVERSION_FAILED,
                    'markitdown-ts returned null result',
                    filePath
                );
            }

            return result;

        } catch (error) {
            if (error instanceof ConverterError) {
                throw error;
            }

            // 包装markitdown-ts的错误
            throw new ConverterError(
                ConverterErrorType.CONVERSION_FAILED,
                `markitdown-ts conversion failed: ${(error as Error).message}`,
                filePath,
                error as Error
            );
        }
    }

    /**
     * 后处理内容
     */
    private postProcessContent(content: string, options: ConvertOptions): string {
        if (!content) {
            return '';
        }

        if (options.postProcess === false) {
            return content;
        }

        return cleanMarkdownContent(content);
    }

    /**
     * 保存转换后的内容
     */
    private async saveConvertedContent(outputPath: string, content: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(outputPath);
            const buffer = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(uri, buffer);
            
            logger.debug(`Content saved to: ${outputPath}`);
        } catch (error) {
            throw new ConverterError(
                ConverterErrorType.PERMISSION_DENIED,
                `Failed to save converted content: ${(error as Error).message}`,
                outputPath,
                error as Error
            );
        }
    }

    /**
     * 构建转换结果
     */
    private async buildConvertResult(
        inputPath: string,
        outputPath: string,
        title: string | null,
        content: string,
        conversionTime: number
    ): Promise<ConvertResult> {
        const inputUri = vscode.Uri.file(getAbsolutePath(inputPath));
        const inputStats = await vscode.workspace.fs.stat(inputUri);

        const metadata: ConversionMetadata = {
            fileSize: inputStats.size,
            conversionTime,
            detectedFormat: path.extname(inputPath).toLowerCase(),
            contentLength: content.length,
            timestamp: new Date().toISOString(),
            isSupported: true
        };

        return {
            success: true,
            title: title || extractTitleFromPath(inputPath),
            markdownContent: content,
            originalPath: inputPath,
            outputPath: getRelativePath(outputPath),
            metadata
        };
    }

    /**
     * 构建错误结果
     */
    private buildErrorResult(filePath: string, error: string, conversionTime: number): ConvertResult {
        const metadata: ConversionMetadata = {
            fileSize: 0,
            conversionTime,
            detectedFormat: path.extname(filePath).toLowerCase(),
            contentLength: 0,
            timestamp: new Date().toISOString(),
            isSupported: isSupportedFormat(filePath, this.config)
        };

        return {
            success: false,
            title: null,
            markdownContent: '',
            originalPath: filePath,
            metadata,
            error
        };
    }

    /**
     * 处理转换错误
     */
    private handleConversionError(error: any, filePath: string): string {
        if (error instanceof ConverterError) {
            return error.message;
        }

        if (error instanceof Error) {
            // 检查特定的错误模式
            const message = error.message.toLowerCase();
            
            if (message.includes('not supported') || message.includes('unsupported')) {
                return `File format not supported: ${path.extname(filePath)}`;
            }
            
            if (message.includes('permission') || message.includes('access')) {
                return `Permission denied: Cannot access file ${filePath}`;
            }
            
            if (message.includes('not found') || message.includes('enoent')) {
                return `File not found: ${filePath}`;
            }

            return error.message;
        }

        return `Unknown conversion error for file: ${filePath}`;
    }

    /**
     * 创建批处理数组
     */
    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * 检查格式支持状态
     */
    checkFormatSupport(filePath: string): {
        isSupported: boolean;
        format: string;
        reason?: string;
    } {
        const format = path.extname(filePath).toLowerCase();
        const isSupported = isSupportedFormat(filePath, this.config);

        if (!isSupported) {
            const isPlanned = this.config.supportedFormats.planned.includes(format);
            const requiresDeps = this.config.supportedFormats.requiresExtraDeps[format];

            let reason = `Format ${format} is not currently supported`;
            
            if (isPlanned) {
                reason += ' (planned for future release)';
            } else if (requiresDeps) {
                reason += ` (requires additional dependencies: ${requiresDeps.join(', ')})`;
            }

            return { isSupported: false, format, reason };
        }

        return { isSupported: true, format };
    }

    /**
     * 获取支持的格式列表
     */
    getSupportedFormats(): string[] {
        return [...this.config.supportedFormats.implemented];
    }

    /**
     * 获取计划支持的格式列表
     */
    getPlannedFormats(): string[] {
        return [...this.config.supportedFormats.planned];
    }

    /**
     * 预览转换（不保存文件）
     */
    async previewConversion(filePath: string, options: ConvertOptions = {}): Promise<{
        success: boolean;
        preview: string;
        metadata?: ConversionMetadata;
        error?: string;
    }> {
        try {
            // 验证输入但不保存文件
            await this.validateInput(filePath, options);

            const rawResult = await this.performConversion(filePath, options);
            const processedContent = this.postProcessContent(rawResult.text_content, options);

            // 只返回前1000个字符作为预览
            const preview = processedContent.length > 1000 
                ? processedContent.substring(0, 1000) + '\n\n... (content truncated for preview)'
                : processedContent;

            const inputUri = vscode.Uri.file(getAbsolutePath(filePath));
            const inputStats = await vscode.workspace.fs.stat(inputUri);

            const metadata: ConversionMetadata = {
                fileSize: inputStats.size,
                conversionTime: 0,
                detectedFormat: path.extname(filePath).toLowerCase(),
                contentLength: processedContent.length,
                timestamp: new Date().toISOString(),
                isSupported: true
            };

            return {
                success: true,
                preview,
                metadata
            };

        } catch (error) {
            return {
                success: false,
                preview: '',
                error: this.handleConversionError(error, filePath)
            };
        }
    }
}