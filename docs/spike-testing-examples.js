/**
 * 手动运行架构验证Spike的示例
 * 在VSCode开发控制台中运行此代码
 */

// 1. 首先确保插件已激活
// 2. 打开开发者控制台：Help -> Toggle Developer Tools
// 3. 在Console中运行以下代码：

// 直接运行架构验证
vscode.commands.executeCommand('srs-writer.runArchitectureSpike');

// 或者获取详细状态
vscode.commands.executeCommand('srs-writer.status');
