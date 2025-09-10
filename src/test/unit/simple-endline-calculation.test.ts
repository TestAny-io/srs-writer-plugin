/**
 * 简化版测试：验证最后一个heading 2的endLine计算问题
 * 不依赖复杂的导入，直接测试核心逻辑
 */

// 模拟TableOfContents接口
interface SimpleTableOfContents {
    sid: string;
    title: string;
    level: number;
    line: number;
    endLine?: number;
}

// 修复后的calculateSectionEndLines核心逻辑
function calculateSectionEndLines(toc: SimpleTableOfContents[], totalLines: number): void {
    // 按行号排序，确保顺序处理
    const sortedToc = [...toc].sort((a, b) => a.line - b.line);
    
    for (let i = 0; i < sortedToc.length; i++) {
        const currentSection = sortedToc[i];
        
        // ✅ 修复：默认到文档末尾，只有找到真正边界才缩小范围
        let endLine = totalLines;
        
        // 寻找下一个同级或更高级别的标题作为边界
        for (let j = i + 1; j < sortedToc.length; j++) {
            const candidateSection = sortedToc[j];
            
            // 如果遇到同级或更高级别的标题，这就是真正的边界
            if (candidateSection.level <= currentSection.level) {
                endLine = candidateSection.line - 1;
                break;
            }
        }
        
        // 设置结果，确保不小于起始行
        currentSection.endLine = Math.max(endLine, currentSection.line);
    }
}

describe('Simple EndLine Calculation Test', () => {
    test('should correctly calculate endLine for last heading 2 with sub-sections', () => {
        // 模拟文档结构
        const toc: SimpleTableOfContents[] = [
            { sid: '/系统概述', title: '## 1.1 系统概述', level: 2, line: 5 },
            { sid: '/功能需求', title: '## 1.2 功能需求', level: 2, line: 10 },
            { sid: '/用户管理', title: '### 1.2.1 用户管理', level: 3, line: 15 },
            { sid: '/权限控制', title: '### 1.2.2 权限控制', level: 3, line: 20 },
            { sid: '/风险评估', title: '## 1.3 风险评估', level: 2, line: 25 }, // 最后一个heading 2
            { sid: '/技术风险矩阵', title: '### 1.3.1 技术风险矩阵', level: 3, line: 30 },
            { sid: '/业务风险矩阵', title: '### 1.3.2 业务风险矩阵', level: 3, line: 35 },
            { sid: '/合规风险矩阵', title: '### 1.3.3 合规风险矩阵', level: 3, line: 40 },
        ];

        const totalLines = 50;

        console.log('=== 测试前的TOC状态 ===');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}, endLine=${section.endLine}`);
        });

        // 执行计算
        calculateSectionEndLines(toc, totalLines);

        console.log('\n=== 测试后的TOC状态 ===');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}, endLine=${section.endLine}`);
        });

        // 找到风险评估章节
        const riskAssessment = toc.find(s => s.sid === '/风险评估');
        const techRisk = toc.find(s => s.sid === '/技术风险矩阵');
        const businessRisk = toc.find(s => s.sid === '/业务风险矩阵');
        const complianceRisk = toc.find(s => s.sid === '/合规风险矩阵');

        console.log('\n=== 关键断言检查 ===');
        console.log(`风险评估 endLine: ${riskAssessment?.endLine} (期望: ${totalLines})`);
        console.log(`技术风险矩阵 endLine: ${techRisk?.endLine}`);
        console.log(`业务风险矩阵 endLine: ${businessRisk?.endLine}`);
        console.log(`合规风险矩阵 endLine: ${complianceRisk?.endLine}`);

        // 关键断言：最后一个heading 2应该包含到文档末尾
        expect(riskAssessment?.endLine).toBe(totalLines);
        
        // 验证子章节不应该超出父章节
        expect(techRisk?.endLine).toBeLessThanOrEqual(riskAssessment?.endLine || 0);
        expect(businessRisk?.endLine).toBeLessThanOrEqual(riskAssessment?.endLine || 0);
        expect(complianceRisk?.endLine).toBeLessThanOrEqual(riskAssessment?.endLine || 0);
    });

    test('should verify the fix works correctly', () => {
        // 验证修复后的算法工作正常
        const toc: SimpleTableOfContents[] = [
            { sid: '/风险评估', title: '## 风险评估', level: 2, line: 716 }, // 最后一个heading 2
            { sid: '/技术风险矩阵', title: '### 技术风险矩阵', level: 3, line: 720 },
            { sid: '/业务风险矩阵', title: '### 业务风险矩阵', level: 3, line: 728 },
            { sid: '/合规风险矩阵', title: '### 合规风险矩阵', level: 3, line: 736 },
        ];

        const totalLines = 773;

        console.log('\n=== Bug演示测试 ===');
        console.log('原始TOC:');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}`);
        });

        // 执行计算
        calculateSectionEndLines(toc, totalLines);

        console.log('\n计算后TOC:');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}, endLine=${section.endLine}`);
        });

        const riskAssessment = toc.find(s => s.sid === '/风险评估');
        
        console.log(`\n🐛 Bug验证:`);
        console.log(`风险评估 endLine: ${riskAssessment?.endLine}`);
        console.log(`期望值: ${totalLines}`);
        console.log(`修复验证: 修复后算法应该设置 endLine = ${totalLines}`);

        // 验证修复后的正确行为
        expect(riskAssessment?.endLine).toBe(totalLines);
    });

    test('corrected algorithm should work properly', () => {
        // 修正后的算法
        function calculateSectionEndLinesFixed(toc: SimpleTableOfContents[], totalLines: number): void {
            const sortedToc = [...toc].sort((a, b) => a.line - b.line);
            
            for (let i = 0; i < sortedToc.length; i++) {
                const currentSection = sortedToc[i];
                
                // 🔧 修复：直接从循环开始寻找边界，不要预设错误的初始值
                let endLine = totalLines; // 默认到文档末尾
                
                // 寻找下一个同级或更高级别的标题
                for (let j = i + 1; j < sortedToc.length; j++) {
                    const candidateSection = sortedToc[j];
                    
                    if (candidateSection.level <= currentSection.level) {
                        endLine = candidateSection.line - 1;
                        break;
                    }
                }
                
                currentSection.endLine = Math.max(endLine, currentSection.line);
            }
        }

        const toc: SimpleTableOfContents[] = [
            { sid: '/风险评估', title: '## 风险评估', level: 2, line: 716 },
            { sid: '/技术风险矩阵', title: '### 技术风险矩阵', level: 3, line: 720 },
            { sid: '/业务风险矩阵', title: '### 业务风险矩阵', level: 3, line: 728 },
            { sid: '/合规风险矩阵', title: '### 合规风险矩阵', level: 3, line: 736 },
        ];

        const totalLines = 773;

        console.log('\n=== 修正算法测试 ===');
        
        // 使用修正后的算法
        calculateSectionEndLinesFixed(toc, totalLines);

        console.log('修正后的TOC:');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}, endLine=${section.endLine}`);
        });

        const riskAssessment = toc.find(s => s.sid === '/风险评估');
        
        console.log(`\n✅ 修正验证:`);
        console.log(`风险评估 endLine: ${riskAssessment?.endLine}`);
        console.log(`期望值: ${totalLines}`);

        // 这个断言应该通过
        expect(riskAssessment?.endLine).toBe(totalLines);
    });

    test('comprehensive edge cases after fix', () => {
        console.log('\n=== 综合边界测试 ===');
        
        // 测试各种复杂的层级结构
        const toc: SimpleTableOfContents[] = [
            // 正常情况：有同级章节
            { sid: '/intro', title: '# 引言', level: 1, line: 1 },
            { sid: '/overview', title: '## 概述', level: 2, line: 5 },
            { sid: '/details', title: '### 详情', level: 3, line: 10 },
            
            // 跳级情况：level 2 直接跳到 level 4
            { sid: '/features', title: '## 功能', level: 2, line: 15 },
            { sid: '/feature-detail', title: '#### 功能详情', level: 4, line: 20 },
            
            // 最后一个heading 1（应该包含所有后续内容）
            { sid: '/conclusion', title: '# 结论', level: 1, line: 25 },
            { sid: '/summary', title: '## 总结', level: 2, line: 30 },
            { sid: '/future', title: '### 未来展望', level: 3, line: 35 },
            { sid: '/final-thoughts', title: '#### 最终想法', level: 4, line: 40 },
        ];

        const totalLines = 50;
        calculateSectionEndLines(toc, totalLines);

        // 验证结果
        const intro = toc.find(s => s.sid === '/intro');
        const overview = toc.find(s => s.sid === '/overview');
        const features = toc.find(s => s.sid === '/features');
        const conclusion = toc.find(s => s.sid === '/conclusion');
        const summary = toc.find(s => s.sid === '/summary');
        const finalThoughts = toc.find(s => s.sid === '/final-thoughts');

        console.log('测试结果:');
        toc.forEach(section => {
            console.log(`${section.sid}: level=${section.level}, line=${section.line}, endLine=${section.endLine}`);
        });

        // 关键断言
        expect(intro?.endLine).toBe(24); // 到下一个level 1之前
        expect(conclusion?.endLine).toBe(totalLines); // 最后一个level 1，到文档末尾
        expect(features?.endLine).toBe(24); // 到下一个同级或更高级之前
        expect(finalThoughts?.endLine).toBe(totalLines); // 最后一个章节
        
        // 验证层级包含关系
        expect(summary?.endLine).toBeLessThanOrEqual(conclusion?.endLine || 0);
        expect(finalThoughts?.endLine).toBeLessThanOrEqual(conclusion?.endLine || 0);
    });

    test('empty and single line sections', () => {
        console.log('\n=== 空章节和单行章节测试 ===');
        
        const toc: SimpleTableOfContents[] = [
            { sid: '/empty-section', title: '## 空章节', level: 2, line: 10 },
            { sid: '/another-section', title: '## 另一个章节', level: 2, line: 11 }, // 紧接着的同级章节
            { sid: '/final-section', title: '## 最后章节', level: 2, line: 15 },
        ];

        const totalLines = 20;
        calculateSectionEndLines(toc, totalLines);

        const emptySection = toc.find(s => s.sid === '/empty-section');
        const anotherSection = toc.find(s => s.sid === '/another-section');
        const finalSection = toc.find(s => s.sid === '/final-section');

        console.log('空章节测试结果:');
        toc.forEach(section => {
            console.log(`${section.sid}: line=${section.line}, endLine=${section.endLine}`);
        });

        // 验证边界情况
        expect(emptySection?.endLine).toBe(10); // 空章节的endLine应该等于startLine
        expect(anotherSection?.endLine).toBe(14); // 到下一个同级章节前一行
        expect(finalSection?.endLine).toBe(totalLines); // 最后一个章节到文档末尾
        
        // 验证Math.max逻辑确保endLine >= startLine
        expect(emptySection?.endLine).toBeGreaterThanOrEqual(emptySection?.line || 0);
        expect(anotherSection?.endLine).toBeGreaterThanOrEqual(anotherSection?.line || 0);
        expect(finalSection?.endLine).toBeGreaterThanOrEqual(finalSection?.line || 0);
    });
});
