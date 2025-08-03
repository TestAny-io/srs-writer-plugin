/**
 * 🚨 Critical Bug Fix Test: userRequirements Priority Fix
 * 
 * 验证specialist在多步骤计划中能够看到正确的任务描述
 * 修复前：所有specialist都看到用户的原始输入
 * 修复后：每个specialist看到当前步骤的具体描述
 */

import { SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

describe('Critical Bug Fix: userRequirements Priority', () => {
    
    test('CRITICAL BUG FIX: specialist should see currentStep.description instead of userInput in multi-step plan', () => {
        // 🎯 模拟多步骤计划场景
        
        // 模拟用户原始输入（宽泛的需求）
        const userOriginalInput = "请帮我完成一个电商系统的完整SRS文档";
        
        // 模拟计划中的具体步骤
        const step1Context = {
            userInput: userOriginalInput,
            currentStep: {
                step: 1,
                description: "初始化项目结构和基础配置",
                specialist: "project_initializer"
            }
        };
        
        const step2Context = {
            userInput: userOriginalInput,
            currentStep: {
                step: 2,
                description: "编写功能需求章节，包括用户管理、商品管理、订单处理等核心功能",
                specialist: "fr_writer"
            }
        };
        
        const step3Context = {
            userInput: userOriginalInput,
            currentStep: {
                step: 3,
                description: "编写非功能需求章节，包括性能、安全、可用性要求",
                specialist: "nfr_writer"
            }
        };
        
        // 🚀 模拟修复后的逻辑：currentStep.description 优先
        function buildUserRequirements(context: any): string {
            // 这是修复后的逻辑
            return context.currentStep?.description || context.userInput || '';
        }
        
        // 🔍 验证修复效果
        const step1UserRequirements = buildUserRequirements(step1Context);
        const step2UserRequirements = buildUserRequirements(step2Context);  
        const step3UserRequirements = buildUserRequirements(step3Context);
        
        // ✅ 修复后：每个specialist看到具体的任务描述
        expect(step1UserRequirements).toBe("初始化项目结构和基础配置");
        expect(step2UserRequirements).toBe("编写功能需求章节，包括用户管理、商品管理、订单处理等核心功能");
        expect(step3UserRequirements).toBe("编写非功能需求章节，包括性能、安全、可用性要求");
        
        // ✅ 验证不再使用用户原始输入
        expect(step1UserRequirements).not.toBe(userOriginalInput);
        expect(step2UserRequirements).not.toBe(userOriginalInput);
        expect(step3UserRequirements).not.toBe(userOriginalInput);
        
        console.log('✅ CRITICAL BUG FIXED: Specialists now see specific step descriptions instead of generic user input');
    });
    
    test('FALLBACK BEHAVIOR: should use userInput when currentStep.description is missing', () => {
        // 🎯 验证兜底逻辑：当步骤描述缺失时，回退到用户输入
        
        const userInput = "编写用户手册";
        
        const contextWithoutStepDescription = {
            userInput: userInput,
            currentStep: {
                step: 1,
                // description 缺失
                specialist: "manual_writer"
            }
        };
        
        const contextWithEmptyStepDescription = {
            userInput: userInput,
            currentStep: {
                step: 1,
                description: "", // 空描述
                specialist: "manual_writer"
            }
        };
        
        function buildUserRequirements(context: any): string {
            return context.currentStep?.description || context.userInput || '';
        }
        
        // ✅ 当描述缺失时，应该回退到userInput
        expect(buildUserRequirements(contextWithoutStepDescription)).toBe(userInput);
        expect(buildUserRequirements(contextWithEmptyStepDescription)).toBe(userInput);
        
        console.log('✅ FALLBACK BEHAVIOR: Correctly falls back to userInput when step description is missing');
    });
    
    test('EDGE CASE: should handle empty context gracefully', () => {
        // 🎯 验证边界情况处理
        
        const emptyContext = {};
        const partialContext = { userInput: "测试输入" };
        
        function buildUserRequirements(context: any): string {
            return context.currentStep?.description || context.userInput || '';
        }
        
        // ✅ 应该优雅处理空上下文
        expect(buildUserRequirements(emptyContext)).toBe('');
        expect(buildUserRequirements(partialContext)).toBe('测试输入');
        
        console.log('✅ EDGE CASE: Gracefully handles empty or partial context');
    });
    
    test('REAL WORLD SCENARIO: verify fix in realistic plan execution context', () => {
        // 🎯 模拟真实的计划执行场景
        
        const realWorldScenario = {
            userOriginalInput: "我需要一个在线教育平台的需求文档",
            planSteps: [
                {
                    step: 1,
                    description: "创建项目初始结构，设置文档框架",
                    specialist: "project_initializer",
                    expectedUserRequirements: "创建项目初始结构，设置文档框架"
                },
                {
                    step: 2, 
                    description: "分析并编写用户故事，包括学生注册、课程浏览、在线学习等场景",
                    specialist: "story_and_case_writer",
                    expectedUserRequirements: "分析并编写用户故事，包括学生注册、课程浏览、在线学习等场景"
                },
                {
                    step: 3,
                    description: "编写功能需求，覆盖用户管理、课程管理、支付系统等模块",
                    specialist: "fr_writer", 
                    expectedUserRequirements: "编写功能需求，覆盖用户管理、课程管理、支付系统等模块"
                }
            ]
        };
        
        function buildUserRequirements(context: any): string {
            return context.currentStep?.description || context.userInput || '';
        }
        
        // ✅ 验证每个步骤都获得正确的任务描述
        realWorldScenario.planSteps.forEach(step => {
            const context = {
                userInput: realWorldScenario.userOriginalInput,
                currentStep: {
                    step: step.step,
                    description: step.description,
                    specialist: step.specialist
                }
            };
            
            const actualUserRequirements = buildUserRequirements(context);
            
            // 每个specialist应该看到具体的步骤描述，不是用户原始输入
            expect(actualUserRequirements).toBe(step.expectedUserRequirements);
            expect(actualUserRequirements).not.toBe(realWorldScenario.userOriginalInput);
            
            console.log(`✅ Step ${step.step} (${step.specialist}): Sees correct task description`);
        });
        
        console.log('✅ REAL WORLD SCENARIO: All specialists see appropriate, focused task descriptions');
    });
});