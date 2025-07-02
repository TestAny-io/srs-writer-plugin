import { ConversationalExecutor } from '../../../core/orchestrator/ConversationalExecutor';
import { SessionContext } from '../../../types/session';
import { AIPlan, CallerType } from '../../../types/index';
import { TaskCompletionType, NextStepType } from '../../../types/taskCompletion';

// Mock dependencies
jest.mock('../../../core/toolExecutor');
jest.mock('../../../utils/logger');

const mockToolExecutor = {
  executeTool: jest.fn()
};

jest.doMock('../../../core/toolExecutor', () => ({
  toolExecutor: mockToolExecutor
}));

describe('TaskComplete Integration Tests', () => {
  let conversationalExecutor: ConversationalExecutor;
  let mockSessionContext: SessionContext;
  let mockSelectedModel: any;
  let mockGenerateUnifiedPlan: jest.Mock;
  let mockFormatToolResults: jest.Mock;

  beforeEach(() => {
    conversationalExecutor = new ConversationalExecutor();
    
    mockSessionContext = {
      sessionId: 'test-session',
      sessionContextId: 'test-context-id',
      projectName: 'Test Project',
      baseDir: '/test/project',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0'
      }
    } as SessionContext;

    mockSelectedModel = {
      name: 'test-model'
    };

    mockGenerateUnifiedPlan = jest.fn();
    mockFormatToolResults = jest.fn().mockReturnValue('Formatted results');

    jest.clearAllMocks();
  });

  describe('TaskComplete Signal Processing', () => {
    test('should handle TASK_FINISHED completion type', async () => {
      // Mock taskComplete tool execution
      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: {
          completionType: TaskCompletionType.FULLY_COMPLETED,
          nextStepType: NextStepType.TASK_FINISHED,
          summary: 'SRS document completed successfully',
          deliverables: ['project/SRS.md']
        }
      });

      // Mock finalAnswer tool execution
      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: {
          summary: '任务圆满完成。SRS document completed successfully',
          achievements: ['project/SRS.md'],
          nextSteps: ['项目已完成，可以进行测试或部署']
        }
      });

      const initialPlan: AIPlan = {
        thought: 'Completing SRS task',
        response_mode: 'TOOL_EXECUTION' as any,
        direct_response: null,
        tool_calls: [
          {
            name: 'taskComplete',
            args: {
              completionType: 'FULLY_COMPLETED',
              nextStepType: 'TASK_FINISHED',
              summary: 'SRS document completed successfully',
              deliverables: ['project/SRS.md']
            }
          }
        ]
      };

      const result = await conversationalExecutor.executeConversationalPlanning(
        'Create SRS document',
        mockSessionContext,
        mockSelectedModel,
        initialPlan,
        mockGenerateUnifiedPlan,
        mockFormatToolResults,
        CallerType.ORCHESTRATOR_TOOL_EXECUTION
      );

      expect(result.intent).toBe('task_completed');
      expect(result.result?.mode).toBe('specialist_collaboration_completed');
      expect(result.result?.summary).toBe('SRS document completed successfully');
      
      // Verify taskComplete was called first
      expect(mockToolExecutor.executeTool).toHaveBeenNthCalledWith(1, 
        'taskComplete', 
        expect.any(Object),
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        mockSelectedModel
      );
      
      // Verify finalAnswer was called second
      expect(mockToolExecutor.executeTool).toHaveBeenNthCalledWith(2,
        'finalAnswer',
        expect.objectContaining({
          summary: expect.stringContaining('任务圆满完成'),
          achievements: ['project/SRS.md']
        }),
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        mockSelectedModel
      );
    });

    test('should handle HANDOFF_TO_SPECIALIST completion type', async () => {
      // Mock taskComplete tool execution
      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: {
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
        }
      });

      const initialPlan: AIPlan = {
        thought: 'Completing SRS and handing off to prototype specialist',
        response_mode: 'TOOL_EXECUTION' as any,
        direct_response: null,
        tool_calls: [
          {
            name: 'taskComplete',
            args: {
              completionType: 'READY_FOR_NEXT',
              nextStepType: 'HANDOFF_TO_SPECIALIST',
              summary: 'SRS completed, need prototype',
              deliverables: ['project/SRS.md'],
              nextStepDetails: {
                specialistType: '300_prototype',
                taskDescription: 'Create interactive prototype'
              }
            }
          }
        ]
      };

      // Mock the recursive call result
      mockGenerateUnifiedPlan.mockResolvedValueOnce({
        thought: 'No more work needed',
        response_mode: 'TOOL_EXECUTION',
        direct_response: null,
        tool_calls: []
      });

      const result = await conversationalExecutor.executeConversationalPlanning(
        'Create SRS document',
        mockSessionContext,
        mockSelectedModel,
        initialPlan,
        mockGenerateUnifiedPlan,
        mockFormatToolResults,
        CallerType.ORCHESTRATOR_TOOL_EXECUTION
      );

      // Should call taskComplete
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'taskComplete',
        expect.any(Object),
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        mockSelectedModel
      );
    });

    test('should handle USER_INTERACTION completion type', async () => {
      // Mock taskComplete tool execution
      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: {
          completionType: TaskCompletionType.REQUIRES_REVIEW,
          nextStepType: NextStepType.USER_INTERACTION,
          summary: 'SRS ready for review',
          deliverables: ['project/SRS.md'],
          nextStepDetails: {
            userQuestion: 'Please confirm the technology stack choice'
          }
        }
      });

      const initialPlan: AIPlan = {
        thought: 'Completing SRS but need user confirmation',
        response_mode: 'TOOL_EXECUTION' as any,
        direct_response: null,
        tool_calls: [
          {
            name: 'taskComplete',
            args: {
              completionType: 'REQUIRES_REVIEW',
              nextStepType: 'USER_INTERACTION',
              summary: 'SRS ready for review',
              deliverables: ['project/SRS.md'],
              nextStepDetails: {
                userQuestion: 'Please confirm the technology stack choice'
              }
            }
          }
        ]
      };

      const result = await conversationalExecutor.executeConversationalPlanning(
        'Create SRS document',
        mockSessionContext,
        mockSelectedModel,
        initialPlan,
        mockGenerateUnifiedPlan,
        mockFormatToolResults,
        CallerType.ORCHESTRATOR_TOOL_EXECUTION
      );

      expect(result.intent).toBe('user_interaction_required');
      expect(result.result?.mode).toBe('chat_question');
      expect(result.result?.question).toBe('Please confirm the technology stack choice');
      expect(result.result?.awaitingUserResponse).toBe(true);
    });
  });

  describe('Access Control Verification', () => {
    test('should not allow finalAnswer in tool plans when taskComplete is present', async () => {
      const invalidPlan: AIPlan = {
        thought: 'This should not happen',
        response_mode: 'TOOL_EXECUTION' as any,
        direct_response: null,
        tool_calls: [
          { name: 'taskComplete', args: { /* valid args */ } },
          { name: 'finalAnswer', args: { /* any args */ } }
        ]
      };

      // The system should process taskComplete and ignore finalAnswer
      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: {
          completionType: TaskCompletionType.FULLY_COMPLETED,
          nextStepType: NextStepType.TASK_FINISHED,
          summary: 'Task completed',
          deliverables: ['test.md']
        }
      });

      mockToolExecutor.executeTool.mockResolvedValueOnce({
        success: true,
        result: { summary: 'Final answer called' }
      });

      const result = await conversationalExecutor.executeConversationalPlanning(
        'Test task',
        mockSessionContext,
        mockSelectedModel,
        invalidPlan,
        mockGenerateUnifiedPlan,
        mockFormatToolResults,
        CallerType.ORCHESTRATOR_TOOL_EXECUTION
      );

      // Should process taskComplete first and complete the task
      expect(result.intent).toBe('task_completed');
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'taskComplete',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });
  });
}); 