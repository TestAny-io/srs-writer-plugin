/**
 * 手动测试PromptAssemblyEngine ToC集成功能
 */

import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

async function testToCIntegration() {
  console.log('=== 测试PromptAssemblyEngine ToC集成功能 ===\n');

  try {
    // 创建engine，使用真实的rules目录
    const engine = new PromptAssemblyEngine(process.cwd() + '/rules');
    
    // 创建测试context，使用当前项目作为测试目录
    const context: SpecialistContext = {
      projectMetadata: {
        baseDir: process.cwd()  // 当前项目目录，应该包含README.md
      }
    };

    const specialistType: SpecialistType = {
      name: 'overall_description_writer',
      category: 'content'
    };

    console.log('1. 测试content specialist (overall_description_writer)');
    
    await engine.assembleSpecialistPrompt(specialistType, context);

    console.log('\n2. 检查SRS ToC内容:');
    console.log('SRS_TOC字段存在:', !!context.SRS_TOC);
    console.log('CURRENT_SRS_TOC字段存在:', !!context.CURRENT_SRS_TOC);
    
    if (context.SRS_TOC) {
      console.log('\nSRS ToC内容:');
      console.log('--- ToC开始 ---');
      console.log(context.SRS_TOC);
      console.log('--- ToC结束 ---');
    } else {
      console.log('❌ SRS_TOC为空，可能是没有找到README.md文件');
    }

    // 测试process specialist (requirement_syncer)
    console.log('\n3. 测试process specialist (requirement_syncer)');
    const processContext: SpecialistContext = {
      projectMetadata: {
        baseDir: process.cwd()
      }
    };

    const processSpecialistType: SpecialistType = {
      name: 'requirement_syncer',
      category: 'process'
    };

    await engine.assembleSpecialistPrompt(processSpecialistType, processContext);
    
    console.log('requirement_syncer的SRS_TOC字段存在:', !!processContext.SRS_TOC);

    // 测试其他process specialist
    console.log('\n4. 测试其他process specialist (git_operator)');
    const otherProcessContext: SpecialistContext = {
      projectMetadata: {
        baseDir: process.cwd()
      }
    };

    const otherProcessSpecialistType: SpecialistType = {
      name: 'git_operator',
      category: 'process'
    };

    await engine.assembleSpecialistPrompt(otherProcessSpecialistType, otherProcessContext);
    
    console.log('git_operator的SRS_TOC字段存在:', !!otherProcessContext.SRS_TOC);
    console.log('git_operator应该不加载SRS ToC (预期为false)');

    console.log('\n✅ ToC集成功能测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testToCIntegration();
