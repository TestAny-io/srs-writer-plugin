import { BaseStrategy } from './base-strategy';
import { StrategyOutput, SessionContext } from '../types/session';

/**
 * 编辑SRS策略
 * 处理编辑现有项目的确定性逻辑
 */
export class EditSrsStrategy extends BaseStrategy {
    
    /**
     * 执行编辑SRS的策略
     */
    public async execute(input: string, session: SessionContext): Promise<StrategyOutput> {
        try {
            if (!this.validateInput(input)) {
                throw new Error('Invalid input for SRS editing');
            }

            // 检查是否有活跃项目
            if (!session.projectName) {
                throw new Error('No active project found for editing. Please create a project first.');
            }

            const context = this.prepareContext(input, session);
            
            this.logger.info(`EditSrsStrategy: Preparing to edit project: ${session.projectName}`);
            
            return {
                specialistContext: context,
                ruleToInvoke: '200_edit_srs',
                skipAI: false
            };
            
        } catch (error) {
            this.handleError(error as Error, 'EditSrsStrategy.execute');
        }
    }

    /**
     * 验证编辑SRS的输入
     */
    protected validateInput(input: string): boolean {
        if (!input || typeof input !== 'string') {
            return false;
        }
        
        const trimmedInput = input.trim();
        if (trimmedInput.length < 3) {
            this.logger.warn('Input too short for SRS editing');
            return false;
        }
        
        return true;
    }

    /**
     * 为编辑规则准备上下文
     */
    protected prepareContext(input: string, session: SessionContext): any {
        // 分析编辑意图
        const editIntent = this.analyzeEditIntent(input);
        
        // 检测要编辑的具体部分
        const targetSection = this.detectTargetSection(input);
        
        // 分析编辑类型（添加、修改、删除）
        const editType = this.detectEditType(input);
        
        return {
            userInput: input,
            projectName: session.projectName,
            baseDir: session.baseDir,
            activeFiles: session.activeFiles,
            editIntent: editIntent,
            targetSection: targetSection,
            editType: editType,
            lastModified: new Date().toISOString(),
            strategy: 'edit',
            sessionHistory: {
                lastIntent: session.lastIntent,
                sessionCreated: session.metadata.created
            }
        };
    }

    /**
     * 分析用户的编辑意图
     */
    private analyzeEditIntent(input: string): string {
        const input_lower = input.toLowerCase();
        
        const intentPatterns = {
            'add_requirement': ['添加', '增加', '新增', 'add', 'insert', '加上', '补充'],
            'modify_requirement': ['修改', '更改', '调整', 'modify', 'change', 'update', '改成'],
            'remove_requirement': ['删除', '移除', '去掉', 'remove', 'delete', '取消'],
            'refine_description': ['完善', '细化', '详细', 'refine', 'detail', '补充说明'],
            'change_priority': ['优先级', '重要性', 'priority', '紧急', '关键'],
            'add_acceptance_criteria': ['验收', '标准', 'criteria', '条件', '如何验证']
        };

        for (const [intent, keywords] of Object.entries(intentPatterns)) {
            if (keywords.some(keyword => input_lower.includes(keyword))) {
                return intent;
            }
        }
        
        return 'general_edit';
    }

    /**
     * 检测目标编辑部分
     */
    private detectTargetSection(input: string): string {
        const input_lower = input.toLowerCase();
        
        const sectionPatterns = {
            'functional_requirements': ['功能需求', '功能', 'functional', 'feature', '特性'],
            'non_functional_requirements': ['非功能需求', '性能', '安全', 'performance', 'security', 'nfr'],
            'user_interface': ['界面', '页面', 'ui', 'interface', '前端', '用户界面'],
            'api_design': ['接口', 'api', '数据', 'endpoint', '服务'],
            'database': ['数据库', 'database', '数据存储', '表结构'],
            'architecture': ['架构', 'architecture', '系统设计', '技术栈'],
            'business_rules': ['业务规则', '业务逻辑', 'business', '流程'],
            'user_stories': ['用户故事', 'user story', '用户需求', '使用场景']
        };

        for (const [section, keywords] of Object.entries(sectionPatterns)) {
            if (keywords.some(keyword => input_lower.includes(keyword))) {
                return section;
            }
        }
        
        return 'general';
    }

    /**
     * 检测编辑类型
     */
    private detectEditType(input: string): string {
        const input_lower = input.toLowerCase();
        
        if (input_lower.includes('添加') || input_lower.includes('新增') || 
            input_lower.includes('add') || input_lower.includes('增加')) {
            return 'add';
        }
        
        if (input_lower.includes('删除') || input_lower.includes('移除') || 
            input_lower.includes('remove') || input_lower.includes('delete')) {
            return 'remove';
        }
        
        if (input_lower.includes('修改') || input_lower.includes('更改') || 
            input_lower.includes('modify') || input_lower.includes('change')) {
            return 'modify';
        }
        
        return 'modify'; // 默认为修改
    }

    /**
     * 验证当前项目状态
     */
    public validateProjectState(session: SessionContext): boolean {
        if (!session.projectName) {
            this.logger.warn('No active project for editing');
            return false;
        }
        
        if (!session.baseDir) {
            this.logger.warn('No base directory found for project');
            return false;
        }
        
        return true;
    }

    /**
     * 生成编辑操作的描述
     */
    public generateEditDescription(input: string, session: SessionContext): string {
        const context = this.prepareContext(input, session);
        
        return `Edit operation on project "${session.projectName}": ${context.editType} ${context.targetSection} - ${input}`;
    }
}
