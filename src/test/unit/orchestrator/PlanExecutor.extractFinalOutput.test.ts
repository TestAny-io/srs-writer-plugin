import { PlanExecutor } from '../../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../../core/specialistExecutor';
import { SpecialistOutput } from '../../../types/index';

// Mock SpecialistExecutor
const mockSpecialistExecutor = {
  execute: jest.fn()
} as unknown as SpecialistExecutor;

describe('PlanExecutor.extractFinalOutput', () => {
  let planExecutor: PlanExecutor;
  
  beforeEach(() => {
    planExecutor = new PlanExecutor(mockSpecialistExecutor);
  });

  describe('重构后的extractFinalOutput', () => {
    it('应该只保留structuredData和specialist字段', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          content: "第一步内容",
          structuredData: { type: "Step1", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step1_specialist",
            iterations: 2,
            executionTime: 1000,
            timestamp: "2024-01-01T12:00:00Z"
          }
        },
        2: {
          success: true,
          content: "第二步内容",
          structuredData: { type: "Step2", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step2_specialist",
            iterations: 1,
            executionTime: 3000,
            timestamp: "2024-01-01T12:01:00Z"
          }
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      // 应该返回最后一步(step 2)的信息
      expect(result.structuredData.type).toBe('Step2');
      expect(result.specialist).toBe('step2_specialist');
      
      // 不应该包含content和完整metadata
      expect(result).not.toHaveProperty('content');
      expect(result).not.toHaveProperty('metadata');
    });

    it('应该正确处理空结果', () => {
      const result = (planExecutor as any)['extractFinalOutput']({});
      expect(result).toBeNull();
    });

    it('应该正确处理单步结果', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          content: "单步内容",
          structuredData: { type: "SingleStep", data: { test: "value" } },
          requires_file_editing: false,
          metadata: {
            specialist: "single_specialist",
            iterations: 1,
            executionTime: 500,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      expect(result.structuredData.type).toBe('SingleStep');
      expect(result.specialist).toBe('single_specialist');
      expect(result).not.toHaveProperty('content');
    });

    it('应该返回步骤号最大的结果', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "Step1", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step1_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        },
        5: {
          success: true,
          structuredData: { type: "Step5", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step5_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        },
        3: {
          success: true,
          structuredData: { type: "Step3", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step3_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      // 应该返回步骤5的结果
      expect(result.structuredData.type).toBe('Step5');
      expect(result.specialist).toBe('step5_specialist');
    });

    it('应该正确处理缺失metadata的情况', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "Test", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "test_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      expect(result.structuredData.type).toBe('Test');
      expect(result.specialist).toBe('test_specialist');
    });
  });
}); 