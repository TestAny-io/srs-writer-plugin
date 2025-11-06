/**
 * 提示词组装引擎
 * 
 * 核心功能：
 * 1. 动态组装一致的specialist提示词
 * 2. 确保模板间的一致性
 * 3. 降低提示词维护成本
 * 4. 支持模板验证和质量监控
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../../utils/logger';
import { getSpecialistRegistry } from '../specialistRegistry';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import { getSupportedSpecialistExtensions, filterSpecialistFiles } from '../../utils/fileExtensions';

export interface SpecialistType {
  name: string;
  category: 'content' | 'process';
}

export interface EnvironmentContext {
  projectDirectory: string;
  projectFiles: FileInfo[];
}

export interface FileInfo {
  name: string;
  isDirectory: boolean;
  relativePath: string;
}

export interface SpecialistContext {
  userRequirements?: string;
  language?: string;  // 🚀 新增：明确定义language字段，用于指定specialist输出的语言
  workflow_mode?: "greenfield" | "brownfield";  // 🚀 新增：工作流模式，用于区分新建项目或修改现有项目
  structuredContext?: any;
  projectMetadata?: any;
  // 🚀 新增：迭代状态信息，用于让AI了解资源约束
  iterationInfo?: {
    currentIteration: number;
    maxIterations: number;
    remainingIterations: number;
    phase: 'early' | 'middle' | 'final';
    strategyGuidance: string;
  };
  // 🚀 新增：项目文件内容
  SRS_CONTENT?: string;
  CURRENT_SRS?: string;
  // 🚀 新增：SRS目录结构（ToC格式）
  SRS_TOC?: string;
  CURRENT_SRS_TOC?: string;
  REQUIREMENTS_YAML_CONTENT?: string;
  CURRENT_REQUIREMENTS_YAML?: string;
  [key: string]: any;
}

export interface AssemblyConfig {
  include_base?: string[];
  exclude_base?: string[];
  domain_template?: string;
  // ⚠️ DEPRECATED: 使用新的SpecialistRegistry系统
  /** @deprecated 使用SpecialistRegistry中的category字段 */
  specialist_type?: string;
  /** @deprecated 使用SpecialistRegistry中的name字段 */
  specialist_name?: string;
  // 🚀 v3.0新增：角色定义配置
  role_definition?: string;
  // 🚀 v5.0新增：workflow_mode配置，支持根据不同工作流模式过滤内容
  workflow_mode_config?: {
    greenfield?: string;   // 例如 "GREEN"
    brownfield?: string;   // 例如 "BROWN"
  };
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
  templateCount: number;
  lastValidated: Date;
}

export interface ValidationIssue {
  type: 'missing_template' | 'format_error' | 'inconsistency' | 'system_error';
  message: string;
  severity: 'error' | 'warning' | 'info';
  templatePath?: string;
}

export interface TemplateStructure {
  totalTemplates: number;
  baseTemplates: string[];
  domainTemplates: string[];
  specialistTemplates: string[];
}

export class PromptAssemblyEngine {
  private templateCache = new Map<string, string>();
  private logger = Logger.getInstance();
  
  constructor(
    private templateBasePath: string = './rules' // 注意：应该传入绝对路径，这个默认值仅用于测试
  ) {
    // this.logger.info(`🚀 PromptAssemblyEngine初始化，模板路径: ${templateBasePath}`);
  }

  /**
   * 组装specialist的完整prompt
   */
  async assembleSpecialistPrompt(
    specialistType: SpecialistType,
    context: SpecialistContext
  ): Promise<string> {
    this.logger.info(`🔥 [PromptAssembly] === 开始组装 ${specialistType.name} 提示词 ===`);
    
    // 🔍 详细记录输入信息
    this.logger.info(`🔍 [PromptAssembly] 输入参数:`);
    //this.logger.info(`🔍 [PromptAssembly] - specialistType: ${JSON.stringify(specialistType, null, 2)}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.userRequirements: ${context.userRequirements || '无'}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.structuredContext存在: ${!!context.structuredContext}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.projectMetadata存在: ${!!context.projectMetadata}`);
    
    if (context.structuredContext) {
      // this.logger.info(`🔍 [PromptAssembly] - structuredContext内容: ${JSON.stringify(context.structuredContext, null, 2)}`);
    }
    
    if (context.projectMetadata) {
      // this.logger.info(`🔍 [PromptAssembly] - projectMetadata内容: ${JSON.stringify(context.projectMetadata, null, 2)}`);
    }

    try {
      // 1. 加载专家模板并解析配置
      //this.logger.info(`📄 [PromptAssembly] 步骤1: 加载专家模板并解析配置`);
      const { content: specificTemplate, config } = await this.loadSpecificTemplateWithConfig(
        specialistType.name,
        specialistType,
        context
      );
      
      //this.logger.info(`🔍 [PromptAssembly] 专家模板配置解析结果:`);
      //this.logger.info(`🔍 [PromptAssembly] - config: ${JSON.stringify(config, null, 2)}`);
      //this.logger.info(`🔍 [PromptAssembly] - 专家模板长度: ${specificTemplate.length} 字符`);
      //this.logger.info(`🔍 [PromptAssembly] - 专家模板前200字符: ${specificTemplate.substring(0, 200)}`);
      
      // 🚀 v4.0: 首先获取动态配置（包括template_config）
      let dynamicSpecialistName = specialistType.name;
      let dynamicTemplateConfig: { include_base?: string[]; exclude_base?: string[] } = {};
      try {
        const registry = getSpecialistRegistry();
        const specialist = registry.getSpecialist(specialistType.name);
        if (specialist?.config) {
          if (specialist.config.name) {
            dynamicSpecialistName = specialist.config.name;
          }
          if (specialist.config.template_config) {
            dynamicTemplateConfig = specialist.config.template_config;
            this.logger.info(`🎨 [PromptAssembly] 使用specialist动态模版配置: include_base=${JSON.stringify(dynamicTemplateConfig.include_base)}, exclude_base=${JSON.stringify(dynamicTemplateConfig.exclude_base)}`);
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ [PromptAssembly] 无法从registry获取specialist配置: ${(error as Error).message}`);
      }
      
      const enhancedConfig = {
        ...config,
        specialist_name: config.specialist_name || dynamicSpecialistName,
        // 🚀 v4.0: 动态template_config优先级高于静态config
        include_base: dynamicTemplateConfig.include_base || config.include_base,
        exclude_base: dynamicTemplateConfig.exclude_base || config.exclude_base
      };

      // 2. 根据配置选择性加载base模板（使用增强配置包含动态template_config）
      //this.logger.info(`📄 [PromptAssembly] 步骤2: 根据配置加载base模板`);
      const baseTemplates = await this.loadBaseTemplatesByConfig(enhancedConfig);
      
      //this.logger.info(`🔍 [PromptAssembly] base模板加载结果:`);
      this.logger.info(`🔍 [PromptAssembly] - 加载的模板数量: ${baseTemplates.length}`);
      baseTemplates.forEach((template, index) => {
        this.logger.info(`🔍 [PromptAssembly] - base模板${index + 1}长度: ${template.length} 字符`);
      });
      
      // 3. 🚀 移除domain模板加载（根据用户反馈，当前不使用domain模板）
      //this.logger.info(`📄 [PromptAssembly] 步骤3: 跳过domain模板加载`);
      const domainTemplate = ''; // 直接使用空字符串，不再加载domain模板
      
      //this.logger.info(`🔍 [PromptAssembly] domain模板已跳过加载`);
      //this.logger.info(`🔍 [PromptAssembly] - domain模板长度: ${domainTemplate.length} 字符`);
      
      // 🚀 新增步骤3.5：收集环境感知信息
      this.logger.info(`📄 [PromptAssembly] 步骤3.5: 收集环境感知信息`);
      const environmentContext = await this.gatherEnvironmentContext(context);
      
      // 🚀 新增步骤3.6：为需要SRS内容的specialist动态加载当前项目SRS内容
      // Content specialist默认需要，某些Process specialist（如requirement_syncer）也需要
      const needsSRSContent = specialistType.category === 'content' || 
                              ['requirement_syncer'].includes(specialistType.name);

      if (needsSRSContent) {
        await this.loadProjectSRSContent(context);
      }
      
      // 4. 组装最终prompt - 🚀 新架构：分离base和content模板
      //this.logger.info(`📄 [PromptAssembly] 步骤4: 合并所有模板`);
      
      // 🚀 新架构：分离模板组
      const contentTemplates = [domainTemplate, specificTemplate].filter(t => t.trim().length > 0);
      const allTemplates = [...baseTemplates, ...contentTemplates]; // 保持向后兼容的统计
      
      //this.logger.info(`🔍 [PromptAssembly] 合并前模板统计:`);
      //this.logger.info(`🔍 [PromptAssembly] - Content模板数量: ${contentTemplates.length}`);
      //this.logger.info(`🔍 [PromptAssembly] - Base模板数量: ${baseTemplates.length}`);
      //this.logger.info(`🔍 [PromptAssembly] - 总模板数量: ${allTemplates.length}`);
      //this.logger.info(`🔍 [PromptAssembly] - 各模板长度: content=[${contentTemplates.map(t => t.length).join(', ')}], base=[${baseTemplates.map(t => t.length).join(', ')}]`);
      
      // 🚀 v3.0: 增强配置已在上面创建，这里直接使用
      
      // 🚀 使用新的模板分组方式调用mergeTemplates，传入环境上下文
      const assembledPrompt = this.mergeTemplates(allTemplates, context, enhancedConfig, baseTemplates, contentTemplates, environmentContext);
      
      // 5. 验证组装结果
      this.logger.info(`📄 [PromptAssembly] 步骤5: 验证组装结果`);
      await this.validateAssembledPrompt(assembledPrompt);
      
      // 🚀 v5.0: 验证结构化格式（10部分结构）
      this.logger.debug(`🎯 [PromptAssembly] 提示词结构验证:`);
      this.logger.debug(`🎯 [PromptAssembly] - Table of Contents: ${assembledPrompt.includes('Table of Contents:') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 1. SPECIALIST INSTRUCTIONS: ${assembledPrompt.includes('**# 1. SPECIALIST INSTRUCTIONS**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 2. CURRENT TASK: ${assembledPrompt.includes('**# 2. CURRENT TASK**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 3. LATEST RESPONSE FROM USER: ${assembledPrompt.includes('**# 3. LATEST RESPONSE FROM USER**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 4. YOUR PREVIOUS THOUGHTS: ${assembledPrompt.includes('**# 4. YOUR PREVIOUS THOUGHTS**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 5. DYNAMIC CONTEXT: ${assembledPrompt.includes('**# 5. DYNAMIC CONTEXT**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 6. GUIDELINES AND SAMPLE OF TOOLS USING: ${assembledPrompt.includes('**# 6. GUIDELINES AND SAMPLE OF TOOLS USING**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 7. YOUR TOOLS LIST: ${assembledPrompt.includes('**# 7. YOUR TOOLS LIST**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 8. TEMPLATE FOR YOUR CHAPTERS: ${assembledPrompt.includes('**# 8. TEMPLATE FOR YOUR CHAPTERS**') ? '✅' : '❌'}`);
      this.logger.debug(`🎯 [PromptAssembly] - 9. TABLE OF CONTENTS OF CURRENT SRS: ${assembledPrompt.includes('**# 9. TABLE OF CONTENTS OF CURRENT SRS**') ? '✅' : '❌'}`);
      this.logger.info(`🎯 [PromptAssembly] - 10. FINAL INSTRUCTION: ${assembledPrompt.includes('**# 10. FINAL INSTRUCTION**') ? '✅' : '❌'}`);

      // 🚀 v5.0: 记录重构完成
      this.logger.info(`🎯 [PromptAssembly] === v5.0 组装完成 ${specialistType.name} (10部分结构化User消息格式，已优化顺序和内容) ===`);
      this.logger.info(`🎯 [PromptAssembly] 最终提示词统计:`);
      this.logger.info(`🎯 [PromptAssembly] - 总长度: ${assembledPrompt.length} 字符`);
      this.logger.info(`🎯 [PromptAssembly] - 估算token数量: ${Math.ceil(assembledPrompt.length / 4)} tokens`);
      
      // 输出完整的最终提示词（仅在debug模式下）
      this.logger.info(`🔥 [PromptAssembly] === 完整结构化提示词 for ${specialistType.name} ===`);
      this.logger.info(`🔥 [PromptAssembly] ${assembledPrompt}`);
      this.logger.info(`🔥 [PromptAssembly] === 提示词结束 ===`);
      
      return assembledPrompt;
    } catch (error) {
      this.logger.error(`❌ [PromptAssembly] 组装失败 ${specialistType.name}`, error as Error);
      throw new Error(`Failed to assemble prompt for ${specialistType.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }



  /**
   * 加载领域模板
   */
  private async loadDomainTemplate(category: 'content' | 'process'): Promise<string> {
    const templateFile = category === 'content' 
      ? 'content-specialist-base.md'
      : 'process-specialist-base.md';
      
    try {
      const template = await this.loadTemplate(`domain/${templateFile}`);
      //this.logger.info(`✅ [PromptAssembly] 成功加载领域模板: ${templateFile}`);
      return template;
    } catch (error) {
      //this.logger.warn(`⚠️ [PromptAssembly] 领域模板未找到: ${templateFile}, 使用空模板`);
      return ''; // 返回空模板而不是抛出错误
    }
  }

  /**
   * 加载专家特化模板并解析配置
   */
  private async loadSpecificTemplateWithConfig(
    specialistName: string,
    specialistType?: SpecialistType,
    context?: SpecialistContext
  ): Promise<{
    content: string;
    config: AssemblyConfig;
  }> {
    //this.logger.info(`📋 [PromptAssembly] 加载专家模板配置: ${specialistName}`);
    const templateContent = await this.loadSpecificTemplate(specialistName);
    
    // 解析YAML frontmatter
    const config = this.parseYAMLFrontmatter(templateContent);
    
    // 移除frontmatter，返回纯内容
    let content = this.removeFrontmatter(templateContent);
    
    // 🚀 v5.0新增：根据workflow_mode过滤content specialist的内容
    this.logger.debug(`🔍 [PromptAssembly] 过滤检查: category=${specialistType?.category}, workflow_mode=${context?.workflow_mode}, has_config=${!!config.workflow_mode_config}`);
    if (specialistType?.category === 'content' && context?.workflow_mode && config.workflow_mode_config) {
      this.logger.info(`🎨 [PromptAssembly] 开始根据workflow_mode=${context.workflow_mode}过滤content specialist内容`);
      this.logger.debug(`🎨 [PromptAssembly] 过滤配置: ${JSON.stringify(config.workflow_mode_config, null, 2)}`);
      content = this.filterContentByWorkflowMode(content, context.workflow_mode, config);
      this.logger.info(`🎨 [PromptAssembly] 过滤完成，内容长度: ${content.length}字符`);
    } else {
      this.logger.debug(`🔍 [PromptAssembly] 跳过过滤: 不满足过滤条件`);
    }
    
    //this.logger.info(`✅ [PromptAssembly] 专家模板配置解析完成: ${specialistName}`);
    return { content, config };
  }

  /**
   * 加载专家特化模板（原方法，保持向后兼容）
   */
  private async loadSpecificTemplate(specialistName: string): Promise<string> {
    // 🚀 新架构：支持specialists/content/和specialists/process/目录结构，支持 .poml 和 .md 扩展名
    const possiblePaths: string[] = [];
    
    // 为每个目录和每个支持的扩展名生成路径
    const directories = [
      'specialists/content',     // content specialists
      'specialists/process',     // process specialists
      'specialists',             // root specialists (向后兼容)
      'specialist'               // 原设计格式目录 (向后兼容)
    ];
    
    const extensions = getSupportedSpecialistExtensions();
    
    for (const dir of directories) {
      for (const ext of extensions) {
        if (dir === 'specialist') {
          // 原设计格式特殊处理
          possiblePaths.push(`${dir}/${specialistName}-specific${ext}`);
        } else {
          possiblePaths.push(`${dir}/${specialistName}${ext}`);
        }
      }
    }
    
    //this.logger.info(`🔍 [PromptAssembly] 尝试加载专家模板: ${specialistName}, 可能路径: ${possiblePaths.join(', ')}`);
    
    // 尝试每个可能的路径
    for (const relativePath of possiblePaths) {
      try {
        const template = await this.loadTemplate(relativePath);
        //this.logger.info(`✅ [PromptAssembly] 加载专家模板成功: ${relativePath}`);
        return template;
      } catch (error) {
        //this.logger.debug(`🔍 [PromptAssembly] 路径不存在: ${relativePath}`);
        // 继续尝试下一个路径
        continue;
      }
    }
    
    // 所有路径都失败时的警告
    this.logger.warn(`❌ [PromptAssembly] 所有路径都未找到专家模板: ${specialistName}, 尝试的路径: ${possiblePaths.join(', ')}`);
    return ''; // 返回空模板而不是抛出错误
  }

  /**
   * 根据配置选择性加载base模板
   */
  private async loadBaseTemplatesByConfig(config: AssemblyConfig): Promise<string[]> {
    const allBaseTemplates = [
      'common-role-definition.md',
      'output-format-schema.md',
      'content-specialist-workflow.md',  // 🚀 新增：统一content specialist工作流，支持future exclude模式
      'quality-guidelines.md', 
      'boundary-constraints.md'
    ];
    
    let selectedTemplates: string[];
    
    if (config.include_base && config.include_base.length > 0) {
      // 明确包含模式：只加载指定的模板
      selectedTemplates = config.include_base;
      //this.logger.info(`🔍 [PromptAssembly] 使用包含模式，选择的base模板: ${selectedTemplates.join(', ')}`);
    } else {
      // 默认全部，然后排除指定的模板
      selectedTemplates = allBaseTemplates.filter(
        template => !config.exclude_base?.includes(template)
      );
      //this.logger.info(`🔍 [PromptAssembly] 使用排除模式，排除的base模板: ${config.exclude_base?.join(', ') || '无'}`);
      //this.logger.info(`🔍 [PromptAssembly] 最终选择的base模板: ${selectedTemplates.join(', ')}`);
    }
    
    const templates: string[] = [];
    for (const templateFile of selectedTemplates) {
      try {
        const template = await this.loadTemplate(`base/${templateFile}`);
        templates.push(template);
        //this.logger.info(`✅ [PromptAssembly] 成功加载base模板: ${templateFile} (${template.length}字符)`);
      } catch (error) {
        this.logger.warn(`⚠️ [PromptAssembly] Base模板加载失败: ${templateFile}, 错误: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return templates;
  }

  /**
   * 根据配置加载领域模板
   */
  private async loadDomainTemplateByConfig(category: 'content' | 'process', config: AssemblyConfig): Promise<string> {
    // 如果配置中指定了特定的domain模板，使用指定的
    if (config.domain_template) {
      try {
        const template = await this.loadTemplate(`domain/${config.domain_template}`);
        //this.logger.info(`✅ [PromptAssembly] 使用自定义domain模板: ${config.domain_template}`);
        return template;
      } catch (error) {
        //this.logger.warn(`⚠️ [PromptAssembly] 自定义domain模板加载失败: ${config.domain_template}, 回退到默认模板`);
      }
    }
    
    // 使用默认的领域模板
    return await this.loadDomainTemplate(category);
  }

  /**
   * 加载单个模板文件
   */
  private async loadTemplate(relativePath: string): Promise<string> {
    const fullPath = path.join(this.templateBasePath, relativePath);
    
    if (this.templateCache.has(fullPath)) {
      this.logger.debug(`🔍 [PromptAssembly] 使用缓存模板: ${relativePath}`);
      return this.templateCache.get(fullPath)!;
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      this.templateCache.set(fullPath, content);
      this.logger.debug(`📁 [PromptAssembly] 读取模板文件: ${fullPath} (${content.length}字符)`);
      return content;
    } catch (error) {
      this.logger.debug(`❌ [PromptAssembly] 模板文件读取失败: ${fullPath}`);
      throw new Error(`Failed to load template ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 🚀 v4.0: 9部分结构化模板合并 - 增强的用户体验架构（含SRS目录）
   * 
   * 重构说明：
   * - 使用明确的角色定义和指令分离
   * - 符合VSCode官方文档最佳实践
   * - 新增专门的章节模板、SRS文档和requirements.yaml部分
   * - 新增工具列表部分，提供可用工具的JSON Schema
   * - 提高specialist对当前项目状态的理解能力
   * - 🚀 v4.0新顺序：专家指令 → 用户任务 → 用户响应 → SRS目录 → 章节模板 → 动态上下文 → 指导原则 → 工具列表 → 最终指令
   */
  private mergeTemplates(templates: string[], context: SpecialistContext, config?: AssemblyConfig, baseTemplates: string[] = [], contentTemplates: string[] = [], environmentContext?: EnvironmentContext): string {
    this.logger.info(`🔧 [PromptAssembly] v3.0 开始结构化合并模板，总数: ${templates.length}`);
    
    // 过滤掉空模板
    const validTemplates = templates.filter(template => template.trim().length > 0);
    const validBaseTemplates = baseTemplates.filter(template => template.trim().length > 0);
    const validContentTemplates = contentTemplates.filter(template => template.trim().length > 0);
    
    this.logger.info(`🔧 [PromptAssembly] 有效模板数量: content=${validContentTemplates.length}, base=${validBaseTemplates.length}, total=${validTemplates.length}`);
    
    // 处理变量替换（保持原有功能，增强错误处理）
    const processVariables = (templateArray: string[]) => {
      return templateArray.map(template => {
        let processed = template;
        const variableMatches = processed.match(/\{\{(\w+)\}\}/g);
        if (variableMatches) {
          this.logger.debug(`🔧 [PromptAssembly] 发现变量占位符: ${variableMatches.join(', ')}`);
          processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            // 优先从context直接属性获取，然后从structuredContext获取
            const replacement = context[key] || context.structuredContext?.[key] || match;
            if (replacement !== match) {
              this.logger.debug(`🔧 [PromptAssembly] 替换变量: ${match} -> ${replacement.toString().substring(0, 50)}...`);
            }
            return replacement;
          });
        }
        return processed;
      });
    };
    
    const processedContentTemplates = processVariables(validContentTemplates);
    const processedBaseTemplates = processVariables(validBaseTemplates);
    
    // 🚀 v3.0: 构建结构化User消息 - 符合VSCode最佳实践
    // 🔄 v4.0: 优先使用已经从SpecialistRegistry获取的specialist_name（通过assembleSpecialistPrompt传入）
    const contextSpecialistType = context.specialist_type || context.structuredContext?.specialist_type;
    const configSpecialistName = config?.specialist_name;
    const fallbackSpecialistType = 'specialist'; // 默认值
    
    const finalSpecialistType = configSpecialistName || contextSpecialistType || fallbackSpecialistType;
    const roleDefinition = config?.role_definition || `${finalSpecialistType} specialist`;
    
    // 🚀 v5.0新结构实现：10部分提示词架构（优化顺序以提高AI友好性）
    // 1. SPECIALIST INSTRUCTIONS (content/process模板)
    // 2. CURRENT TASK (用户输入)
    // 3. LATEST RESPONSE FROM USER (用户最新响应)
    // 4. YOUR PREVIOUS THOUGHTS (思考记录，工作记忆)
    // 5. DYNAMIC CONTEXT (动态上下文信息：迭代进度、项目元数据、环境、历史)
    // 6. GUIDELINES AND SAMPLE OF TOOLS USING (基础指导原则和工具使用示例)
    // 7. YOUR TOOLS LIST (可用工具的JSON Schema)
    // 8. TEMPLATE FOR YOUR CHAPTERS (你所负责的章节模版)
    // 9. TABLE OF CONTENTS OF CURRENT SRS (当前SRS文档目录结构)
    // 10. FINAL INSTRUCTION (最终执行指令)
    
    // 🚀 新增：收集所有template变量用于TEMPLATE FOR YOUR CHAPTERS部分
    const templateVariables = Object.keys(context)
      .filter(key => key.endsWith('_TEMPLATE'))
      .map(key => context[key] || 'Chapter template not available')
      .join('\n\n');
    
    // 🚀 获取思考记录
    const previousThoughts = context.PREVIOUS_THOUGHTS || '';
    
    const structuredPrompt = `You are a ${roleDefinition}. Below is the context information and the task you need to complete. Follow these instructions carefully:

Table of Contents:

1. SPECIALIST INSTRUCTIONS
2. CURRENT TASK
3. LATEST RESPONSE FROM USER
4. YOUR PREVIOUS THOUGHTS
5. DYNAMIC CONTEXT
6. GUIDELINES AND SAMPLE OF TOOLS USING
7. YOUR TOOLS LIST
8. TEMPLATE FOR YOUR CHAPTERS
9. TABLE OF CONTENTS OF CURRENT SRS (SRS.md)
10. FINAL INSTRUCTION

**# 1. SPECIALIST INSTRUCTIONS**

${processedContentTemplates.join('\n\n---\n\n')}

**# 2. CURRENT TASK**

\`\`\`json
${context.structuredContext?.currentStep ? JSON.stringify(context.structuredContext.currentStep, null, 2) : 'No current step available'}
\`\`\`

**# 3. LATEST RESPONSE FROM USER**

${context.userResponse ? `**User's latest response**: ${context.userResponse}

${context.resumeGuidance ? `**Resume Instructions**:
${context.resumeGuidance.continueInstructions?.join('\n') || 'Continue based on user response'}

**Previous Question Asked**: ${context.resumeGuidance.userQuestion || 'No previous question recorded'}

**Resume Context**: You were waiting for user input and now the user has responded. Please continue your work based on their response.` : ''}` : 'No user response were required in last turn.'}

**# 4. YOUR PREVIOUS THOUGHTS**

${previousThoughts}

**# 5. DYNAMIC CONTEXT**

${context.iterationInfo ? `## 🎯 Resource Budget & Strategy
**Iteration Progress**: You are on iteration **${context.iterationInfo.currentIteration}/${context.iterationInfo.maxIterations}** (${context.iterationInfo.remainingIterations} attempts remaining)

**Current Phase**: ${context.iterationInfo.phase === 'early' ? 'Early exploration (abundant resources available)' : 
                     context.iterationInfo.phase === 'middle' ? 'Active development (moderate resources)' : 
                     'Final phase (limited resources)'}
**Strategy**: ${context.iterationInfo.strategyGuidance}

` : ''}## Project Metadata
\`\`\`json
${context.projectMetadata ? JSON.stringify(context.projectMetadata, null, 2) : 'No project metadata available'}
\`\`\`

## 🌍 Environment Context

${environmentContext ? `**Project Directory (Absolute Path)**: \`${environmentContext.projectDirectory}\`

**Project Files (Relative to baseDir)**:
${environmentContext.projectFiles.length > 0 ? 
  environmentContext.projectFiles.map(file => 
    `- ${file.relativePath}${file.isDirectory ? ' (directory)' : ''}`
  ).join('\n') : 
  '- No files found in project directory'
}` : 'Environment context not available'}

## Iterative History

${context.structuredContext?.internalHistory && Array.isArray(context.structuredContext.internalHistory) && context.structuredContext.internalHistory.length > 0
  ? this.formatIterativeHistory(context.structuredContext.internalHistory)
  : 'No iterative history available'}

**# 6. GUIDELINES AND SAMPLE OF TOOLS USING**

${processedBaseTemplates.join('\n\n---\n\n')}

**# 7. YOUR TOOLS LIST**

\`\`\`json
${context.TOOLS_JSON_SCHEMA || 'No tools available'}
\`\`\`

**# 8. TEMPLATE FOR YOUR CHAPTERS**

${templateVariables || 'No chapter templates provided for this specialist'}

**# 9. TABLE OF CONTENTS OF CURRENT SRS (SRS.md)**

${context.SRS_TOC || context.CURRENT_SRS_TOC || 'No SRS document structure available - you may be working on a new document or the SRS file could not be located.'}

**# 10. FINAL INSTRUCTION**

Based on all the instructions and context above, generate a valid JSON object that adheres to the required schema.

**CRITICAL: Your entire response MUST be a single JSON object, starting with \`{\` and ending with \`}\`. Do not include any introductory text, explanations, or conversational filler.**`;

    return structuredPrompt;
  }

  /**
   * 🚀 v5.0: 格式化迭代历史，使其更具可读性
   * 将internalHistory数组组织为按迭代分组的结构化格式
   */
  private formatIterativeHistory(internalHistory: string[]): string {
    if (!internalHistory || internalHistory.length === 0) {
      return 'No iterative history available';
    }

    // 按迭代编号分组历史记录
    const iterationGroups: Map<number, {
      plan?: string;
      results?: string;
      userReply?: string;
      previousResults?: string;
      thoughtSummary?: string;  // 🚀 v5.0: 新增thought摘要字段
    }> = new Map();

    for (const entry of internalHistory) {
      // 匹配两种格式：
      // 1. "迭代 X - 类型: 内容"（用户回复、Thought摘要）
      // 2. "迭代 X - 类型:\n内容"（AI计划、工具结果等）
      const iterationMatchWithColon = entry.match(/^迭代\s+(\d+)\s+-\s+(.+?):\s+(.*)$/s);

      if (iterationMatchWithColon) {
        const iterationNum = parseInt(iterationMatchWithColon[1], 10);
        const entryType = iterationMatchWithColon[2].trim();
        const content = iterationMatchWithColon[3];

        if (!iterationGroups.has(iterationNum)) {
          iterationGroups.set(iterationNum, {});
        }
        const group = iterationGroups.get(iterationNum)!;

        // 注意：需要先检查"之前的工具结果"，因为它也包含"工具结果"
        if (entryType.includes('之前的工具结果')) {
          group.previousResults = content;
        } else if (entryType.includes('Thought摘要')) {
          // 🚀 v5.0: 识别thought摘要
          group.thoughtSummary = content;
        } else if (entryType.includes('AI计划')) {
          group.plan = content;
        } else if (entryType.includes('工具结果')) {
          group.results = content;
        } else if (entryType.includes('用户回复')) {
          group.userReply = content;
        }
      }
    }

    // 格式化输出
    const formattedIterations: string[] = [];
    // ✅ 修复：改为降序排序（最新的迭代在上），与 YOUR PREVIOUS THOUGHTS 保持一致
    const sortedIterations = Array.from(iterationGroups.keys()).sort((a, b) => b - a);

    for (const iterationNum of sortedIterations) {
      const group = iterationGroups.get(iterationNum)!;
      const parts: string[] = [];

      parts.push(`### Iteration ${iterationNum}:\n`);

      // 🚀 v5.0: 如果有thought摘要，紧接着iteration标题后显示
      if (group.thoughtSummary) {
        parts.push(`${group.thoughtSummary}\n`);
      }

      if (group.userReply) {
        parts.push(`**User Reply**: ${group.userReply}\n`);
      }

      if (group.previousResults) {
        parts.push(`**Previous Tool Results**:\n${group.previousResults}\n`);
      }

      if (group.plan) {
        parts.push(`**AI Plan**:\n${group.plan}\n`);
      }

      if (group.results) {
        parts.push(`**Tool Results**:\n${group.results}`);
      }

      formattedIterations.push(parts.join('\n'));
    }

    return formattedIterations.join('\n\n---\n\n');
  }

  /**
   * 解析YAML frontmatter
   */
  private parseYAMLFrontmatter(content: string): AssemblyConfig {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      //this.logger.info(`🔍 [PromptAssembly] 未找到YAML frontmatter，使用默认配置`);
      return {}; // 默认配置
    }
    
    try {
      const parsed = yaml.load(frontmatterMatch[1]) as any;
      // 支持两种配置格式：assembly_config 和 specialist_config
      let config = parsed?.assembly_config || {};
      
      // 如果存在specialist_config，提取其中的配置信息
      if (parsed?.specialist_config) {
        const specialistConfig = parsed.specialist_config;
        
        // 提取template_config相关配置
        if (specialistConfig.template_config) {
          config = {
            ...config,
            include_base: specialistConfig.template_config.include_base,
            exclude_base: specialistConfig.template_config.exclude_base
          };
        }
        
        // 🚀 v5.0: 提取workflow_mode_config
        if (specialistConfig.workflow_mode_config) {
          config.workflow_mode_config = specialistConfig.workflow_mode_config;
        }
        
        // 提取specialist_name
        if (specialistConfig.name) {
          config.specialist_name = specialistConfig.name;
        }
      }
      
      this.logger.debug(`✅ [PromptAssembly] YAML frontmatter解析成功: ${JSON.stringify(config, null, 2)}`);
      return config;
    } catch (error) {
      this.logger.warn(`⚠️ [PromptAssembly] YAML frontmatter解析失败: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * 移除frontmatter，返回纯内容
   */
  private removeFrontmatter(content: string): string {
    const cleaned = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    //this.logger.debug(`🔧 [PromptAssembly] 移除frontmatter，内容长度: ${content.length} -> ${cleaned.length}`);
    return cleaned;
  }

  /**
   * 🚀 v5.0新增：根据workflow_mode过滤content specialist的内容
   * 
   * 过滤规则：
   * 1. 如果heading 2包含目标标志（如"GREEN"），则包含
   * 2. 如果heading 2包含其他标志（如"BROWN"），则排除
   * 3. 如果heading 2没有任何标志，则包含（通用内容）
   */
  private filterContentByWorkflowMode(
    content: string,
    workflowMode: "greenfield" | "brownfield",
    config: AssemblyConfig
  ): string {
    const modeConfig = config.workflow_mode_config;
    if (!modeConfig) {
      return content;
    }

    const targetFlag = modeConfig[workflowMode];
    const otherFlag = workflowMode === "greenfield" ? modeConfig.brownfield : modeConfig.greenfield;

    if (!targetFlag) {
      this.logger.debug(`🔍 [PromptAssembly] workflow_mode=${workflowMode}没有配置对应的标志，返回原内容`);
      return content;
    }

    this.logger.debug(`🔍 [PromptAssembly] 过滤规则: 包含标志="${targetFlag}", 排除标志="${otherFlag || '无'}"`);

    // 按heading 2分割内容
    const sections = this.splitContentByHeading2(content);
    
    // 过滤sections
    const filteredSections = sections.filter(section => {
      const heading = this.extractHeading2(section);
      if (!heading) {
        // 没有heading 2的内容（如前言），保留
        return true;
      }

      // 检查是否包含目标标志
      if (targetFlag && heading.includes(targetFlag)) {
        this.logger.debug(`✅ [PromptAssembly] 包含章节: ${heading} (包含标志=${targetFlag})`);
        return true;
      }

      // 检查是否包含其他标志
      if (otherFlag && heading.includes(otherFlag)) {
        this.logger.debug(`❌ [PromptAssembly] 排除章节: ${heading} (包含标志=${otherFlag})`);
        return false;
      }

      // 没有任何标志的通用内容，保留
      this.logger.debug(`✅ [PromptAssembly] 包含章节: ${heading} (通用内容)`);
      return true;
    });

    // 清理过滤后的内容，移除标志
    const cleanedSections = filteredSections.map(section => {
      return this.removeWorkflowModeFlags(section, targetFlag, otherFlag);
    });

    const filteredContent = cleanedSections.join('\n\n');
    this.logger.info(`🎯 [PromptAssembly] workflow_mode过滤完成: ${sections.length}个章节 -> ${filteredSections.length}个章节，已清理标志`);
    
    return filteredContent;
  }

  /**
   * 按heading 2分割markdown内容
   */
  private splitContentByHeading2(content: string): string[] {
    // 使用正则表达式匹配heading 2 (## 开头的行)
    const heading2Regex = /^## .+$/gm;
    const headings = content.match(heading2Regex) || [];
    
    if (headings.length === 0) {
      return [content]; // 没有heading 2，返回整个内容
    }

    const sections: string[] = [];
    let currentIndex = 0;

    for (let i = 0; i < headings.length; i++) {
      const currentHeading = headings[i];
      const nextHeading = headings[i + 1];
      
      // 找到当前heading在内容中的位置
      const headingIndex = content.indexOf(currentHeading, currentIndex);
      
      if (headingIndex === -1) continue;

      // 确定当前section的结束位置
      let sectionEnd: number;
      if (nextHeading) {
        const nextHeadingIndex = content.indexOf(nextHeading, headingIndex + currentHeading.length);
        sectionEnd = nextHeadingIndex;
      } else {
        sectionEnd = content.length;
      }

      // 提取section内容
      const sectionContent = content.substring(headingIndex, sectionEnd).trim();
      sections.push(sectionContent);
      
      currentIndex = headingIndex + currentHeading.length;
    }

    // 处理第一个heading 2之前的内容（如果有的话）
    if (headings.length > 0 && headings[0]) {
      const firstHeadingIndex = content.indexOf(headings[0]);
      if (firstHeadingIndex > 0) {
        const prefaceContent = content.substring(0, firstHeadingIndex).trim();
        if (prefaceContent) {
          sections.unshift(prefaceContent);
        }
      }
    }

    return sections;
  }

  /**
   * 从section中提取heading 2文本
   */
  private extractHeading2(section: string): string | null {
    const heading2Match = section.match(/^## (.+)$/m);
    return heading2Match ? heading2Match[0] : null;
  }

  /**
   * 从section内容中移除workflow_mode标志
   */
  private removeWorkflowModeFlags(section: string, targetFlag?: string, otherFlag?: string): string {
    let cleanedSection = section;
    
    // 移除heading 2中的标志
    if (targetFlag) {
      // 匹配 "## GREEN 🔄 工作流程" 并移除 "GREEN "
      cleanedSection = cleanedSection.replace(
        new RegExp(`^## ${targetFlag}\\s+(.+)$`, 'gm'),
        '## $1'
      );
    }
    
    if (otherFlag) {
      // 虽然这个section不应该包含otherFlag，但为了健壮性还是处理一下
      cleanedSection = cleanedSection.replace(
        new RegExp(`^## ${otherFlag}\\s+(.+)$`, 'gm'),
        '## $1'
      );
    }
    
    return cleanedSection;
  }

  /**
   * 验证组装后的prompt
   */
  private async validateAssembledPrompt(prompt: string): Promise<void> {
    //this.logger.info(`🔍 [PromptAssembly] 开始验证组装结果`);
    
    // 检查必要部分是否存在
    const requiredSections = [
      '角色定义',
      '输出格式',
      '职责边界'
    ];

    for (const section of requiredSections) {
      if (!prompt.includes(section)) {
        this.logger.warn(`⚠️ [PromptAssembly] 组装后的提示词缺少推荐章节: ${section}`);
      } else {
        //this.logger.debug(`✅ [PromptAssembly] 找到推荐章节: ${section}`);
      }
    }

    // 检查prompt长度
    if (prompt.length > 15000) {
      // this.logger.warn(`⚠️ [PromptAssembly] 组装后的提示词较长 (${prompt.length} 字符), 考虑优化`);
    } else if (prompt.length < 500) {
      // this.logger.warn(`⚠️ [PromptAssembly] 组装后的提示词较短 (${prompt.length} 字符), 可能缺少必要指导`);
    } else {
      // this.logger.info(`✅ [PromptAssembly] 提示词长度合适 (${prompt.length} 字符)`);
    }
    
    // this.logger.info(`✅ [PromptAssembly] 组装结果验证完成`);
  }

  /**
   * 验证模板一致性
   */
  async validateTemplateConsistency(): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];
    
    try {
      // 检查所有模板文件是否存在
      const templateStructure = await this.scanTemplateStructure();
      
      // 验证基础模板完整性
      const baseTemplateIssues = await this.validateBaseTemplates();
      issues.push(...baseTemplateIssues);
      
      // 验证specialist模板一致性
      const specialistTemplateIssues = await this.validateSpecialistTemplates();
      issues.push(...specialistTemplateIssues);
      
      return {
        isValid: issues.filter(issue => issue.severity === 'error').length === 0,
        issues,
        templateCount: templateStructure.totalTemplates,
        lastValidated: new Date()
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [{ type: 'system_error', message: error instanceof Error ? error.message : String(error), severity: 'error' }],
        templateCount: 0,
        lastValidated: new Date()
      };
    }
  }

  /**
   * 扫描模板结构
   */
  private async scanTemplateStructure(): Promise<TemplateStructure> {
    const baseTemplates: string[] = [];
    const domainTemplates: string[] = [];
    const specialistTemplates: string[] = [];

    try {
      // 扫描base目录
      const basePath = path.join(this.templateBasePath, 'base');
      const baseFiles = await fs.readdir(basePath);
      baseTemplates.push(...filterSpecialistFiles(baseFiles));
    } catch (error) {
      this.logger.warn('⚠️ [PromptAssembly] Base templates目录未找到');
    }

    try {
      // 扫描domain目录
      const domainPath = path.join(this.templateBasePath, 'domain');
      const domainFiles = await fs.readdir(domainPath);
      domainTemplates.push(...filterSpecialistFiles(domainFiles));
    } catch (error) {
      this.logger.warn('⚠️ [PromptAssembly] Domain templates目录未找到');
    }

    try {
      // 扫描specialist目录
      const specialistPath = path.join(this.templateBasePath, 'specialist');
      const specialistFiles = await fs.readdir(specialistPath);
      specialistTemplates.push(...filterSpecialistFiles(specialistFiles));
    } catch (error) {
      this.logger.warn('⚠️ [PromptAssembly] Specialist templates目录未找到');
    }

    return {
      totalTemplates: baseTemplates.length + domainTemplates.length + specialistTemplates.length,
      baseTemplates,
      domainTemplates,
      specialistTemplates
    };
  }

  /**
   * 验证基础模板
   */
  private async validateBaseTemplates(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const requiredBaseTemplates = [
      'common-role-definition.md',
      'output-format-schema.md'
    ];

    for (const templateFile of requiredBaseTemplates) {
      try {
        const template = await this.loadTemplate(`base/${templateFile}`);
        
        // 检查模板内容
        if (template.length < 100) {
          issues.push({
            type: 'format_error',
            message: `Base template ${templateFile} is too short`,
            severity: 'warning',
            templatePath: `base/${templateFile}`
          });
        }
        
        // 检查特定内容
        if (templateFile === 'output-format-schema.md' && !template.includes('structuredData')) {
          issues.push({
            type: 'format_error',
            message: 'Output format schema missing structuredData specification',
            severity: 'error',
            templatePath: `base/${templateFile}`
          });
        }
        
      } catch (error) {
        issues.push({
          type: 'missing_template',
          message: `Required base template missing: ${templateFile}`,
          severity: 'error',
          templatePath: `base/${templateFile}`
        });
      }
    }

    return issues;
  }

  /**
   * 验证specialist模板
   */
  private async validateSpecialistTemplates(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    try {
      const structure = await this.scanTemplateStructure();
      
      // 检查是否有specialist模板
      if (structure.specialistTemplates.length === 0) {
        issues.push({
          type: 'missing_template',
          message: 'No specialist templates found',
          severity: 'warning'
        });
      }
      
      // 验证每个specialist模板的格式
      for (const templateFile of structure.specialistTemplates) {
        try {
          const template = await this.loadTemplate(`specialist/${templateFile}`);
          
          // 检查模板是否包含必要的结构
          const requiredSections = ['专业领域', '职责范围', '输入格式', '输出格式'];
          const missingSections = requiredSections.filter(section => !template.includes(section));
          
          if (missingSections.length > 0) {
            issues.push({
              type: 'format_error',
              message: `Template ${templateFile} missing sections: ${missingSections.join(', ')}`,
              severity: 'info',
              templatePath: `specialist/${templateFile}`
            });
          }
          
        } catch (error) {
          issues.push({
            type: 'format_error',
            message: `Error reading specialist template ${templateFile}: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'warning',
            templatePath: `specialist/${templateFile}`
          });
        }
      }
      
    } catch (error) {
      issues.push({
        type: 'system_error',
        message: `Error scanning specialist templates: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }

    return issues;
  }

  /**
   * 清空模板缓存
   */
  clearCache(): void {
    this.templateCache.clear();
    // this.logger.info(`🔧 [PromptAssembly] 模板缓存已清空`);
  }

  /**
   * 预加载所有模板到缓存
   */
  async preloadTemplates(): Promise<void> {
    try {
      const structure = await this.scanTemplateStructure();
      
      // 预加载基础模板
      for (const template of structure.baseTemplates) {
        await this.loadTemplate(`base/${template}`);
      }
      
      // 预加载领域模板
      for (const template of structure.domainTemplates) {
        await this.loadTemplate(`domain/${template}`);
      }
      
      // 预加载specialist模板
      for (const template of structure.specialistTemplates) {
        await this.loadTemplate(`specialist/${template}`);
      }
      
      // this.logger.info(`✅ [PromptAssembly] 预加载了${structure.totalTemplates}个模板到缓存`);
      
    } catch (error) {
      this.logger.warn(`⚠️ [PromptAssembly] 预加载模板失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取模板统计信息
   */
  async getTemplateStats(): Promise<{
    totalTemplates: number;
    cachedTemplates: number;
    averageTemplateSize: number;
    templatesByCategory: Record<string, number>;
  }> {
    const structure = await this.scanTemplateStructure();
    
    let totalSize = 0;
    let sizeCount = 0;
    
    // 计算已缓存模板的平均大小
    for (const [path, content] of this.templateCache.entries()) {
      totalSize += content.length;
      sizeCount++;
    }
    
    const stats = {
      totalTemplates: structure.totalTemplates,
      cachedTemplates: this.templateCache.size,
      averageTemplateSize: sizeCount > 0 ? Math.round(totalSize / sizeCount) : 0,
      templatesByCategory: {
        base: structure.baseTemplates.length,
        domain: structure.domainTemplates.length,
        specialist: structure.specialistTemplates.length
      }
    };

    // this.logger.info(`📊 [PromptAssembly] 模板统计: ${JSON.stringify(stats, null, 2)}`);
    return stats;
  }

  /**
   * 🚀 新增：收集环境感知信息
   */
  private async gatherEnvironmentContext(context: SpecialistContext): Promise<EnvironmentContext> {
    const baseDir = context.projectMetadata?.baseDir;
    
    // this.logger.info(`🌍 [EnvironmentSensing] 开始收集环境信息`);
    // this.logger.info(`🌍 [EnvironmentSensing] baseDir: ${baseDir}`);
    
    if (!baseDir) {
      this.logger.warn('🌍 [EnvironmentSensing] No baseDir available, using empty environment context');
      return {
        projectDirectory: '',
        projectFiles: []
      };
    }

    try {
      // 获取项目目录文件列表
      const projectFiles = await this.listDirectoryFiles(baseDir, baseDir);
      // this.logger.info(`🌍 [EnvironmentSensing] 项目目录文件数量: ${projectFiles.length}`);
      
      const environmentContext: EnvironmentContext = {
        projectDirectory: baseDir,
        projectFiles
      };
      
      // this.logger.info(`🌍 [EnvironmentSensing] 环境感知信息收集完成`);
      return environmentContext;
      
    } catch (error) {
      this.logger.error('🌍 [EnvironmentSensing] 环境信息收集失败', error as Error);
      return {
        projectDirectory: baseDir,
        projectFiles: []
      };
    }
  }

  /**
   * 🚀 新增：列出指定目录下的所有文件和子目录，生成相对于baseDir的路径
   */
  private async listDirectoryFiles(targetDir: string, baseDir: string): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(targetDir, { withFileTypes: true });
      const fileInfos: FileInfo[] = [];
      
      for (const entry of entries) {
        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const fullPath = path.join(targetDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        fileInfos.push({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          relativePath: './' + relativePath.replace(/\\/g, '/') // 统一使用正斜杠
        });
      }
      
      // 按名称排序，目录在前
      fileInfos.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      return fileInfos;
    } catch (error) {
      this.logger.warn(`🌍 [EnvironmentSensing] 无法读取目录: ${targetDir}, 错误: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 🚀 重构：为content specialist动态加载当前项目的SRS.md目录结构（ToC模式）和requirements.yaml内容
   */
  private async loadProjectSRSContent(context: SpecialistContext): Promise<void> {
    try {
      const baseDir = context.projectMetadata?.baseDir;
      if (!baseDir) {
        this.logger.warn('No baseDir available for SRS content loading');
        return;
      }

      // 🚀 新功能：加载SRS目录结构（ToC格式）
      await this.loadProjectSRSToC(context, baseDir);
      
      // 保持原有功能：加载requirements.yaml内容
      await this.loadProjectRequirementsYaml(context, baseDir);
      
    } catch (error) {
      this.logger.error('Failed to load project SRS content', error as Error);
      // 确保所有字段都有默认值
      context.SRS_TOC = '';
      context.CURRENT_SRS_TOC = '';
      context.REQUIREMENTS_YAML_CONTENT = '';
      context.CURRENT_REQUIREMENTS_YAML = '';
    }
  }

  /**
   * 🚀 新增：使用readMarkdownFile工具加载SRS文档的目录结构（ToC模式）
   */
  private async loadProjectSRSToC(context: SpecialistContext, baseDir: string): Promise<void> {
    const possibleSRSPaths = [
      'SRS.md',
      'srs.md', 
      'Software_Requirements_Specification.md',
      'requirements.md'
    ];

    this.logger.info('🔍 开始加载SRS文档目录结构（ToC模式）...');

    for (const srsPath of possibleSRSPaths) {
      try {
        this.logger.debug(`🔍 尝试读取SRS文件: ${srsPath}`);
        
        // 使用readMarkdownFile工具的ToC模式
        const result = await readMarkdownFile({
          path: srsPath,
          parseMode: 'toc'
        });

        // 检查是否有错误
        if (result.error) {
          this.logger.debug(`❌ 读取${srsPath}时出现错误: ${result.error.message}`);
          continue;
        }

        // 检查是否有ToC数据
        if (!result.tableOfContentsToCTree || result.tableOfContentsToCTree.length === 0) {
          this.logger.debug(`⚠️ ${srsPath}没有找到目录结构，跳过`);
          continue;
        }

        // 转换ToC树为平铺的markdown格式
        const tocText = this.convertToCTreeToMarkdown(result.tableOfContentsToCTree);
        
        // 设置context变量
        context.SRS_TOC = tocText;
        context.CURRENT_SRS_TOC = tocText;
        
        // this.logger.info(`✅ 成功加载项目SRS目录结构: ${srsPath}`);
        // this.logger.info(`📋 目录结构包含 ${result.tableOfContentsToCTree.length} 个顶级章节`);
        // this.logger.debug(`📄 生成的ToC格式:\n${tocText}`);
        
        return; // 成功加载后返回
        
      } catch (error) {
        this.logger.debug(`❌ 加载${srsPath}失败: ${error instanceof Error ? error.message : String(error)}`);
        continue; // 继续尝试下一个路径
      }
    }
    
    // 如果所有路径都失败，设置空值并记录警告
    this.logger.warn('⚠️ 未找到可用的项目SRS文件，SRS目录结构将为空');
    context.SRS_TOC = '';
    context.CURRENT_SRS_TOC = '';
  }

  /**
   * 🚀 重构：单独处理requirements.yaml文件加载
   */
  private async loadProjectRequirementsYaml(context: SpecialistContext, baseDir: string): Promise<void> {
    const possibleRequirementsYamlPaths = [
      'requirements.yaml',
      'requirements.yml',
      'Requirements.yaml',
      'Requirements.yml'
    ];

    this.logger.info('🔍 开始加载requirements.yaml文件...');

    for (const yamlPath of possibleRequirementsYamlPaths) {
      try {
        const fullPath = path.join(baseDir, yamlPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // 将requirements.yaml内容添加到context中
        context.REQUIREMENTS_YAML_CONTENT = content;
        context.CURRENT_REQUIREMENTS_YAML = content; // 提供别名
        
        this.logger.info(`✅ 成功加载项目requirements.yaml内容: ${yamlPath} (${content.length}字符)`);
        return;
        
      } catch (error) {
        this.logger.debug(`❌ 读取${yamlPath}失败: ${error instanceof Error ? error.message : String(error)}`);
        continue; // 继续尝试下一个路径
      }
    }
    
    this.logger.warn('⚠️ 未找到项目requirements.yaml文件，使用空内容');
    context.REQUIREMENTS_YAML_CONTENT = '';
    context.CURRENT_REQUIREMENTS_YAML = '';
  }

  /**
   * 🚀 新增：将ToC树状结构转换为markdown格式的平铺文本
   * 输出格式: # title  SID: /sid
   */
  private convertToCTreeToMarkdown(tocNodes: any[]): string {
    const lines: string[] = [];
    
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        // 生成markdown标题前缀 (# ## ### 等)
        const prefix = '#'.repeat(node.level);
        
        // 生成格式: # title  SID: /sid
        lines.push(`${prefix} ${node.title}  SID: ${node.sid}`);
        
        // 递归处理子节点
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(tocNodes);
    return lines.join('\n');
  }
}