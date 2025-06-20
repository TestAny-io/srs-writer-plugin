# SRS Writer v1.2 - 架构验证Spike测试指南

## 🧪 测试方法总览

### 1. 生产环境测试（VSCode插件内）

#### 通过命令面板
```
1. Ctrl+Shift+P / Cmd+Shift+P
2. 输入: "SRS Writer: Run Architecture Validation"
3. 等待验证完成（约30-60秒）
4. 查看结果通知和输出面板
```

#### 通过状态栏
```
1. 点击右下角 "SRS Writer" 状态栏
2. 查看当前状态信息
3. 使用相关命令进行验证
```

### 2. 开发环境测试

#### Jest测试框架
```bash
# 运行架构验证Spike测试
yarn test:spike

# 运行所有包含"spike"的测试
yarn test --testPathPattern=spike

# 详细输出模式
yarn test:spike --verbose

# 监听模式（开发时使用）
yarn test:spike --watch
```

#### 手动代码测试
```bash
# 启动开发模式
yarn dev

# 在新VSCode窗口中按F5启动Extension Development Host
# 在开发者控制台运行:
vscode.commands.executeCommand('srs-writer.runArchitectureSpike');
```

### 3. 验证项目说明

#### 测试覆盖范围
- ✅ **AI路由准确性**: 测试10个不同场景的意图识别
- ✅ **架构链路完整性**: 端到端流程验证
- ✅ **错误处理健壮性**: 异常情况的优雅处理
- ✅ **性能基线**: 响应时间和吞吐量测试

#### 成功标准
- AI路由准确率 ≥ 90%
- 架构链路完整性 = 100%
- 错误处理健壮性 ≥ 75%
- 平均响应时间 < 2000ms

### 4. 输出结果解读

#### 成功示例
```
🎉 架构验证 PASS

🎯 AI路由准确率: 95%
🔗 架构链路: ✅
🛡️ 错误处理: ✅  
⚡ 性能基线: 1200ms
```

#### 失败示例
```
💥 架构验证 FAIL

🎯 AI路由准确率: 75% ❌
🔗 架构链路: ✅
🛡️ 错误处理: ❌
⚡ 性能基线: 3500ms ⚠️
```

### 5. 故障排除

#### AI路由准确率低
- 检查GitHub Copilot是否正常工作
- 验证网络连接状态
- 尝试切换到fallback模式测试

#### 架构链路不完整
- 检查规则文件是否正确加载
- 验证RuleRunner初始化状态
- 查看详细错误日志

#### 性能基线超标
- 检查是否在Debug模式
- 验证AI Provider响应速度
- 考虑网络延迟因素

### 6. 高级调试

#### 开启详细日志
```json
// config/settings.json
{
  "debug_mode": true,
  "performance_logging": true
}
```

#### 手动控制测试
```typescript
// 在开发者控制台运行
const spike = new ArchitectureSpike();
const results = await spike.runFullValidation();
console.log('详细结果:', results);
```

#### 单项测试
```bash
# 只测试AI路由
yarn test --testNamePattern="AI路由"

# 只测试性能
yarn test --testNamePattern="性能"

# 只测试错误处理
yarn test --testNamePattern="错误"
```

### 7. 持续集成

#### GitHub Actions示例
```yaml
- name: Run Architecture Spike
  run: |
    yarn install
    yarn test:spike
    yarn validate:architecture
```

#### 本地开发流程
```bash
# 每次提交前运行
git add .
yarn test:spike
git commit -m "feat: implement new feature"
```

## 📊 验证报告模板

运行完成后，系统会生成类似以下的验证报告：

```
=== SRS Writer v1.2 架构验证报告 ===

执行时间: 2024-12-28 10:30:00
测试环境: VSCode 1.85.0, Node.js 18.17.0
AI Provider: GitHub Copilot

📋 测试结果:
- AI路由测试: 9/10 通过 (90%)
- 架构链路测试: 通过 ✅
- 错误处理测试: 3/4 通过 (75%)
- 性能基线测试: 平均1850ms，最大2100ms

🎯 总体评估: PASS ✅

💡 建议:
- AI路由在复杂嵌套查询上需要改进
- 错误处理的网络超时场景需要优化
- 性能在可接受范围内，无需立即优化

📝 详细日志: 查看输出面板 "SRS Writer Architecture Validation"
```

---

## 🚀 快速开始

最简单的运行方式：

1. **打开VSCode**
2. **按 Ctrl+Shift+P**
3. **输入并选择**: `SRS Writer: Run Architecture Validation`
4. **等待30-60秒**
5. **查看结果通知**

就这么简单！🎉
