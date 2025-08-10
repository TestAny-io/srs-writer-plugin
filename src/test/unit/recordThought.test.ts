/**
 * recordThought工具单元测试
 * 
 * 验证recordThought工具的定义、注册和基本功能
 */

import { 
    recordThoughtToolDefinition, 
    recordThought, 
    ThinkingType 
} from '../../tools/internal/recordThoughtTools';
import { CallerType } from '../../types/index';
import { toolRegistry } from '../../tools/index';

describe('recordThought Tool', () => {
    
    describe('Tool Definition', () => {
        
        it('should have correct basic properties', () => {
            expect(recordThoughtToolDefinition.name).toBe('recordThought');
            expect(recordThoughtToolDefinition.description).toContain('专家级结构化思考记录工具');
            expect(recordThoughtToolDefinition.accessibleBy).toEqual([CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]);
        });
        
        it('should have correct parameters schema', () => {
            const params = recordThoughtToolDefinition.parameters;
            
            expect(params.type).toBe('object');
            expect(params.required).toEqual(['thinkingType', 'content']);
            
            // 验证thinkingType参数
            expect(params.properties.thinkingType.type).toBe('string');
            expect(params.properties.thinkingType.enum).toEqual([
                'planning', 'analysis', 'synthesis', 'reflection', 'derivation'
            ]);
            
            // 验证content参数
            expect(params.properties.content.type).toBe('object');
            expect(params.properties.content.additionalProperties).toBe(true);
            
            // 验证可选参数
            expect(params.properties.nextSteps.type).toBe('array');
            expect(params.properties.context.type).toBe('string');
        });
        
        it('should have correct access control and classification', () => {
            expect(recordThoughtToolDefinition.accessibleBy).toEqual([CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]);
            expect(recordThoughtToolDefinition.interactionType).toBe('autonomous');
            expect(recordThoughtToolDefinition.riskLevel).toBe('low');
            expect(recordThoughtToolDefinition.requiresConfirmation).toBe(false);
        });
        
        it('should have comprehensive calling guide', () => {
            const guide = recordThoughtToolDefinition.callingGuide;
            
            expect(guide).toBeDefined();
            expect(guide?.whenToUse).toContain('复杂内容前记录思考过程');
            expect(guide?.inputRequirements).toBeDefined();
            expect(guide?.internalWorkflow).toBeInstanceOf(Array);
            expect(guide?.commonPitfalls).toBeInstanceOf(Array);
        });
    });
    
    describe('Tool Implementation', () => {
        
        it('should successfully record planning thoughts', async () => {
            const params = {
                thinkingType: 'planning' as ThinkingType,
                content: {
                    goal: 'Generate comprehensive NFR section',
                    approach: 'Analyze system characteristics and define quality attributes',
                    steps: ['identify_qualities', 'define_metrics', 'specify_constraints']
                },
                context: 'SRS document generation task',
                nextSteps: ['executeSemanticEdits', 'review_generated_content']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord).toBeDefined();
            expect(result.thoughtRecord.thinkingType).toBe('planning');
            expect(result.thoughtRecord.content).toEqual(params.content);
            expect(result.thoughtRecord.nextSteps).toEqual(params.nextSteps);
            expect(result.thoughtRecord.context).toBe(params.context);
            expect(result.thoughtRecord.timestamp).toBeDefined();
            expect(result.thoughtRecord.thoughtId).toMatch(/^thought_\d+_\w+$/);
        });
        
        it('should handle different thinking types', async () => {
            const thinkingTypes: ThinkingType[] = ['analysis', 'synthesis', 'reflection', 'derivation'];
            
            for (const type of thinkingTypes) {
                const params = {
                    thinkingType: type,
                    content: { testType: type, description: `Testing ${type} thinking` }
                };
                
                const result = await recordThought(params);
                
                expect(result.success).toBe(true);
                expect(result.thoughtRecord.thinkingType).toBe(type);
            }
        });
        
        it('should handle minimal parameters (only required fields)', async () => {
            const params = {
                thinkingType: 'analysis' as ThinkingType,
                content: { observation: 'Simple analysis result' }
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('analysis');
            expect(result.thoughtRecord.content).toEqual(params.content);
            expect(result.thoughtRecord.nextSteps).toBeUndefined();
            expect(result.thoughtRecord.context).toBeUndefined();
        });
        
        it('should handle string content', async () => {
            const params = {
                thinkingType: 'reflection' as ThinkingType,
                content: 'This is a reflection on the current approach'
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.content).toBe(params.content);
        });
        
        it('should reject invalid content', async () => {
            const params = {
                thinkingType: 'planning' as ThinkingType,
                content: null
            };
            
            await expect(recordThought(params)).rejects.toThrow(
                'recordThought: content is required and must be an object or string'
            );
        });
        
        it('should generate unique thought IDs', async () => {
            const params = {
                thinkingType: 'planning' as ThinkingType,
                content: { test: 'uniqueness' }
            };
            
            const result1 = await recordThought(params);
            const result2 = await recordThought(params);
            
            expect(result1.thoughtRecord.thoughtId).not.toBe(result2.thoughtRecord.thoughtId);
        });
    });
    
    describe('Tool Registry Integration', () => {
        
        it('should be properly registered in ToolRegistry', () => {
            // 验证工具已注册
            const definition = toolRegistry.getToolDefinition('recordThought');
            expect(definition).toBeDefined();
            
            if (definition) {
                expect(definition.name).toBe('recordThought');
                expect(definition.layer).toBe('internal');
                expect(definition.accessibleBy).toEqual([CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]);
            }
        });
        
        it('should have correct access control configuration', () => {
            const definition = toolRegistry.getToolDefinition('recordThought');
            
            expect(definition).toBeDefined();
            if (definition) {
                // 验证工具定义中的访问控制配置
                expect(definition.accessibleBy).toEqual([CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]);
                expect(definition.interactionType).toBe('autonomous');
                expect(definition.riskLevel).toBe('low');
                expect(definition.requiresConfirmation).toBe(false);
            }
        });
    });
}); 