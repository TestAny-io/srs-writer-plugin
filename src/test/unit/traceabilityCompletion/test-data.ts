/**
 * 追溯性同步工具测试数据
 * 提供各种测试场景的模拟数据
 */

import { RequirementEntity, RequirementsYAMLStructure } from '../../../tools/document/traceabilityCompletion/types';

/**
 * 简单追溯关系测试数据
 */
export const simpleTraceabilityData: RequirementsYAMLStructure = {
  user_stories: [
    {
      id: "US-ALERT-001",
      title: "用户收到关键告警通知",
      description: "作为系统管理员，我希望能够收到关键系统告警通知，以便及时处理问题。",
      acceptance_criteria: ["收到告警通知", "显示告警详情"],
      priority: "High"
    },
    {
      id: "US-LOGIN-001", 
      title: "用户登录系统",
      description: "作为用户，我希望能够安全登录系统。",
      acceptance_criteria: ["用户名密码验证", "登录成功跳转"],
      priority: "High"
    }
  ],
  
  use_cases: [
    {
      id: "UC-ALERT-001",
      title: "告警处理用例",
      description: "处理系统告警的完整流程",
      preconditions: ["用户已登录", "系统正常运行"],
      main_flow: ["检测告警", "发送通知", "记录日志"]
    }
  ],
  
  functional_requirements: [
    {
      id: "FR-ALERT-001",
      title: "告警通知功能",
      description: "系统应当能够发送告警通知",
      source_requirements: ["US-ALERT-001", "UC-ALERT-001"],
      priority: "High"
    },
    {
      id: "FR-LOGIN-001",
      title: "用户认证功能", 
      description: "系统应当支持用户身份认证",
      source_requirements: ["US-LOGIN-001"],
      priority: "High"
    }
  ],
  
  non_functional_requirements: [
    {
      id: "NFR-PERF-001",
      title: "性能需求",
      description: "告警通知应在2秒内送达",
      source_requirements: ["US-ALERT-001"],
      priority: "Medium"
    }
  ]
};

/**
 * 包含ADC约束的测试数据
 */
export const adcConstraintData: RequirementsYAMLStructure = {
  user_stories: [
    {
      id: "US-AUTH-001",
      title: "用户身份认证",
      description: "用户需要安全认证"
    }
  ],
  
  functional_requirements: [
    {
      id: "FR-AUTH-001",
      title: "认证服务",
      description: "提供用户认证服务",
      source_requirements: ["US-AUTH-001", "ADC-DEPEN-001", "ADC-ASSU-001"]
    },
    {
      id: "FR-DATA-001", 
      title: "数据存储",
      description: "安全存储用户数据",
      source_requirements: ["US-AUTH-001", "ADC-CONST-001"]
    }
  ],
  
  assumptions: [
    {
      id: "ADC-ASSU-001",
      title: "用户网络假设",
      description: "假设用户网络连接稳定",
      rationale: "基于历史数据分析",
      impacted_requirements: ["FR-AUTH-001"]
    }
  ],
  dependencies: [
    {
      id: "ADC-DEPEN-001",
      title: "外部认证服务依赖",
      description: "依赖第三方OAuth服务",
      external_service: "OAuth 2.0",
      impacted_requirements: ["FR-AUTH-001"]
    }
  ],
  constraints: [
    {
      id: "ADC-CONST-001",
      title: "数据保护约束",
      description: "必须符合GDPR要求",
      compliance_requirement: "GDPR",
      impacted_requirements: ["FR-DATA-001"]
    }
  ]
};

/**
 * 包含悬空引用的测试数据
 */
export const danglingReferencesData: RequirementsYAMLStructure = {
  user_stories: [
    {
      id: "US-TEST-001",
      title: "测试用户故事"
    }
  ],
  
  functional_requirements: [
    {
      id: "FR-TEST-001",
      title: "测试功能需求",
      source_requirements: [
        "US-TEST-001",         // 存在
        "US-MISSING-001",      // 不存在 - 悬空引用
        "ADC-MISSING-001"      // 不存在 - 悬空引用  
      ]
    },
    {
      id: "FR-TEST-002",
      title: "另一个测试需求",
      source_requirements: [
        "FR-MISSING-001"       // 不存在 - 悬空引用
      ]
    }
  ]
};

/**
 * 复杂网络关系测试数据
 */
export const complexNetworkData: RequirementsYAMLStructure = {
  user_stories: [
    {
      id: "US-BASE-001",
      title: "基础用户故事"
    },
    {
      id: "US-BASE-002", 
      title: "另一个基础用户故事"
    }
  ],
  
  use_cases: [
    {
      id: "UC-FLOW-001",
      title: "业务流程用例"
    }
  ],
  
  functional_requirements: [
    {
      id: "FR-CORE-001",
      title: "核心功能1",
      source_requirements: ["US-BASE-001", "UC-FLOW-001"]
    },
    {
      id: "FR-CORE-002",
      title: "核心功能2", 
      source_requirements: ["US-BASE-001", "US-BASE-002"]
    },
    {
      id: "FR-CORE-003",
      title: "核心功能3",
      source_requirements: ["UC-FLOW-001"]
    }
  ],
  
  non_functional_requirements: [
    {
      id: "NFR-PERF-001",
      title: "性能需求1",
      source_requirements: ["US-BASE-001"]
    },
    {
      id: "NFR-SEC-001",
      title: "安全需求1",
      source_requirements: ["US-BASE-002", "UC-FLOW-001"]
    }
  ],
  
  interface_requirements: [
    {
      id: "IFR-API-001",
      title: "API接口需求",
      source_requirements: ["US-BASE-001"]
    }
  ],
  
  data_requirements: [
    {
      id: "DAR-STORE-001",
      title: "数据存储需求",
      source_requirements: ["US-BASE-002"]
    }
  ]
};

/**
 * 空文件测试数据
 */
export const emptyData: RequirementsYAMLStructure = {};

/**
 * 预期结果：简单追溯关系
 */
export const expectedSimpleResults = {
  "US-ALERT-001": {
    derived_fr: ["FR-ALERT-001", "NFR-PERF-001"]  // 字母顺序
  },
  "US-LOGIN-001": {
    derived_fr: ["FR-LOGIN-001"]
  },
  "UC-ALERT-001": {
    derived_fr: ["FR-ALERT-001"]
  },
  "FR-ALERT-001": {
    ADC_related: []  // 无ADC引用
  },
  "FR-LOGIN-001": {
    ADC_related: []
  },
  "NFR-PERF-001": {
    ADC_related: []
  }
};

/**
 * 预期结果：ADC约束关系
 */
export const expectedADCResults = {
  "US-AUTH-001": {
    derived_fr: ["FR-AUTH-001", "FR-DATA-001"]  // 字母顺序
  },
  "FR-AUTH-001": {
    ADC_related: ["ADC-ASSU-001", "ADC-DEPEN-001"]  // 字母顺序
  },
  "FR-DATA-001": {
    ADC_related: ["ADC-CONST-001"]
  }
};

/**
 * 预期结果：复杂网络关系
 */
export const expectedComplexResults = {
  "US-BASE-001": {
    derived_fr: ["FR-CORE-001", "FR-CORE-002", "IFR-API-001", "NFR-PERF-001"]
  },
  "US-BASE-002": {
    derived_fr: ["DAR-STORE-001", "FR-CORE-002", "NFR-SEC-001"]
  },
  "UC-FLOW-001": {
    derived_fr: ["FR-CORE-001", "FR-CORE-003", "NFR-SEC-001"]
  }
};

/**
 * 性能测试用的大数据集生成器
 * 使用数组结构（向后兼容测试）
 */
export function generateLargeTestData(entityCount: number): RequirementsYAMLStructure {
  const data: RequirementsYAMLStructure = {
    user_stories: [] as RequirementEntity[],
    functional_requirements: [] as RequirementEntity[],
    non_functional_requirements: [] as RequirementEntity[],
    assumptions: [] as RequirementEntity[],
    dependencies: [] as RequirementEntity[],
    constraints: [] as RequirementEntity[]
  };
  
  // 生成用户故事
  const usCount = Math.floor(entityCount * 0.3);
  for (let i = 1; i <= usCount; i++) {
    (data.user_stories as RequirementEntity[]).push({
      id: `US-PERF-${i.toString().padStart(3, '0')}`,
      title: `性能测试用户故事 ${i}`,
      description: `这是第${i}个性能测试用户故事`
    });
  }
  
  // 生成ADC约束
  const adcCount = Math.floor(entityCount * 0.1);
  for (let i = 1; i <= adcCount; i++) {
    (data.assumptions as RequirementEntity[]).push({
      id: `ADC-ASSU-${i.toString().padStart(3, '0')}`,
      title: `假设 ${i}`,
      description: `性能测试假设 ${i}`,
      impacted_requirements: [`FR-PERF-${i.toString().padStart(3, '0')}`]
    });
  }
  
  // 生成功能需求（引用US和ADC）
  const frCount = Math.floor(entityCount * 0.4);
  for (let i = 1; i <= frCount; i++) {
    const sourceReqs = [];
    
    // 引用一些用户故事
    const usRefs = Math.min(3, usCount);
    for (let j = 1; j <= usRefs; j++) {
      sourceReqs.push(`US-PERF-${j.toString().padStart(3, '0')}`);
    }
    
    // 引用一些ADC约束
    if (i <= adcCount) {
      sourceReqs.push(`ADC-ASSU-${i.toString().padStart(3, '0')}`);
    }
    
    (data.functional_requirements as RequirementEntity[]).push({
      id: `FR-PERF-${i.toString().padStart(3, '0')}`,
      title: `性能测试功能需求 ${i}`,
      description: `这是第${i}个性能测试功能需求`,
      source_requirements: sourceReqs
    });
  }
  
  // 生成非功能需求
  const nfrCount = entityCount - usCount - frCount - adcCount;
  for (let i = 1; i <= nfrCount; i++) {
    const sourceReqs = [];
    
    // 引用一些用户故事
    if (i <= usCount) {
      sourceReqs.push(`US-PERF-${i.toString().padStart(3, '0')}`);
    }
    
    (data.non_functional_requirements as RequirementEntity[]).push({
      id: `NFR-PERF-${i.toString().padStart(3, '0')}`,
      title: `性能测试非功能需求 ${i}`,
      description: `这是第${i}个性能测试非功能需求`,
      source_requirements: sourceReqs
    });
  }
  
  return data;
}

/**
 * Dictionary 结构测试数据（包含新增的实体类型）
 * 测试 risk_analysis, test_levels, test_types, test_environments, test_cases 字段
 */
export const dictionaryStructureData: RequirementsYAMLStructure = {
  use_cases: {
    "UC-AUTH-001": {
      id: "UC-AUTH-001",
      title: "用户认证用例",
      description: "用户登录和认证流程"
    }
  },

  functional_requirements: {
    "FR-AUTH-001": {
      id: "FR-AUTH-001",
      title: "认证功能",
      description: "实现用户认证",
      source_requirements: ["UC-AUTH-001"]
    },
    "FR-SECURE-001": {
      id: "FR-SECURE-001",
      title: "安全传输",
      description: "确保数据安全传输",
      source_requirements: ["UC-AUTH-001"]
    }
  },

  non_functional_requirements: {
    "NFR-PERF-001": {
      id: "NFR-PERF-001",
      title: "认证性能",
      description: "认证响应时间小于1秒",
      source_requirements: ["FR-AUTH-001"]
    }
  },

  // 🆕 新增的实体类型
  risk_analysis: {
    "RISK-SEC-001": {
      id: "RISK-SEC-001",
      title: "安全风险",
      description: "认证系统存在暴力破解风险",
      severity: "high",
      source_requirements: ["FR-AUTH-001"]
    },
    "RISK-PERF-001": {
      id: "RISK-PERF-001",
      title: "性能风险",
      description: "高并发场景下认证可能超时",
      severity: "medium",
      source_requirements: ["NFR-PERF-001"]
    }
  },

  // 注意：测试相关实体（test_levels, test_types, test_environments, test_cases）不在 SRS 范围内
  // 测试策略和测试用例应该在独立的测试文档中管理（遵循 IEEE 829 标准）
}; 