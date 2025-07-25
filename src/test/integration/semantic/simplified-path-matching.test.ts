/**
 * 简化路径匹配功能测试
 * 
 * 测试在单根标题文档中使用 [heading2, target] 格式的简化路径匹配功能
 */

import { SemanticLocator } from '../../../tools/atomic/semantic-locator';
import { Logger } from '../../../utils/logger';

const logger = Logger.getInstance();

describe('Simplified Path Matching', () => {
    let locator: SemanticLocator;

    // 测试文档：单根标题结构
    const testMarkdown = `# WeChatAdRiskInterceptor - 软件需求规格说明书

## 2. 总体描述 (Overall Description)

### 项目背景与目的
项目背景说明...

### 功能定位
功能定位说明...

## 3. 用户旅程 (User Journeys)

### 用户角色定义
#### 广告商
广告商背景...

#### 广告运营人员
运营人员背景...

---
#### 广告页面访问与风险弹窗拦截旅程
旅程描述...

## 4. 用户故事和用例视图 (User Stories & Use-Case View)

### 用户故事
- **US-ALERT-001**: 自动拦截广告风险弹窗

### 用例视图
#### 用例总览图
用例图说明...

#### 用例规格说明
- **UC-ALERT-001**: 访问广告页面并自动拦截风险弹窗
- **UC-ALERT-002**: 广告点击率自动统计

## 5. 功能需求 (Functional Requirements)

### 5.1 基于用例UC-ALERT-001的功能需求
#### FR-ALERT-001: 自动拦截广告风险弹窗
需求描述...

#### FR-ALERT-002: 异常拦截与数据统计
需求描述...
`;

    beforeEach(() => {
        // 创建语义定位器实例
        locator = new SemanticLocator(testMarkdown);
    });

    describe('成功的简化路径匹配', () => {
        
        test('应该成功匹配 [heading2, target] 格式的简化路径', () => {
            // 测试用例1：匹配用例规格说明中的UC-ALERT-001
            const result = locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                'UC-ALERT-001'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('**UC-ALERT-001**: 访问广告页面并自动拦截风险弹窗');
            expect(result!.path).toEqual([
                'WeChatAdRiskInterceptor - 软件需求规格说明书',
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图',
                '用例规格说明',
                '**UC-ALERT-001**: 访问广告页面并自动拦截风险弹窗'
            ]);
        });

        test('应该成功匹配功能需求中的FR-ALERT-001', () => {
            const result = locator.findSectionByPath([
                '5. 功能需求 (Functional Requirements)',
                'FR-ALERT-001'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('FR-ALERT-001: 自动拦截广告风险弹窗');
            expect(result!.path).toEqual([
                'WeChatAdRiskInterceptor - 软件需求规格说明书',
                '5. 功能需求 (Functional Requirements)',
                '5.1 基于用例UC-ALERT-001的功能需求',
                'FR-ALERT-001: 自动拦截广告风险弹窗'
            ]);
        });

        test('应该支持包含式匹配', () => {
            // 使用部分名称匹配
            const result = locator.findSectionByPath([
                '用户故事和用例视图',  // 省略编号前缀
                'UC-ALERT-002'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('**UC-ALERT-002**: 广告点击率自动统计');
        });

        test('应该匹配用户旅程中的特殊章节', () => {
            const result = locator.findSectionByPath([
                '3. 用户旅程 (User Journeys)',
                '广告页面访问与风险弹窗拦截旅程'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('广告页面访问与风险弹窗拦截旅程');
        });
    });

    describe('多重匹配错误处理', () => {
        
        test('当简化路径匹配到多个结果时应抛出错误', () => {
            // 创建包含重复名称的测试文档 - 让第一层章节不同但目标元素相同
            const ambiguousMarkdown = `# 测试文档

## 2. 章节A
### 子章节1
#### 目标元素
内容A...

## 3. 章节A  
### 子章节2
#### 目标元素
内容B...
`;
            
            const ambiguousLocator = new SemanticLocator(ambiguousMarkdown);
            
            expect(() => {
                ambiguousLocator.findSectionByPath(['章节A', '目标元素']);
            }).toThrow(/matches multiple locations/);
        });

        test('错误信息应该包含所有匹配的完整路径', () => {
            const ambiguousMarkdown = `# 测试文档

## 2. 章节A
### 子章节1
#### 重复名称
内容1...

### 子章节2  
#### 重复名称
内容2...
`;
            
            const ambiguousLocator = new SemanticLocator(ambiguousMarkdown);
            
            try {
                ambiguousLocator.findSectionByPath(['章节A', '重复名称']);
                fail('应该抛出错误');
            } catch (error) {
                const errorMessage = (error as Error).message;
                expect(errorMessage).toContain('matches multiple locations');
                expect(errorMessage).toContain('子章节1');
                expect(errorMessage).toContain('子章节2');
                expect(errorMessage).toContain('Please provide the complete path');
            }
        });
    });

    describe('边界条件和错误处理', () => {
        
        test('路径长度小于2时不应触发简化匹配', () => {
            const result = locator.findSectionByPath(['不存在的章节']);
            expect(result).toBeUndefined();
        });

        test('非单根标题文档不应触发简化匹配', () => {
            // 创建多根标题文档
            const multiRootMarkdown = `# 根标题1
## 章节1

# 根标题2  
## 章节2
### 目标元素
`;
            
            const multiRootLocator = new SemanticLocator(multiRootMarkdown);
            const result = multiRootLocator.findSectionByPath(['章节2', '目标元素']);
            
            // 多根状态下不支持简化匹配，应该返回undefined
            expect(result).toBeUndefined();
        });

        test('当简化匹配无结果时应提供建议信息', () => {
            // 模拟控制台输出来验证建议信息
            const consoleSpy = jest.spyOn(logger, 'info');
            
            const result = locator.findSectionByPath(['不存在', '的路径']);
            
            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('You can try simplified paths')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('向后兼容性', () => {
        
        test('完整路径匹配应该优先于简化路径匹配', () => {
            // 使用完整路径应该正常工作
            const result = locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图',
                '用例规格说明',
                'UC-ALERT-001'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('**UC-ALERT-001**: 访问广告页面并自动拦截风险弹窗');
        });

        test('跳过根标题的完整路径匹配应该正常工作', () => {
            // 原有的跳过根标题功能应该保持工作
            const result = locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图',
                '用例规格说明'
            ]);

            expect(result).toBeDefined();
            expect(result!.name).toBe('用例规格说明');
        });

        test('非简化路径格式不应触发简化匹配逻辑', () => {
            // 3层或更多层路径应该走完整匹配逻辑
            const result = locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图',
                '不存在的章节'
            ]);

            expect(result).toBeUndefined();
        });
    });

    describe('性能考虑', () => {
        
        test('简化匹配不应显著影响性能', () => {
            const startTime = Date.now();
            
            // 执行多次简化匹配
            for (let i = 0; i < 100; i++) {
                locator.findSectionByPath([
                    '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                    'UC-ALERT-001'
                ]);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 100次操作应该在合理时间内完成（小于1秒）
            expect(duration).toBeLessThan(1000);
        });
    });

    describe('日志输出验证', () => {
        
        test('简化匹配成功时应输出正确的日志', () => {
            const consoleSpy = jest.spyOn(logger, 'info');
            
            locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                'UC-ALERT-001'
            ]);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[SIMPLIFIED] Attempting simplified path matching')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[SIMPLIFIED] Found unique match via simplified path')
            );
            
            consoleSpy.mockRestore();
        });
    });
}); 