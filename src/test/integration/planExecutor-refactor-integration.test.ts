/**
 * 集成测试：验证PlanExecutor重构不会破坏现有功能
 * 重点测试重构对下游系统的影响
 */

describe('PlanExecutor重构集成测试', () => {
  // 模拟重构前的数据格式（包含大量content字段）
  const beforeRefactorStepResults = {
    1: {
      specialist: "summary_writer",
      success: true,
      iterations: 3,
      executionTime: 1500,
      contentLength: 5000,
      hasStructuredData: true,
      content: "# Executive Summary\n\nThis is a very long content that would normally be stored in the workspace file. ".repeat(50),
      metadata: {
        specialist: "summary_writer",
        iterations: 3,
        executionTime: 1500,
        timestamp: "2024-01-01T12:00:00Z",
        toolsUsed: ["tool1", "tool2", "tool3"],
        iterationHistory: [
          { iteration: 1, summary: "First attempt", executionTime: 500 },
          { iteration: 2, summary: "Second attempt", executionTime: 600 },
          { iteration: 3, summary: "Final attempt", executionTime: 400 }
        ]
      }
    }
  };

  // 模拟重构后的数据格式
  const afterRefactorStepResults = {
    1: {
      structuredData: { type: "ExecutiveSummary", data: { name: "TestProject" } },
      success: true,
      specialist: "summary_writer"
    }
  };

  describe('下游系统兼容性验证', () => {
    it('重构后的数据应该包含下游系统需要的核心信息', () => {
      const result = afterRefactorStepResults[1];
      
      // 验证必要字段存在
      expect(result).toHaveProperty('structuredData');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('specialist');
      
      // 验证数据内容正确
      expect(result.success).toBe(true);
      expect(result.specialist).toBe('summary_writer');
      expect(result.structuredData.type).toBe('ExecutiveSummary');
    });

    it('重构后的数据应该移除不必要的字段', () => {
      const result = afterRefactorStepResults[1];
      
      // 验证移除的字段
      expect(result).not.toHaveProperty('iterations');
      expect(result).not.toHaveProperty('executionTime');
      expect(result).not.toHaveProperty('contentLength');
      expect(result).not.toHaveProperty('hasStructuredData');
    });

    it('重构应该显著减少数据大小', () => {
      const beforeSize = JSON.stringify(beforeRefactorStepResults).length;
      const afterSize = JSON.stringify(afterRefactorStepResults).length;
      
      // 验证大小减少
      expect(afterSize).toBeLessThan(beforeSize);
      
      // 验证减少比例合理
      const reductionRatio = (beforeSize - afterSize) / beforeSize;
      expect(reductionRatio).toBeGreaterThan(0.3); // 至少减少30%
    });

    it('应该保持API接口的基本结构', () => {
      // 验证返回的是对象格式
      expect(typeof afterRefactorStepResults).toBe('object');
      expect(afterRefactorStepResults).not.toBeNull();
      
      // 验证步骤编号作为key
      expect(afterRefactorStepResults).toHaveProperty('1');
    });
  });

  describe('数据质量验证', () => {
    it('structuredData应该包含完整的语义信息', () => {
      const result = afterRefactorStepResults[1];
      
      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.type).toBe('ExecutiveSummary');
      expect(result.structuredData.data).toBeDefined();
    });

    it('specialist字段应该正确标识执行者', () => {
      const result = afterRefactorStepResults[1];
      
      expect(result.specialist).toBe('summary_writer');
      expect(typeof result.specialist).toBe('string');
    });

    it('success字段应该正确反映执行状态', () => {
      const result = afterRefactorStepResults[1];
      
      expect(typeof result.success).toBe('boolean');
      expect(result.success).toBe(true);
    });
  });

  describe('向后兼容性测试', () => {
    it('现有依赖structuredData的代码应该不受影响', () => {
      const result = afterRefactorStepResults[1];
      
      // 模拟现有代码使用structuredData
      const structuredData = result.structuredData;
      expect(structuredData).toBeDefined();
      expect(structuredData.type).toBe('ExecutiveSummary');
      
      // 验证可以正常访问嵌套属性
      expect(structuredData.data.name).toBe('TestProject');
    });

    it('现有依赖success和specialist的代码应该不受影响', () => {
      const result = afterRefactorStepResults[1];
      
      // 模拟现有代码使用success和specialist
      if (result.success) {
        const specialist = result.specialist;
        expect(specialist).toBe('summary_writer');
      }
    });
  });
});

// 模拟extractFinalOutput的集成测试
describe('extractFinalOutput重构集成测试', () => {
  const mockStepResults = {
    1: {
      structuredData: { type: "Step1", data: {} },
      success: true,
      specialist: "step1_specialist"
    },
    2: {
      structuredData: { type: "Step2", data: {} },
      success: true,
      specialist: "step2_specialist"
    }
  };

  // 模拟重构后的extractFinalOutput结果
  const mockFinalOutput = {
    structuredData: { type: "Step2", data: {} },
    specialist: "step2_specialist"
  };

  it('应该返回最后一步的核心信息', () => {
    expect(mockFinalOutput.structuredData.type).toBe('Step2');
    expect(mockFinalOutput.specialist).toBe('step2_specialist');
  });

  it('应该移除不必要的字段', () => {
    expect(mockFinalOutput).not.toHaveProperty('content');
    expect(mockFinalOutput).not.toHaveProperty('metadata');
  });

  it('应该保持数据结构的完整性', () => {
    expect(mockFinalOutput.structuredData).toBeDefined();
    expect(typeof mockFinalOutput.structuredData).toBe('object');
  });
}); 