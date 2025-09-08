/**
 * SyntaxChecker 使用示例
 * 展示如何在实际项目中使用语法检查工具
 */

import { syntaxCheckerTool } from '../../tools/document/syntaxCheckerTools';

/**
 * 示例：检查项目文档语法
 */
export async function exampleCheckProjectDocumentation() {
  console.log('📝 示例：检查项目文档语法');
  
  try {
    const result = await syntaxCheckerTool({
      description: "Check project documentation syntax and format",
      files: [
        { path: "SRS.md" },
        { path: "README.md" },
        { path: "requirements.yaml" },
        { path: "CHANGELOG.md" }
      ]
    });
    
    console.log('✅ 检查完成:', result);
    
    if (result.success) {
      console.log(`📊 统计: 处理 ${result.processedFiles}/${result.totalFiles} 个文件`);
      console.log(`🔍 发现 ${result.issues.length} 个问题`);
      if (result.skippedFiles.length > 0) {
        console.log(`⚠️ 跳过文件: ${result.skippedFiles.join(', ')}`);
      }
    } else {
      console.log('❌ 检查失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 工具调用失败:', error);
  }
}

/**
 * 示例：检查混合文件类型
 */
export async function exampleCheckMixedFileTypes() {
  console.log('📁 示例：检查混合文件类型');
  
  try {
    const result = await syntaxCheckerTool({
      description: "Check mixed file types with some unsupported formats",
      files: [
        { path: "docs/guide.md" },      // 支持
        { path: "config.yaml" },        // 支持
        { path: "script.js" },          // 不支持，会被跳过
        { path: "data.json" },          // 不支持，会被跳过
        { path: "style.css" }           // 不支持，会被跳过
      ]
    });
    
    console.log('结果:', {
      success: result.success,
      totalFiles: result.totalFiles,
      processedFiles: result.processedFiles,
      skippedFiles: result.skippedFiles,
      issueCount: result.issues.length
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

/**
 * 示例：只检查 YAML 文件
 */
export async function exampleCheckYAMLOnly() {
  console.log('📄 示例：只检查 YAML 文件');
  
  try {
    const result = await syntaxCheckerTool({
      description: "Check YAML configuration files",
      files: [
        { path: "requirements.yaml" },
        { path: "config/settings.yml" },
        { path: "docker-compose.yaml" }
      ]
    });
    
    console.log('YAML 检查结果:', {
      success: result.success,
      yamlIssues: result.issues.filter(issue => 
        issue.file.endsWith('.yaml') || issue.file.endsWith('.yml')
      )
    });
    
  } catch (error) {
    console.error('❌ YAML 检查失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  console.log('🚀 SyntaxChecker 使用示例\n');
  
  Promise.resolve()
    .then(() => exampleCheckProjectDocumentation())
    .then(() => console.log('\n' + '-'.repeat(50) + '\n'))
    .then(() => exampleCheckMixedFileTypes())
    .then(() => console.log('\n' + '-'.repeat(50) + '\n'))
    .then(() => exampleCheckYAMLOnly())
    .then(() => console.log('\n🎉 所有示例完成！'))
    .catch(console.error);
}
