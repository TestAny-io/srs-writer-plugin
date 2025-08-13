/**
 * 使用真实SRS文件测试ToC集成功能
 */

import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import * as path from 'path';

async function testRealSRSToC() {
  console.log('=== 测试真实SRS文件的ToC解析功能 ===\n');

  try {
    // 创建engine，使用真实的rules目录
    const projectRoot = process.cwd();
    const engine = new PromptAssemblyEngine(path.join(projectRoot, 'rules'));
    
    // 创建测试context，指向包含SRS.md的目录
    const context: SpecialistContext = {
      projectMetadata: {
        baseDir: path.join(projectRoot, 'srs_writer_plugin_for_vscode_requirement')
      }
    };

    console.log('测试目录:', context.projectMetadata.baseDir);

    // 测试content specialist
    const specialistType: SpecialistType = {
      name: 'overall_description_writer',
      category: 'content'
    };

    console.log('\n1. 开始加载SRS.md文件的ToC...');
    
    await engine.assembleSpecialistPrompt(specialistType, context);

    console.log('\n2. 检查ToC解析结果:');
    console.log('SRS_TOC字段存在:', !!context.SRS_TOC);
    console.log('CURRENT_SRS_TOC字段存在:', !!context.CURRENT_SRS_TOC);
    console.log('SRS_TOC内容长度:', context.SRS_TOC?.length || 0, '字符');
    
    if (context.SRS_TOC) {
      console.log('\n3. 生成的SRS目录结构:');
      console.log('='.repeat(80));
      console.log(context.SRS_TOC);
      console.log('='.repeat(80));
      
      // 验证一些关键的标题是否被正确解析
      const expectedTitles = [
        '引言 (Introduction)',
        '整体说明 (Overall Description)', 
        '功能需求 (Functional Requirements)',
        '非功能性需求 (Non-Functional Requirements)'
      ];
      
      console.log('\n4. 验证关键章节是否被正确解析:');
      expectedTitles.forEach(title => {
        const found = context.SRS_TOC!.includes(title);
        console.log(`  ${found ? '✅' : '❌'} ${title}: ${found ? '找到' : '未找到'}`);
      });
      
      // 统计解析出的标题数量
      const lines = context.SRS_TOC.split('\n').filter(line => line.trim().startsWith('#'));
      console.log(`\n5. 统计信息:`);
      console.log(`  总标题数量: ${lines.length}`);
      console.log(`  一级标题 (#): ${lines.filter(line => line.startsWith('# ')).length}`);
      console.log(`  二级标题 (##): ${lines.filter(line => line.startsWith('## ') && !line.startsWith('### ')).length}`);
      console.log(`  三级标题 (###): ${lines.filter(line => line.startsWith('### ')).length}`);
      
    } else {
      console.log('❌ 未能生成SRS ToC内容');
    }

    console.log('\n✅ 真实SRS文件ToC测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testRealSRSToC();
