import { taskComplete, taskCompleteToolDefinition } from '../../../tools/internal/taskCompleteTools';
import { TaskCompletionType, NextStepType } from '../../../types/taskCompletion';

describe('taskComplete Tool', () => {
  describe('Tool Definition', () => {
    test('should have correct tool name', () => {
      expect(taskCompleteToolDefinition.name).toBe('taskComplete');
    });

    test('should have correct access control', () => {
      expect(taskCompleteToolDefinition.accessibleBy).toEqual(['specialist']);
    });

    test('should have required parameters', () => {
      const required = taskCompleteToolDefinition.parameters.required;
      expect(required).toContain('completionType');
      expect(required).toContain('nextStepType');
      expect(required).toContain('summary');
      expect(required).toContain('deliverables');
    });
  });

  describe('Tool Implementation', () => {
    test('should execute successfully with valid parameters', async () => {
      const params = {
        completionType: TaskCompletionType.FULLY_COMPLETED,
        nextStepType: NextStepType.TASK_FINISHED,
        summary: 'SRS document completed successfully',
        deliverables: ['project/SRS.md', 'Functional requirements: 10 items']
      };

      const result = await taskComplete(params);

      expect(result).toEqual({
        completionType: TaskCompletionType.FULLY_COMPLETED,
        nextStepType: NextStepType.TASK_FINISHED,
        summary: 'SRS document completed successfully',
        deliverables: ['project/SRS.md', 'Functional requirements: 10 items'],
        nextStepDetails: undefined,
        contextForNext: undefined
      });
    });

    test('should execute with specialist handoff parameters', async () => {
      const params = {
        completionType: TaskCompletionType.READY_FOR_NEXT,
        nextStepType: NextStepType.HANDOFF_TO_SPECIALIST,
        summary: 'SRS completed, need prototype',
        deliverables: ['project/SRS.md'],
        nextStepDetails: {
          specialistType: '300_prototype',
          taskDescription: 'Create interactive prototype'
        },
        contextForNext: {
          projectState: { srsCompleted: true }
        }
      };

      const result = await taskComplete(params);

      expect(result.nextStepType).toBe(NextStepType.HANDOFF_TO_SPECIALIST);
      expect(result.nextStepDetails?.specialistType).toBe('300_prototype');
      expect(result.contextForNext?.projectState).toEqual({ srsCompleted: true });
    });

    test('should throw error for empty summary', async () => {
      const params = {
        completionType: TaskCompletionType.FULLY_COMPLETED,
        nextStepType: NextStepType.TASK_FINISHED,
        summary: '',
        deliverables: ['project/SRS.md']
      };

      await expect(taskComplete(params)).rejects.toThrow('summary is required and cannot be empty');
    });

    test('should throw error for invalid deliverables', async () => {
      const params: any = {
        completionType: TaskCompletionType.FULLY_COMPLETED,
        nextStepType: NextStepType.TASK_FINISHED,
        summary: 'Task completed',
        deliverables: null
      };

      await expect(taskComplete(params)).rejects.toThrow('deliverables must be a non-empty array');
    });

    test('should handle user interaction scenario', async () => {
      const params = {
        completionType: TaskCompletionType.REQUIRES_REVIEW,
        nextStepType: NextStepType.USER_INTERACTION,
        summary: 'SRS ready for review',
        deliverables: ['project/SRS.md'],
        nextStepDetails: {
          userQuestion: 'Please confirm the technology stack choice'
        }
      };

      const result = await taskComplete(params);

      expect(result.nextStepType).toBe(NextStepType.USER_INTERACTION);
      expect(result.nextStepDetails?.userQuestion).toBe('Please confirm the technology stack choice');
    });
  });
}); 