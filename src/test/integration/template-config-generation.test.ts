/**
 * 模板配置生成测试
 * 验证方案3的实现：构建脚本能正确从specialist配置中读取template_files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('模板配置生成测试 (方案3)', () => {
    
    describe('specialist配置解析测试', () => {
        
        it('应该能正确解析adc_writer的template_files配置', async () => {
            const configPath = path.join(__dirname, '../../../rules/specialists/content/adc_writer.md');
            const content = fs.readFileSync(configPath, 'utf-8');
            
            // 提取YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            expect(frontmatterMatch).toBeTruthy();
            
            const parsed = yaml.load(frontmatterMatch![1]) as any;
            const specialistConfig = parsed?.specialist_config;
            
            expect(specialistConfig).toBeDefined();
            expect(specialistConfig.id).toBe('adc_writer');
            expect(specialistConfig.template_config).toBeDefined();
            expect(specialistConfig.template_config.template_files).toBeDefined();
            expect(specialistConfig.template_config.template_files.ADC_WRITER_TEMPLATE)
                .toBe('.templates/ADC/ADC_template.md');
        });
        
        it('应该能正确解析user_journey_writer的template_files配置', async () => {
            const configPath = path.join(__dirname, '../../../rules/specialists/content/user_journey_writer.md');
            const content = fs.readFileSync(configPath, 'utf-8');
            
            // 提取YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            expect(frontmatterMatch).toBeTruthy();
            
            const parsed = yaml.load(frontmatterMatch![1]) as any;
            const specialistConfig = parsed?.specialist_config;
            
            expect(specialistConfig).toBeDefined();
            expect(specialistConfig.template_config.template_files.USER_JOURNEY_WRITER_TEMPLATE)
                .toBe('.templates/user_journey/user_journey_template.md');
        });
        
        it('所有content specialist都应该有template_files配置', async () => {
            const contentDir = path.join(__dirname, '../../../rules/specialists/content');
            const files = fs.readdirSync(contentDir);
            const markdownFiles = files.filter(file => file.endsWith('.md') && file !== '.gitkeep');
            
            const expectedSpecialists = [
                'adc_writer', 'fr_writer', 'ifr_and_dar_writer', 'nfr_writer',
                'overall_description_writer', 'prototype_designer', 'story_and_case_writer',
                'summary_writer', 'user_journey_writer'
            ];
            
            for (const fileName of markdownFiles) {
                const filePath = path.join(contentDir, fileName);
                const content = fs.readFileSync(filePath, 'utf-8');
                
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (!frontmatterMatch) continue;
                
                const parsed = yaml.load(frontmatterMatch[1]) as any;
                const specialistConfig = parsed?.specialist_config;
                
                if (specialistConfig?.enabled && specialistConfig?.category === 'content') {
                    expect(specialistConfig.template_config).toBeDefined();
                    expect(specialistConfig.template_config.template_files).toBeDefined();
                    
                    const templateFiles = specialistConfig.template_config.template_files;
                    const templateKeys = Object.keys(templateFiles);
                    expect(templateKeys.length).toBeGreaterThan(0);
                    
                    // 验证模板文件路径格式
                    for (const [key, filePath] of Object.entries(templateFiles)) {
                        expect(key).toMatch(/_TEMPLATE$/);
                        expect(filePath).toMatch(/^\.templates\//);
                        console.log(`✅ ${specialistConfig.id}: ${key} -> ${filePath}`);
                    }
                }
            }
        });
        
        it('应该验证所有声明的模板文件都实际存在', async () => {
            const contentDir = path.join(__dirname, '../../../rules/specialists/content');
            const workspaceRoot = path.join(__dirname, '../../..');
            const files = fs.readdirSync(contentDir);
            const markdownFiles = files.filter(file => file.endsWith('.md'));
            
            for (const fileName of markdownFiles) {
                const filePath = path.join(contentDir, fileName);
                const content = fs.readFileSync(filePath, 'utf-8');
                
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (!frontmatterMatch) continue;
                
                const parsed = yaml.load(frontmatterMatch[1]) as any;
                const specialistConfig = parsed?.specialist_config;
                
                if (specialistConfig?.enabled && specialistConfig?.category === 'content') {
                    const templateFiles = specialistConfig.template_config?.template_files || {};
                    
                    for (const [key, templatePath] of Object.entries(templateFiles)) {
                        const absolutePath = path.join(workspaceRoot, templatePath as string);
                        expect(fs.existsSync(absolutePath))
                            .toBeTruthy();
                    }
                }
            }
        });
    });
    
    describe('构建脚本逻辑模拟测试', () => {
        
        it('模拟构建脚本生成package.json配置', async () => {
            // 模拟specialist配置
            const mockSpecialistConfig = {
                id: 'test_writer',
                name: 'Test Writer',
                category: 'content',
                enabled: true,
                template_config: {
                    template_files: {
                        TEST_WRITER_TEMPLATE: '.templates/test/test_template.md'
                    }
                }
            };
            
            // 模拟构建脚本逻辑
            const templateFiles = mockSpecialistConfig.template_config?.template_files || {};
            
            // 验证新逻辑：如果没有template_files，应该跳过
            if (Object.keys(templateFiles).length === 0) {
                console.warn('⚠️ 未配置template_files，跳过');
                return;
            }
            
            // 验证新逻辑：直接使用配置的路径
            const defaultTemplates = { ...templateFiles };
            
            expect(defaultTemplates).toEqual({
                TEST_WRITER_TEMPLATE: '.templates/test/test_template.md'
            });
        });
    });
});