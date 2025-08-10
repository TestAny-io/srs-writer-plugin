/**
 * 手动测试新的增强型Markdown读取工具
 * 用于验证核心功能是否正常工作
 */

import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';

async function testEnhancedMarkdownReader() {
    console.log('=== 测试增强型Markdown读取工具 ===\n');

    // 测试内容解析模式
    console.log('1. 测试content模式：');
    try {
        const result = await readMarkdownFile({
            path: 'README.md',
            parseMode: 'content'
        });
        
        console.log('✅ Content模式成功');
        console.log(`文件大小: ${result.size} bytes`);
        console.log(`解析时间: ${result.parseTime}ms`);
        console.log(`缓存命中: ${result.cacheHit}`);
        console.log(`内容长度: ${result.content?.length || 0} 字符`);
        console.log(`结果数量: ${result.results.length}`);
    } catch (error) {
        console.error('❌ Content模式失败:', error);
    }
    
    console.log('\n2. 测试structure模式：');
    try {
        const result = await readMarkdownFile({
            path: 'README.md',
            parseMode: 'structure'
        });
        
        console.log('✅ Structure模式成功');
        console.log(`TOC条目数: ${result.tableOfContents?.length || 0}`);
        console.log(`总字符数: ${result.contentSummary?.totalCharacters || 0}`);
        console.log(`总行数: ${result.contentSummary?.totalLines || 0}`);
        
        if (result.tableOfContents && result.tableOfContents.length > 0) {
            console.log('\n前3个标题:');
            result.tableOfContents.slice(0, 3).forEach(item => {
                console.log(`  ${item.displayId}. ${item.title} (level ${item.level}, sid: ${item.sid})`);
            });
        }
    } catch (error) {
        console.error('❌ Structure模式失败:', error);
    }
    
    console.log('\n3. 测试章节查询：');
    try {
        const result = await readMarkdownFile({
            path: 'README.md',
            parseMode: 'content',
            targets: [{
                type: 'section',
                sid: '/特性-features'
            }]
        });
        
        console.log('✅ 章节查询成功');
        if (result.results.length > 0) {
            const sectionResult = result.results[0];
            console.log(`找到章节: ${sectionResult.sectionTitle}`);
            console.log(`章节内容长度: ${sectionResult.content?.length || 0} 字符`);
        }
    } catch (error) {
        console.error('❌ 章节查询失败:', error);
    }
    
    console.log('\n4. 测试关键字搜索：');
    try {
        const result = await readMarkdownFile({
            path: 'README.md',
            parseMode: 'content',
            targets: [{
                type: 'keyword',
                query: ['VSCode', '插件'],
                maxResults: 3
            }]
        });
        
        console.log('✅ 关键字搜索成功');
        if (result.results.length > 0) {
            const searchResult = result.results[0];
            console.log(`匹配数量: ${searchResult.totalMatches || 0}`);
            if (searchResult.matches && searchResult.matches.length > 0) {
                console.log('前几个匹配:');
                searchResult.matches.slice(0, 2).forEach((match, index) => {
                    console.log(`  ${index + 1}. ${match.sectionTitle} (得分: ${match.relevanceScore})`);
                });
            }
        }
    } catch (error) {
        console.error('❌ 关键字搜索失败:', error);
    }
    
    console.log('\n=== 测试完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
    testEnhancedMarkdownReader().catch(console.error);
}

export { testEnhancedMarkdownReader };