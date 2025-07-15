import { PlanExecutor } from '../../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../../core/specialistExecutor';
import { SpecialistOutput } from '../../../types/index';

// Mock SpecialistExecutor
const mockSpecialistExecutor = {
  execute: jest.fn()
} as unknown as SpecialistExecutor;

describe('PlanExecutor 重构后边界情况测试', () => {
  let planExecutor: PlanExecutor;
  
  beforeEach(() => {
    planExecutor = new PlanExecutor(mockSpecialistExecutor);
  });

  describe('formatStepResults边界情况', () => {
    it('应该正确处理undefined metadata', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "Test", data: {} },
          requires_file_editing: false,
          metadata: undefined as any
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].structuredData.type).toBe('Test');
      expect(result[1].success).toBe(true);
      expect(result[1].specialist).toBe('unknown');
    });

    it('应该正确处理metadata中specialist为空的情况', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "Test", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].specialist).toBe('');
    });

    it('应该正确处理复杂的structuredData', () => {
      const complexData = {
        type: "ComplexData",
        data: {
          nested: {
            arrays: [1, 2, 3],
            objects: { key: "value" }
          }
        }
      };

      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: complexData,
          requires_file_editing: false,
          metadata: {
            specialist: "complex_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].structuredData).toEqual(complexData);
    });

    it('应该正确处理失败的步骤', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: false,
          error: "Something went wrong",
          structuredData: null,
          requires_file_editing: false,
          metadata: {
            specialist: "failed_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].success).toBe(false);
      expect(result[1].structuredData).toBeNull();
      expect(result[1].specialist).toBe('failed_specialist');
    });
  });

  describe('extractFinalOutput边界情况', () => {
    it('应该正确处理undefined metadata', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "Test", data: {} },
          requires_file_editing: false,
          metadata: undefined as any
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      expect(result.structuredData.type).toBe('Test');
      expect(result.specialist).toBeUndefined();
    });

    it('应该正确处理null structuredData', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: null,
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
      
      expect(result.structuredData).toBeNull();
      expect(result.specialist).toBe('test_specialist');
    });

    it('应该正确处理非连续的步骤编号', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        2: {
          success: true,
          structuredData: { type: "Step2", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step2_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        },
        10: {
          success: true,
          structuredData: { type: "Step10", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "step10_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['extractFinalOutput'](stepResults);
      
      // 应该返回步骤10的结果
      expect(result.structuredData.type).toBe('Step10');
      expect(result.specialist).toBe('step10_specialist');
    });
  });

  describe('Token效率测试', () => {
    it('重构后应该减少序列化大小', () => {
      // 创建一个包含大量数据的stepResults
      const stepResults: { [key: number]: SpecialistOutput } = {};
      
      for (let i = 1; i <= 5; i++) {
        stepResults[i] = {
          success: true,
          content: `# 第${i}步内容\n\n这是一个很长的内容，用于测试token效率。`.repeat(10),
          structuredData: { type: `Step${i}`, data: { stepNumber: i } },
          requires_file_editing: false,
          metadata: {
            specialist: `step${i}_specialist`,
            iterations: 3,
            executionTime: 1500,
            timestamp: "2024-01-01T12:00:00Z",
            toolsUsed: ["tool1", "tool2", "tool3"]
          }
        };
      }

      // 测试重构后的输出大小
      const formattedResults = (planExecutor as any)['formatStepResults'](stepResults);
      const originalSize = JSON.stringify(stepResults).length;
      const formattedSize = JSON.stringify(formattedResults).length;

      // 重构后应该显著减少大小
      expect(formattedSize).toBeLessThan(originalSize * 0.5);
    });
  });
}); 