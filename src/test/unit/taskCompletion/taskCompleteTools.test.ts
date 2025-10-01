import { taskComplete, taskCompleteToolDefinition } from '../../../tools/internal/taskCompleteTools';
import { NextStepType } from '../../../types/taskCompletion';

describe('taskComplete Tool', () => {
  describe('Tool Definition', () => {
    test('should have correct tool name', () => {
      expect(taskCompleteToolDefinition.name).toBe('taskComplete');
    });

    test('should have correct access control', () => {
      expect(taskCompleteToolDefinition.accessibleBy).toEqual(['specialist:content', 'specialist:process']);
    });

    test('should have required parameters', () => {
      const required = taskCompleteToolDefinition.parameters.required;
      expect(required).toContain('nextStepType');
      expect(required).toContain('summary');
      expect(required).not.toContain('completionType'); // 已移除
    });
  });

  describe('Tool Implementation', () => {
    test('should execute successfully with valid parameters', async () => {
      const params = {
        nextStepType: NextStepType.TASK_FINISHED,
        summary: 'SRS document completed successfully'
      };

      const result = await taskComplete(params);

      expect(result).toEqual({
        nextStepType: NextStepType.TASK_FINISHED,
        summary: 'SRS document completed successfully',
        contextForNext: undefined
      });
    });

    test('should execute with specialist handoff parameters', async () => {
      const params = {
        nextStepType: NextStepType.HANDOFF_TO_SPECIALIST,
        summary: 'SRS completed, need next step',
        contextForNext: {
          deliverables: ['SRS document']
        }
      };

      const result = await taskComplete(params);

      expect(result.nextStepType).toBe(NextStepType.HANDOFF_TO_SPECIALIST);
      expect(result.contextForNext?.deliverables).toEqual(['SRS document']);
    });

    test('should throw error for empty summary', async () => {
      const params = {
        nextStepType: NextStepType.TASK_FINISHED,
        summary: ''
      };

      await expect(taskComplete(params)).rejects.toThrow('summary is required and cannot be empty');
    });

    test('should handle continue same specialist scenario', async () => {
      const params = {
        nextStepType: NextStepType.CONTINUE_SAME_SPECIALIST,
        summary: 'Partial work completed, continuing',
        contextForNext: {
          deliverables: ['Phase analysis completed']
        }
      };

      const result = await taskComplete(params);

      expect(result.nextStepType).toBe(NextStepType.CONTINUE_SAME_SPECIALIST);
      expect(result.contextForNext?.deliverables).toEqual(['Phase analysis completed']);
    });
  });
}); 