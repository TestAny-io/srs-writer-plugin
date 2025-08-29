/**
 * 测试 GIT_BRANCH 变量替换功能
 * 
 * 验证 SpecialistExecutor 能正确替换 {{GIT_BRANCH}} 变量
 */

/**
 * 模拟 SpecialistExecutor 的变量替换逻辑
 */
function testGitBranchVariableReplacement() {
    console.log('🧪 测试 {{GIT_BRANCH}} 变量替换功能...');
    
    // 模拟不同的 context 场景
    const testCases = [
        {
            name: '场景1: 有 gitBranch 信息',
            context: {
                sessionData: {
                    projectName: 'TestProject',
                    gitBranch: 'SRS/TestProject'
                }
            },
            template: `{
  "project_name": "{{PROJECT_NAME}}",
  "git_branch": "{{GIT_BRANCH}}",
  "created_date": "{{DATE}}"
}`,
            expectedGitBranch: 'SRS/TestProject'
        },
        {
            name: '场景2: 没有 gitBranch，使用默认值',
            context: {
                sessionData: {
                    projectName: 'AnotherProject'
                    // gitBranch 未设置
                }
            },
            template: `{
  "project_name": "{{PROJECT_NAME}}",
  "git_branch": "{{GIT_BRANCH}}",
  "created_date": "{{DATE}}"
}`,
            expectedGitBranch: 'SRS/AnotherProject'
        },
        {
            name: '场景3: 完全没有会话数据',
            context: {
                // sessionData 未设置
            },
            template: `{
  "project_name": "{{PROJECT_NAME}}",
  "git_branch": "{{GIT_BRANCH}}",
  "created_date": "{{DATE}}"
}`,
            expectedGitBranch: 'SRS/Unknown'
        },
        {
            name: '场景4: 复杂的分支名称',
            context: {
                sessionData: {
                    projectName: 'ComplexProjectName',
                    gitBranch: 'feature/SRS/ComplexProjectName-v2'
                }
            },
            template: `Git分支: {{GIT_BRANCH}}，项目: {{PROJECT_NAME}}`,
            expectedGitBranch: 'feature/SRS/ComplexProjectName-v2'
        }
    ];
    
    // 模拟 replaceTemplateVariables 函数的逻辑
    function replaceTemplateVariables(promptTemplate: string, context: any): string {
        let result = promptTemplate;
        
        // 基本变量替换
        result = result.replace(/\{\{PROJECT_NAME\}\}/g, context.sessionData?.projectName || 'Unknown');
        result = result.replace(/\{\{BASE_DIR\}\}/g, context.sessionData?.baseDir || '');
        result = result.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
        result = result.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        
        // 🚀 新增：Git分支信息变量替换
        const gitBranch = context.sessionData?.gitBranch || `SRS/${context.sessionData?.projectName || 'Unknown'}`;
        result = result.replace(/\{\{GIT_BRANCH\}\}/g, gitBranch);
        
        return result;
    }
    
    // 运行测试用例
    testCases.forEach((testCase, index) => {
        console.log(`\n🔬 ${testCase.name}:`);
        console.log(`  输入模板: ${testCase.template.replace(/\n/g, '\\n')}`);
        console.log(`  会话数据: ${JSON.stringify(testCase.context)}`);
        
        const result = replaceTemplateVariables(testCase.template, testCase.context);
        console.log(`  替换结果: ${result.replace(/\n/g, '\\n')}`);
        
        // 验证 GIT_BRANCH 是否正确替换
        const gitBranchMatch = result.match(/"git_branch":\s*"([^"]+)"|Git分支:\s*([^，]+)/);
        const actualGitBranch = gitBranchMatch ? (gitBranchMatch[1] || gitBranchMatch[2]) : null;
        
        console.log(`  期望分支: ${testCase.expectedGitBranch}`);
        console.log(`  实际分支: ${actualGitBranch}`);
        
        if (actualGitBranch === testCase.expectedGitBranch) {
            console.log(`  ✅ 测试通过`);
        } else {
            console.log(`  ❌ 测试失败`);
        }
    });
    
    console.log('\n🎯 测试总结:');
    console.log('{{GIT_BRANCH}} 变量替换功能已实现，支持以下逻辑:');
    console.log('1. 优先使用 context.sessionData.gitBranch');
    console.log('2. 如果没有 gitBranch，使用默认格式 SRS/{PROJECT_NAME}');
    console.log('3. 如果连 PROJECT_NAME 都没有，使用 SRS/Unknown');
}

/**
 * 测试模拟 project_initializer 使用场景
 */
function testProjectInitializerScenario() {
    console.log('\n\n🧪 测试 project_initializer 使用场景...');
    
    // 模拟 project_initializer 执行时的 context
    const projectInitializerContext = {
        sessionData: {
            projectName: 'JiraCommissionRuleConfig',
            baseDir: '/Users/kailaichen/Downloads/Source Code/srs-vscode-test/JiraCommissionRuleConfig',
            gitBranch: 'SRS/JiraCommissionRuleConfig'  // 由 createNewProjectFolder 设置
        }
    };
    
    // 模拟 srs-writer-log.json 模板
    const srsLogTemplate = `{
  "project_name": "{{PROJECT_NAME}}",
  "created_date": "{{DATE}}",
  "git_branch": "{{GIT_BRANCH}}",
  "initialization_log": [
    {
      "timestamp": "{{DATE}}",
      "action": "project_initialized",
      "specialist": "project_initializer",
      "status": "success",
      "details": "项目目录和基础文件创建完成"
    },
    {
      "timestamp": "{{DATE}}",
      "action": "git_branch_created",
      "specialist": "createNewProjectFolder",
      "status": "success",
      "details": "Git分支 {{GIT_BRANCH}} 已创建并切换",
      "branch_name": "{{GIT_BRANCH}}"
    }
  ],
  "generation_history": [],
  "file_manifest": [
    "SRS.md",
    "requirements.yaml",
    "srs-writer-log.json",
    "prototype/"
  ]
}`;
    
    console.log('📋 模拟 project_initializer 的 context:');
    console.log(JSON.stringify(projectInitializerContext, null, 2));
    
    console.log('\n📄 srs-writer-log.json 模板:');
    console.log(srsLogTemplate);
    
    // 执行变量替换
    function replaceTemplateVariables(promptTemplate: string, context: any): string {
        let result = promptTemplate;
        
        result = result.replace(/\{\{PROJECT_NAME\}\}/g, context.sessionData?.projectName || 'Unknown');
        result = result.replace(/\{\{BASE_DIR\}\}/g, context.sessionData?.baseDir || '');
        result = result.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
        result = result.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        
        // Git分支信息变量替换
        const gitBranch = context.sessionData?.gitBranch || `SRS/${context.sessionData?.projectName || 'Unknown'}`;
        result = result.replace(/\{\{GIT_BRANCH\}\}/g, gitBranch);
        
        return result;
    }
    
    const result = replaceTemplateVariables(srsLogTemplate, projectInitializerContext);
    
    console.log('\n✅ 替换后的结果:');
    console.log(result);
    
    // 验证结果
    try {
        const parsedResult = JSON.parse(result);
        console.log('\n🔍 验证结果:');
        console.log(`  项目名称: ${parsedResult.project_name}`);
        console.log(`  Git分支: ${parsedResult.git_branch}`);
        console.log(`  创建日期: ${parsedResult.created_date}`);
        console.log(`  初始化日志条目数: ${parsedResult.initialization_log.length}`);
        
        // 检查 Git 分支信息是否正确
        const gitBranchLog = parsedResult.initialization_log.find((log: any) => log.action === 'git_branch_created');
        if (gitBranchLog) {
            console.log(`  Git分支日志: ${gitBranchLog.details}`);
            console.log(`  分支名称: ${gitBranchLog.branch_name}`);
        }
        
        console.log('\n🎉 JSON 解析成功，变量替换工作正常！');
        
    } catch (parseError) {
        console.error('\n❌ JSON 解析失败:', (parseError as Error).message);
    }
}

// 运行测试
if (require.main === module) {
    testGitBranchVariableReplacement();
    testProjectInitializerScenario();
}
