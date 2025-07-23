/**
 * 路径匹配改进测试
 * 
 * 测试新增的两个功能：
 * 1. 自动跳过单根标题
 * 2. 包含式路径匹配
 */

import { SemanticLocator } from '../../../tools/atomic/semantic-locator';

describe('Path Matching Improvements Tests', () => {
    
    describe('功能1：自动跳过单根标题', () => {
        test('单根标题文档应该支持跳过根标题的路径匹配', () => {
            const markdownContent = `# MacOSExtremeWeatherAlertApp - 软件需求规格说明书

## 4. 用户故事和用例视图 (User Stories & Use-Case View)

### 用户故事

- **US-ALERT-001**
    - **name**: 接收极端天气预警
    - **作为**: 城市居民

### 用例视图

#### 用例规格说明

- **UC-ALERT-001**
    - **用例名称**: 接收极端天气预警
    - **参与者**: 城市居民`;

            const locator = new SemanticLocator(markdownContent);
            
            // 测试跳过根标题的短路径
            const ucAlert = locator.findSectionByPath([
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图', 
                '用例规格说明',
                'UC-ALERT-001'
            ]);
            
            expect(ucAlert).toBeDefined();
            expect(ucAlert?.type).toBe('list_item');
            expect(ucAlert?.name).toBe('**UC-ALERT-001**'); // 名称保留原始格式
            
            // 验证原有的完整路径仍然有效
            const ucAlertFull = locator.findSectionByPath([
                'MacOSExtremeWeatherAlertApp - 软件需求规格说明书',
                '4. 用户故事和用例视图 (User Stories & Use-Case View)',
                '用例视图',
                '用例规格说明', 
                'UC-ALERT-001'
            ]);
            
            expect(ucAlertFull).toBeDefined();
            expect(ucAlertFull?.name).toBe('**UC-ALERT-001**'); // 名称保留原始格式
        });

        test('多根标题文档不应该跳过根标题', () => {
            const markdownContent = `# 第一部分

## 内容1

# 第二部分

## 内容2`;

            const locator = new SemanticLocator(markdownContent);
            
            // 多根标题时，短路径应该失败
            const content2Short = locator.findSectionByPath(['内容2']);
            expect(content2Short).toBeUndefined();
            
            // 完整路径应该成功
            const content2Full = locator.findSectionByPath(['第二部分', '内容2']);
            expect(content2Full).toBeDefined();
        });
    });

    describe('功能2：包含式路径匹配', () => {
        test('应该支持部分标题匹配', () => {
            const markdownContent = `# 测试文档

## 4. 用户故事和用例视图 (User Stories & Use-Case View)

### 用户故事详细说明

- **US-ALERT-001**
    - **描述**: 测试内容`;

            const locator = new SemanticLocator(markdownContent);
            
            // 测试各种简化的路径写法
            const testCases = [
                // 省略数字和括号
                ['用户故事和用例视图', '用户故事详细说明', 'US-ALERT-001'],
                // 省略数字
                ['用户故事和用例视图 (User Stories & Use-Case View)', '用户故事', 'US-ALERT-001'],
                // 只保留关键词
                ['用户故事', '用户故事', 'US-ALERT-001']
            ];
            
            testCases.forEach((testPath, index) => {
                const result = locator.findSectionByPath(testPath);
                expect(result).toBeDefined();
                expect(result?.name).toBe('**US-ALERT-001**'); // 名称保留原始格式
            });
        });

        test('应该支持双向包含匹配', () => {
            const markdownContent = `# 测试文档

## 长标题：完整的系统功能描述 (Complete System Function Description)

### 子章节`;

            const locator = new SemanticLocator(markdownContent);
            
            // 短查询包含在长标题中
            const result1 = locator.findSectionByPath(['系统功能', '子章节']);
            expect(result1).toBeDefined();
            
            // 长查询包含短标题（这种情况下应该失败，因为实际标题不包含"和更多内容"）
            const result2 = locator.findSectionByPath(['长标题：完整的系统功能描述和更多内容', '子章节']);
            expect(result2).toBeUndefined(); // 预期失败，因为不是真正的包含关系
        });

        test('应该正确处理markdown格式符号', () => {
            const markdownContent = `# 测试文档

## **粗体标题**

### \`代码标题\`

- **LIST-ITEM-001**
    - 内容`;

            const locator = new SemanticLocator(markdownContent);
            
            // 测试去除markdown格式符号后的匹配
            const result1 = locator.findSectionByPath(['粗体标题', '代码标题', 'LIST-ITEM-001']);
            expect(result1).toBeDefined();
            
            // 包含格式符号的查询也应该工作
            const result2 = locator.findSectionByPath(['**粗体标题**', '`代码标题`', '**LIST-ITEM-001**']);
            expect(result2).toBeDefined();
        });
    });

    describe('组合功能测试', () => {
        test('应该同时支持跳过根标题和包含式匹配', () => {
            const markdownContent = `# 极端天气预警应用 - 完整的软件需求规格说明书

## 4. 用户故事和用例视图 (User Stories & Use-Case View)

### 用例视图部分

#### 用例规格说明详细内容

- **UC-ALERT-001**
    - **用例名称**: 接收极端天气预警`;

            const locator = new SemanticLocator(markdownContent);
            
            // 使用最简化的路径（跳过根标题 + 包含式匹配）
            const result = locator.findSectionByPath([
                '用户故事和用例视图',      // 包含式匹配：省略数字和英文说明
                '用例视图',               // 包含式匹配：省略"部分"
                '用例规格说明',           // 包含式匹配：省略"详细内容"
                'UC-ALERT-001'
            ]);
            
            expect(result).toBeDefined();
            expect(result?.type).toBe('list_item');
            expect(result?.name).toBe('**UC-ALERT-001**'); // 名称保留原始格式
        });
    });
}); 