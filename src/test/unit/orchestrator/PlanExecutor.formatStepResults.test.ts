import { PlanExecutor } from '../../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../../core/specialistExecutor';
import { SpecialistOutput } from '../../../types/index';

// Mock SpecialistExecutor
const mockSpecialistExecutor = {
  execute: jest.fn()
} as unknown as SpecialistExecutor;

describe('PlanExecutor.formatStepResults', () => {
  let planExecutor: PlanExecutor;
  
  beforeEach(() => {
    planExecutor = new PlanExecutor(mockSpecialistExecutor);
  });

  describe('重构后的formatStepResults', () => {
    it('应该只保留structuredData, success, specialist字段', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          content: "# 执行摘要\n\n项目概述...",
          structuredData: { type: "ExecutiveSummary", data: { name: "TestProject" } },
          requires_file_editing: false,
          metadata: {
            specialist: "summary_writer",
            iterations: 3,
            executionTime: 1500,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      // ✅ 应该保留的字段
      expect(result[1]).toHaveProperty('structuredData');
      expect(result[1]).toHaveProperty('success');
      expect(result[1]).toHaveProperty('specialist');
      
      // ❌ 应该移除的字段
      expect(result[1]).not.toHaveProperty('content');
      expect(result[1]).not.toHaveProperty('contentLength');
      expect(result[1]).not.toHaveProperty('hasStructuredData');
      expect(result[1]).not.toHaveProperty('iterations');
      expect(result[1]).not.toHaveProperty('executionTime');
      
      // 验证保留字段的值
      expect(result[1].structuredData.type).toBe('ExecutiveSummary');
      expect(result[1].success).toBe(true);
      expect(result[1].specialist).toBe('summary_writer');
    });

    it('应该正确处理缺失字段的情况', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: false,
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

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].structuredData).toBeNull();
      expect(result[1].success).toBe(false);
      expect(result[1].specialist).toBe('test_specialist');
    });

    it('应该正确处理空的stepResults', () => {
      const result = (planExecutor as any)['formatStepResults']({});
      expect(result).toEqual({});
    });

    it('应该正确处理null/undefined值', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          content: undefined,
          structuredData: undefined,
          requires_file_editing: false,
          metadata: {
            specialist: "test_specialist",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(result[1].structuredData).toBeUndefined();
      expect(result[1].success).toBe(true);
      expect(result[1].specialist).toBe('test_specialist');
    });

    it('应该正确处理多个步骤', () => {
      const stepResults: { [key: number]: SpecialistOutput } = {
        1: {
          success: true,
          structuredData: { type: "ExecutiveSummary", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "summary_writer",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        },
        2: {
          success: true,
          structuredData: { type: "OverallDescription", data: {} },
          requires_file_editing: false,
          metadata: {
            specialist: "overall_description_writer",
            iterations: 1,
            executionTime: 100,
            timestamp: "2024-01-01T12:00:00Z"
          }
        }
      };

      const result = (planExecutor as any)['formatStepResults'](stepResults);
      
      expect(Object.keys(result)).toHaveLength(2);
      expect(result[1].specialist).toBe('summary_writer');
      expect(result[2].specialist).toBe('overall_description_writer');
    });
  });
}); 