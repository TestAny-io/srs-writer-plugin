/**
 * Project Initializer Specialist配置更新测试
 * 验证specialist提示词与新的双分支策略的一致性
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Project Initializer Specialist Update', () => {
    let specialistContent: string;

    beforeAll(() => {
        // 读取specialist配置文件
        const specialistPath = path.join(__dirname, '../../..', 'rules/specialists/process/project_initializer.md');
        specialistContent = fs.readFileSync(specialistPath, 'utf8');
    });

    describe('Git Branch Strategy Updates', () => {
        it('should mention wip branch in git branch management section', () => {
            expect(specialistContent).toContain('Git分支管理');
            expect(specialistContent).toContain('wip工作分支');
            expect(specialistContent).toContain('自动处理分支切换');
        });

        it('should explain the new dual-branch workflow', () => {
            expect(specialistContent).toContain('新的双分支工作流');
            expect(specialistContent).toContain('main分支: 稳定版本分支');
            expect(specialistContent).toContain('wip分支: 日常工作分支');
        });

        it('should describe createNewProjectFolder tool behavior correctly', () => {
            expect(specialistContent).toContain('createNewProjectFolder工具行为');
            expect(specialistContent).toContain('自动检测当前分支');
            expect(specialistContent).toContain('切换到wip分支');
            expect(specialistContent).toContain('不再为每个项目创建独立的SRS/项目名分支');
        });

        it('should update workflow steps to reflect new strategy', () => {
            expect(specialistContent).toContain('确保在wip工作分支上');
            expect(specialistContent).not.toContain('创建Git工作分支');
        });

        it('should update variable replacement explanation', () => {
            expect(specialistContent).toContain('{{GIT_BRANCH}}');
            expect(specialistContent).toContain('统一使用 "wip" 工作分支');
            expect(specialistContent).not.toContain('SRS/{{PROJECT_NAME}}');
        });
    });

    describe('Consistency with Implementation', () => {
        it('should align with createNewProjectFolder tool changes', () => {
            // 验证specialist描述与实际工具行为一致
            
            // 工具现在确保在wip分支上创建项目
            expect(specialistContent).toContain('wip工作分支上创建');
            
            // 工具自动处理分支切换
            expect(specialistContent).toContain('自动处理分支切换');
            
            // 不再创建项目特定分支
            expect(specialistContent).toContain('不再为每个项目创建独立的');
        });

        it('should not reference old SRS/projectName branch pattern', () => {
            // 确保没有引用旧的分支模式
            expect(specialistContent).not.toContain('SRS/{{PROJECT_NAME}}');
            expect(specialistContent).not.toContain('项目特定分支');
            expect(specialistContent).not.toContain('为每个项目创建分支');
        });

        it('should maintain core functionality descriptions', () => {
            // 验证核心功能描述保持不变
            expect(specialistContent).toContain('项目目录创建');
            expect(specialistContent).toContain('基础文件生成');
            expect(specialistContent).toContain('目录结构建立');
            expect(specialistContent).toContain('任务完成确认');
        });
    });

    describe('Documentation Quality', () => {
        it('should have clear and consistent language', () => {
            // 验证文档语言清晰一致
            expect(specialistContent).toMatch(/Git分支管理.*确保.*wip.*工作分支/);
            expect(specialistContent).toMatch(/双分支工作流/);
        });

        it('should provide practical guidance', () => {
            // 验证提供了实用的指导
            expect(specialistContent).toContain('自动检测当前分支');
            expect(specialistContent).toContain('自动提交当前更改');
            expect(specialistContent).toContain('确保所有新项目都在wip分支上创建');
        });

        it('should maintain proper markdown structure', () => {
            // 验证markdown结构正确
            expect(specialistContent).toContain('## 📋 核心职责');
            expect(specialistContent).toContain('### 🌿 Git分支策略说明');
            expect(specialistContent).toContain('## 🛠️ 标准工作流程');
        });
    });

    describe('Template and Examples', () => {
        it('should maintain correct JSON template structure', () => {
            expect(specialistContent).toContain('"name": "createNewProjectFolder"');
            expect(specialistContent).toContain('"name": "writeFile"');
            expect(specialistContent).toContain('"name": "taskComplete"');
        });

        it('should include correct file templates', () => {
            expect(specialistContent).toContain('requirements.yaml');
            expect(specialistContent).toContain('srs-writer-log.json');
            expect(specialistContent).toContain('SRS.md');
            expect(specialistContent).toContain('prototype/');
        });

        it('should reference correct variable placeholders', () => {
            expect(specialistContent).toContain('{{PROJECT_NAME}}');
            expect(specialistContent).toContain('{{DATE}}');
            expect(specialistContent).toContain('{{GIT_BRANCH}}');
        });
    });
});
