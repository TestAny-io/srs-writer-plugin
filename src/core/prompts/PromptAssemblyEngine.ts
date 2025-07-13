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

export interface SpecialistType {
  name: string;
  category: 'content' | 'process';
}

export interface SpecialistContext {
  userRequirements?: string;
  language?: string;  // 🚀 新增：明确定义language字段，用于指定specialist输出的语言
  structuredContext?: any;
  projectMetadata?: any;
  [key: string]: any;
}

export interface AssemblyConfig {
  include_base?: string[];
  exclude_base?: string[];
  domain_template?: string;
  specialist_type?: string;
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
    // this.logger.info(`🔥 [PromptAssembly] === 开始组装 ${specialistType.name} 提示词 ===`);
    
    // 🔍 详细记录输入信息
    //this.logger.info(`🔍 [PromptAssembly] 输入参数:`);
    //this.logger.info(`🔍 [PromptAssembly] - specialistType: ${JSON.stringify(specialistType, null, 2)}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.userRequirements: ${context.userRequirements || '无'}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.structuredContext存在: ${!!context.structuredContext}`);
    //this.logger.info(`🔍 [PromptAssembly] - context.projectMetadata存在: ${!!context.projectMetadata}`);
    
    if (context.structuredContext) {
      //this.logger.info(`🔍 [PromptAssembly] - structuredContext内容: ${JSON.stringify(context.structuredContext, null, 2)}`);
    }
    
    if (context.projectMetadata) {
      //this.logger.info(`🔍 [PromptAssembly] - projectMetadata内容: ${JSON.stringify(context.projectMetadata, null, 2)}`);
    }

    try {
      // 1. 加载专家模板并解析配置
      //this.logger.info(`📄 [PromptAssembly] 步骤1: 加载专家模板并解析配置`);
      const { content: specificTemplate, config } = await this.loadSpecificTemplateWithConfig(specialistType.name);
      
      //this.logger.info(`🔍 [PromptAssembly] 专家模板配置解析结果:`);
      //this.logger.info(`🔍 [PromptAssembly] - config: ${JSON.stringify(config, null, 2)}`);
      //this.logger.info(`🔍 [PromptAssembly] - 专家模板长度: ${specificTemplate.length} 字符`);
      //this.logger.info(`🔍 [PromptAssembly] - 专家模板前200字符: ${specificTemplate.substring(0, 200)}`);
      
      // 2. 根据配置选择性加载base模板
      //this.logger.info(`📄 [PromptAssembly] 步骤2: 根据配置加载base模板`);
      const baseTemplates = await this.loadBaseTemplatesByConfig(config);
      
      //this.logger.info(`🔍 [PromptAssembly] base模板加载结果:`);
      //this.logger.info(`🔍 [PromptAssembly] - 加载的模板数量: ${baseTemplates.length}`);
      baseTemplates.forEach((template, index) => {
        //this.logger.info(`🔍 [PromptAssembly] - base模板${index + 1}长度: ${template.length} 字符`);
      });
      
      // 3. 根据配置加载领域模板
      //this.logger.info(`📄 [PromptAssembly] 步骤3: 根据配置加载domain模板`);
      const domainTemplate = await this.loadDomainTemplateByConfig(specialistType.category, config);
      
      //this.logger.info(`🔍 [PromptAssembly] domain模板加载结果:`);
      //this.logger.info(`🔍 [PromptAssembly] - domain模板长度: ${domainTemplate.length} 字符`);
      if (domainTemplate.length > 0) {
        //this.logger.info(`🔍 [PromptAssembly] - domain模板前200字符: ${domainTemplate.substring(0, 200)}`);
      }
      
      // 4. 组装最终prompt
      //this.logger.info(`📄 [PromptAssembly] 步骤4: 合并所有模板`);
      const allTemplates = [...baseTemplates, domainTemplate, specificTemplate];
      //this.logger.info(`🔍 [PromptAssembly] 合并前模板统计:`);
      //this.logger.info(`🔍 [PromptAssembly] - 总模板数量: ${allTemplates.length}`);
      //this.logger.info(`🔍 [PromptAssembly] - 各模板长度: ${allTemplates.map(t => t.length).join(', ')}`);
      
      const assembledPrompt = this.mergeTemplates(allTemplates, context, config);
      
      // 5. 验证组装结果
      //this.logger.info(`📄 [PromptAssembly] 步骤5: 验证组装结果`);
      await this.validateAssembledPrompt(assembledPrompt);
      
      // 🔥 详细记录最终输出 - v2.0结构化版本
      //this.logger.info(`🎯 [PromptAssembly] === 组装完成 ${specialistType.name} (v2.0结构化版本) ===`);
      //this.logger.info(`🎯 [PromptAssembly] 最终提示词统计:`);
      //this.logger.info(`🎯 [PromptAssembly] - 总长度: ${assembledPrompt.length} 字符`);
      //this.logger.info(`🎯 [PromptAssembly] - 估算token数量: ${Math.ceil(assembledPrompt.length / 4)} tokens`);
      
      // 🚀 v2.0: 验证结构化格式
      //this.logger.info(`🎯 [PromptAssembly] 提示词结构验证:`);
      //this.logger.info(`🎯 [PromptAssembly] - SYSTEM INSTRUCTIONS: ${assembledPrompt.includes('=== SYSTEM INSTRUCTIONS ===') ? '✅' : '❌'}`);
      //this.logger.info(`🎯 [PromptAssembly] - CURRENT TASK: ${assembledPrompt.includes('=== CURRENT TASK ===') ? '✅' : '❌'}`);
      //this.logger.info(`🎯 [PromptAssembly] - CONTEXT INFORMATION: ${assembledPrompt.includes('=== CONTEXT INFORMATION ===') ? '✅' : '❌'}`);
      this.logger.info(`🎯 [PromptAssembly] - OUTPUT REQUIREMENTS: ${assembledPrompt.includes('=== FINAL INSTRUCTION: OUTPUT REQUIREMENTS ===') ? '✅' : '❌'}`);
      
      // 输出完整的最终提示词（仅在debug模式下）
      //this.logger.info(`🔥 [PromptAssembly] === 完整结构化提示词 for ${specialistType.name} ===`);
      //this.logger.info(`🔥 [PromptAssembly] ${assembledPrompt}`);
      //this.logger.info(`🔥 [PromptAssembly] === 提示词结束 ===`);
      
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
  private async loadSpecificTemplateWithConfig(specialistName: string): Promise<{
    content: string;
    config: AssemblyConfig;
  }> {
    //this.logger.info(`📋 [PromptAssembly] 加载专家模板配置: ${specialistName}`);
    const templateContent = await this.loadSpecificTemplate(specialistName);
    
    // 解析YAML frontmatter
    const config = this.parseYAMLFrontmatter(templateContent);
    
    // 移除frontmatter，返回纯内容
    const content = this.removeFrontmatter(templateContent);
    
    //this.logger.info(`✅ [PromptAssembly] 专家模板配置解析完成: ${specialistName}`);
    return { content, config };
  }

  /**
   * 加载专家特化模板（原方法，保持向后兼容）
   */
  private async loadSpecificTemplate(specialistName: string): Promise<string> {
    // 🚀 新架构：支持specialists/content/和specialists/process/目录结构
    const possiblePaths = [
      `specialists/content/${specialistName}.md`,     // content specialists
      `specialists/process/${specialistName}.md`,     // process specialists
      `specialists/${specialistName}.md`,              // root specialists (向后兼容)
      `specialist/${specialistName}-specific.md`      // 原设计格式 (向后兼容)
    ];
    
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
   * 🚀 v2.0: 结构化模板合并 - 使用清晰的分隔符和强制JSON输出
   */
  private mergeTemplates(templates: string[], context: SpecialistContext, config?: AssemblyConfig): string {
    //this.logger.info(`🔧 [PromptAssembly] 开始结构化合并模板，总数: ${templates.length}`);
    
    // 过滤掉空模板
    const validTemplates = templates.filter(template => template.trim().length > 0);
    //this.logger.info(`🔧 [PromptAssembly] 有效模板数量: ${validTemplates.length}/${templates.length}`);
    
    // 处理变量替换（保持原有功能）
    let processedTemplates = validTemplates.map(template => {
      let processed = template;
      const variableMatches = processed.match(/\{\{(\w+)\}\}/g);
      if (variableMatches) {
        //this.logger.info(`🔧 [PromptAssembly] 发现变量占位符: ${variableMatches.join(', ')}`);
        processed = processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          const replacement = context[key] || match;
          if (replacement !== match) {
            //this.logger.info(`🔧 [PromptAssembly] 替换变量: ${match} -> ${replacement.substring(0, 50)}...`);
          }
          return replacement;
        });
      }
      return processed;
    });
    
    const sections: string[] = [];
    
    // 1. 系统指令部分
    sections.push('=== SYSTEM INSTRUCTIONS ===');
    sections.push(processedTemplates.join('\n\n---\n\n')); // 使用---作为模板间的分隔符，更清晰
    sections.push('');
    
    // 2. 当前任务部分  
    if (context.userRequirements) {
        sections.push('=== CURRENT TASK ===');
        sections.push('```text');
        sections.push(context.userRequirements);
        sections.push('```');
        sections.push('');
        //this.logger.info(`🔧 [PromptAssembly] 添加当前任务 (${context.userRequirements.length}字符)`);
    }
    
    // 3. 上下文信息部分
    sections.push('=== CONTEXT INFORMATION ===');
    
    if (context.projectMetadata) {
        sections.push('**Project Metadata:**');
        sections.push('```json');
        sections.push(JSON.stringify(context.projectMetadata, null, 2));
        sections.push('```');
        //this.logger.info(`🔧 [PromptAssembly] 添加项目元数据`);
    }
    
    if (context.structuredContext) {
        sections.push('**Structured Context (Current Step & History):**');
        sections.push('```json');
        sections.push(JSON.stringify(context.structuredContext, null, 2));
        sections.push('```');
        //this.logger.info(`🔧 [PromptAssembly] 添加结构化上下文`);
    }
    
    // 如果有配置信息，添加专家类型说明
    if (config && config.specialist_type) {
        sections.push('**Specialist Type:**');
        sections.push(`Current specialist type: ${config.specialist_type}`);
        //this.logger.info(`🔧 [PromptAssembly] 添加专家类型说明: ${config.specialist_type}`);
    }
    
    sections.push('');
    
    // 4. 输出要求部分（关键！）
    sections.push('=== FINAL INSTRUCTION: OUTPUT REQUIREMENTS ===');
    sections.push('Based on all the instructions and context above, your one and only task is to generate valid JSON object that adheres to the required schema.');
    sections.push('**CRITICAL: Your entire response MUST be a single JSON object, starting with `{` and ending with `}`. Do not include any introductory text, explanations, or conversational filler.**');
    
    const finalContent = sections.join('\n');
    this.logger.info(`✅ [PromptAssembly] 结构化模板合并完成，最终长度: ${finalContent.length} 字符`);
    
    return finalContent;
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
      const config = parsed?.assembly_config || {};
      //this.logger.info(`✅ [PromptAssembly] YAML frontmatter解析成功: ${JSON.stringify(config, null, 2)}`);
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
      this.logger.warn(`⚠️ [PromptAssembly] 组装后的提示词较长 (${prompt.length} 字符), 考虑优化`);
    } else if (prompt.length < 500) {
      this.logger.warn(`⚠️ [PromptAssembly] 组装后的提示词较短 (${prompt.length} 字符), 可能缺少必要指导`);
    } else {
      this.logger.info(`✅ [PromptAssembly] 提示词长度合适 (${prompt.length} 字符)`);
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
      baseTemplates.push(...baseFiles.filter(file => file.endsWith('.md')));
    } catch (error) {
      this.logger.warn('⚠️ [PromptAssembly] Base templates目录未找到');
    }

    try {
      // 扫描domain目录
      const domainPath = path.join(this.templateBasePath, 'domain');
      const domainFiles = await fs.readdir(domainPath);
      domainTemplates.push(...domainFiles.filter(file => file.endsWith('.md')));
    } catch (error) {
      this.logger.warn('⚠️ [PromptAssembly] Domain templates目录未找到');
    }

    try {
      // 扫描specialist目录
      const specialistPath = path.join(this.templateBasePath, 'specialist');
      const specialistFiles = await fs.readdir(specialistPath);
      specialistTemplates.push(...specialistFiles.filter(file => file.endsWith('.md')));
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
} 