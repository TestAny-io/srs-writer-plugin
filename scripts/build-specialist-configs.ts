#!/usr/bin/env ts-node

/**
 * 构建时specialist配置生成器
 * 
 * 功能：
 * 1. 扫描rules/specialists/目录下所有specialist文件
 * 2. 提取category为'content'且enabled为true的specialist配置
 * 3. 动态生成package.json中的VSCode配置项
 * 4. 生成TypeScript映射文件供运行时使用
 * 
 * 注意：只处理content specialist，process specialist不需要模版配置
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface SpecialistConfig {
  enabled: boolean;
  id: string;
  name: string;
  category: 'content' | 'process';
  template_config?: {
    template_files?: Record<string, string>;
  };
}

interface ParsedSpecialist {
  config: SpecialistConfig;
  filePath: string;
  fileName: string;
}

interface VSCodeConfigProperty {
  type: string;
  default: Record<string, string>;
  description: string;
  properties?: Record<string, any>;
}

class SpecialistConfigBuilder {
  private readonly rulesPath: string;
  private readonly packageJsonPath: string;
  private readonly generatedDir: string;
  private readonly mappingFilePath: string;

  constructor() {
    this.rulesPath = path.join(__dirname, '../rules/specialists');
    this.packageJsonPath = path.join(__dirname, '../package.json');
    this.generatedDir = path.join(__dirname, '../src/core/generated');
    this.mappingFilePath = path.join(this.generatedDir, 'specialist-template-mappings.ts');
  }

  /**
   * 主执行方法
   */
  public async build(): Promise<void> {
    console.log('🚀 开始构建specialist配置...');
    
    try {
      // 1. 扫描并解析所有content specialist
      const contentSpecialists = await this.scanContentSpecialists();
      console.log(`📋 发现 ${contentSpecialists.length} 个content specialist`);

      // 2. 生成VSCode配置项
      await this.generateVSCodeConfigurations(contentSpecialists);
      console.log('✅ VSCode配置项生成完成');

      // 3. 生成TypeScript映射文件
      await this.generateTypescriptMappings(contentSpecialists);
      console.log('✅ TypeScript映射文件生成完成');

      console.log('🎉 specialist配置构建完成！');

    } catch (error) {
      console.error('❌ 构建失败:', error);
      process.exit(1);
    }
  }

  /**
   * 扫描并解析所有enabled的content specialist
   */
  private async scanContentSpecialists(): Promise<ParsedSpecialist[]> {
    const contentSpecialists: ParsedSpecialist[] = [];
    
    // 扫描content目录
    const contentDir = path.join(this.rulesPath, 'content');
    if (!fs.existsSync(contentDir)) {
      console.warn('⚠️ content目录不存在');
      return contentSpecialists;
    }

    const files = fs.readdirSync(contentDir);
    const specialistFiles = files.filter(file => 
      (file.endsWith('.md') || file.endsWith('.poml')) && file !== '.gitkeep'
    );

    for (const fileName of specialistFiles) {
      const filePath = path.join(contentDir, fileName);
      try {
        const specialist = await this.parseSpecialistFile(filePath, fileName);
        if (specialist && specialist.config.enabled && specialist.config.category === 'content') {
          contentSpecialists.push(specialist);
          console.log(`  ✅ ${specialist.config.id} (${fileName})`);
        } else if (specialist && specialist.config.category === 'content') {
          console.log(`  ⏸️ ${specialist.config.id} (disabled)`);
        }
      } catch (error) {
        console.warn(`  ⚠️ 解析失败: ${fileName} - ${(error as Error).message}`);
      }
    }

    return contentSpecialists;
  }

  /**
   * 解析单个specialist文件
   */
  private async parseSpecialistFile(filePath: string, fileName: string): Promise<ParsedSpecialist | null> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 提取YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      throw new Error('未找到YAML frontmatter');
    }

    const parsed = yaml.load(frontmatterMatch[1]) as any;
    const specialistConfig = parsed?.specialist_config;
    
    if (!specialistConfig) {
      throw new Error('未找到specialist_config配置');
    }

    return {
      config: specialistConfig,
      filePath,
      fileName
    };
  }

  /**
   * 生成VSCode配置项
   */
  private async generateVSCodeConfigurations(specialists: ParsedSpecialist[]): Promise<void> {
    // 读取现有的package.json
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf-8'));
    
    // 确保contributes.configuration.properties存在
    if (!packageJson.contributes) packageJson.contributes = {};
    if (!packageJson.contributes.configuration) packageJson.contributes.configuration = {};
    if (!packageJson.contributes.configuration.properties) packageJson.contributes.configuration.properties = {};

    const properties = packageJson.contributes.configuration.properties;

    // 移除所有现有的srs-writer.templates.*配置（彻底重构，不保留向后兼容）
    const templatesToRemove = Object.keys(properties).filter(key => key.startsWith('srs-writer.templates.'));
    templatesToRemove.forEach(key => {
      delete properties[key];
      console.log(`  🗑️ 移除旧配置: ${key}`);
    });

    // 为每个enabled的content specialist生成配置
    for (const specialist of specialists) {
      const configKey = `srs-writer.templates.${this.toCamelCase(specialist.config.id)}`;
      
      // 🚀 方案3实现：完全依赖specialist配置中的template_files声明
      const templateFiles = specialist.config.template_config?.template_files || {};
      
      // 如果没有template_files声明，跳过并给出警告
      if (Object.keys(templateFiles).length === 0) {
        console.warn(`  ⚠️ ${specialist.config.id} 未配置template_files，跳过模板配置生成`);
        continue;
      }
      
      // 直接使用specialist配置中声明的路径，不做任何修改
      const defaultTemplates: Record<string, string> = { ...templateFiles };

      // 生成VSCode配置项
      const vscodeConfig: VSCodeConfigProperty = {
        type: 'object',
        default: defaultTemplates,
        description: `${specialist.config.name}的模板文件路径配置`,
        properties: {}
      };

      // 为每个模版文件生成属性定义
      Object.keys(defaultTemplates).forEach(templateKey => {
        vscodeConfig.properties![templateKey] = {
          type: 'string',
          description: `${templateKey}模板文件路径`
        };
      });

      properties[configKey] = vscodeConfig;
      console.log(`  ✅ 生成配置: ${configKey} (${Object.keys(defaultTemplates).length}个模版)`);
    }

    // 🚀 方案B: 添加变化检测，只有配置真正变化时才写入package.json
    if (this.shouldUpdatePackageJson(packageJson)) {
      fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`  📝 package.json配置已更新`);
    } else {
      console.log(`  ⏭️ package.json配置无变化，跳过写入`);
    }
  }

  /**
   * 生成TypeScript映射文件
   */
  private async generateTypescriptMappings(specialists: ParsedSpecialist[]): Promise<void> {
    // 确保生成目录存在
    if (!fs.existsSync(this.generatedDir)) {
      fs.mkdirSync(this.generatedDir, { recursive: true });
    }

    // 生成映射对象
    const mappings: Record<string, string> = {};
    specialists.forEach(specialist => {
      mappings[specialist.config.id] = this.toCamelCase(specialist.config.id);
    });

    // 🚀 方案A: 生成TypeScript文件内容（移除动态时间戳）
    const content = `/**
 * 自动生成的specialist模版映射文件
 * 
 * ⚠️ 警告: 此文件由构建脚本自动生成，请勿手动编辑！
 * 
 * 生成脚本: scripts/build-specialist-configs.ts
 * 
 * 用途: 为enabled的content specialist提供VSCode配置键名映射
 */

/**
 * Content specialist的模版配置映射
 * specialist_id -> VSCode配置键名（camelCase）
 */
export const SPECIALIST_TEMPLATE_MAPPINGS: Record<string, string> = ${JSON.stringify(mappings, null, 2)};

/**
 * 检查specialist是否支持模版配置
 */
export function isTemplateConfigSupported(specialistId: string): boolean {
  return specialistId in SPECIALIST_TEMPLATE_MAPPINGS;
}

/**
 * 获取specialist的VSCode配置键名
 */
export function getTemplateConfigKey(specialistId: string): string | undefined {
  return SPECIALIST_TEMPLATE_MAPPINGS[specialistId];
}

/**
 * 获取所有支持模版配置的specialist列表
 */
export function getSupportedTemplateSpecialists(): string[] {
  return Object.keys(SPECIALIST_TEMPLATE_MAPPINGS);
}
`;

    // 🚀 方案B: 添加变化检测，只有内容真正变化时才写入
    if (this.shouldWriteFile(this.mappingFilePath, content)) {
      fs.writeFileSync(this.mappingFilePath, content);
      console.log(`  📁 生成映射文件: ${this.mappingFilePath}`);
      console.log(`  📋 映射数量: ${Object.keys(mappings).length}`);
    } else {
      console.log(`  ⏭️ 映射文件无变化，跳过写入: ${this.mappingFilePath}`);
    }
  }

  /**
   * 转换为camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * 🚀 方案B: 检查是否应该写入文件（内容变化检测）
   */
  private shouldWriteFile(filePath: string, newContent: string): boolean {
    // 如果文件不存在，需要写入
    if (!fs.existsSync(filePath)) {
      return true;
    }

    try {
      // 读取现有文件内容
      const existingContent = fs.readFileSync(filePath, 'utf8');
      
      // 比较内容是否有变化
      return existingContent !== newContent;
    } catch (error) {
      // 读取失败时，选择写入
      console.warn(`  ⚠️ 无法读取现有文件 ${filePath}，将重新生成`);
      return true;
    }
  }

  /**
   * 🚀 方案B: 检查package.json是否需要更新
   */
  private shouldUpdatePackageJson(newConfig: any): boolean {
    try {
      const existingPackageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      
      // 比较contributes.configuration.properties部分
      const existingProps = existingPackageJson?.contributes?.configuration?.properties || {};
      const newProps = newConfig?.contributes?.configuration?.properties || {};
      
      // 深度比较模板配置部分
      const existingTemplateProps = Object.keys(existingProps)
        .filter(key => key.startsWith('srs-writer.templates.'))
        .reduce((acc, key) => ({ ...acc, [key]: existingProps[key] }), {});
      
      const newTemplateProps = Object.keys(newProps)
        .filter(key => key.startsWith('srs-writer.templates.'))
        .reduce((acc, key) => ({ ...acc, [key]: newProps[key] }), {});
      
      return JSON.stringify(existingTemplateProps) !== JSON.stringify(newTemplateProps);
    } catch (error) {
      console.warn(`  ⚠️ 无法读取现有package.json，将重新生成配置`);
      return true;
    }
  }
}

// 执行构建
if (require.main === module) {
  const builder = new SpecialistConfigBuilder();
  builder.build().catch(console.error);
}

export { SpecialistConfigBuilder };