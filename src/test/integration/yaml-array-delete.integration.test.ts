/**
 * 集成测试：YAML数组删除操作修复验证
 * 验证 YAMLKeyPathOperator.delete 能够正确删除数组元素而不是设置为null
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { YAMLKeyPathOperator } from '../../tools/document/yamlEditor/YAMLKeyPathOperator';
import { YAMLEditor } from '../../tools/document/yamlEditor/YAMLEditor';

describe('YAML Array Delete Integration Tests', () => {
  let tempDir: string;
  let testYamlFile: string;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yaml-delete-test-'));
    testYamlFile = path.join(tempDir, 'test.yaml');
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('临时文件清理失败:', error);
    }
  });

  test('应该正确删除数组元素而不是设置为null', async () => {
    // 🎯 准备：创建包含3个元素的数组
    const data = { 
      functional_requirements: [
        {id: 'FR-001', summary: '第一个需求'},
        {id: 'FR-002', summary: '第二个需求'}, 
        {id: 'FR-003', summary: '第三个需求'}
      ] 
    };
    
    // 🚀 执行：删除中间元素 (索引1)
    const success = YAMLKeyPathOperator.delete(data, 'functional_requirements.1');
    
    // ✅ 验证：数组长度正确，元素真正删除，无null值
    expect(success).toBe(true);
    expect(data.functional_requirements).toEqual([
      {id: 'FR-001', summary: '第一个需求'},
      {id: 'FR-003', summary: '第三个需求'}
    ]);
    expect(data.functional_requirements.length).toBe(2);
    expect(data.functional_requirements).not.toContain(null);
    expect(data.functional_requirements).not.toContain(undefined);

    console.log('✅ 数组元素删除测试通过');
  });

  test('应该正确删除第一个数组元素', async () => {
    // 🎯 准备：创建包含多个元素的数组
    const data = { 
      user_stories: [
        {id: 'US-001', summary: '要删除的第一个'},
        {id: 'US-002', summary: '保留的第二个'}, 
        {id: 'US-003', summary: '保留的第三个'}
      ] 
    };
    
    // 🚀 执行：删除第一个元素 (索引0)
    const success = YAMLKeyPathOperator.delete(data, 'user_stories.0');
    
    // ✅ 验证：第一个元素被删除，其他元素前移
    expect(success).toBe(true);
    expect(data.user_stories).toEqual([
      {id: 'US-002', summary: '保留的第二个'},
      {id: 'US-003', summary: '保留的第三个'}
    ]);
    expect(data.user_stories.length).toBe(2);

    console.log('✅ 第一个元素删除测试通过');
  });

  test('应该正确删除最后一个数组元素', async () => {
    // 🎯 准备：创建包含多个元素的数组
    const data = { 
      constraints: [
        {id: 'CON-001', summary: '保留的第一个'},
        {id: 'CON-002', summary: '保留的第二个'}, 
        {id: 'CON-003', summary: '要删除的最后一个'}
      ] 
    };
    
    // 🚀 执行：删除最后一个元素 (索引2)
    const success = YAMLKeyPathOperator.delete(data, 'constraints.2');
    
    // ✅ 验证：最后一个元素被删除
    expect(success).toBe(true);
    expect(data.constraints).toEqual([
      {id: 'CON-001', summary: '保留的第一个'},
      {id: 'CON-002', summary: '保留的第二个'}
    ]);
    expect(data.constraints.length).toBe(2);

    console.log('✅ 最后一个元素删除测试通过');
  });

  test('执行YAML编辑删除操作后应该没有null元素', async () => {
    // 🎯 准备：创建模拟真实的YAML文件
    const yamlContent = `functional_requirements:
  - id: FR-AD-001
    summary: 要删除的需求
    description:
      - 这个需求将被删除
    priority: high
  - id: FR-AD-002  
    summary: 保留的需求
    description:
      - 这个需求将被保留
    priority: medium
  - id: FR-AD-003
    summary: 另一个保留的需求
    description:
      - 这也将被保留
    priority: low
`;
    
    await fs.writeFile(testYamlFile, yamlContent, 'utf-8');
    
    // 🚀 执行：使用YAMLEditor删除第一个元素
    const result = await YAMLEditor.applyEdits({
      targetFile: testYamlFile,
      edits: [{
        type: 'delete',
        keyPath: 'functional_requirements.0',
        reason: '测试数组元素删除功能'
      }],
      createBackup: false
    });
    
    // ✅ 验证：操作成功且文件中没有null元素
    expect(result.success).toBe(true);
    
    const finalContent = await fs.readFile(testYamlFile, 'utf-8');
    expect(finalContent).not.toContain('- null');
    expect(finalContent).not.toContain('null');
    expect(finalContent).toContain('id: FR-AD-002');
    expect(finalContent).toContain('id: FR-AD-003');
    expect(finalContent).not.toContain('id: FR-AD-001');
    
    // 验证数组结构正确
    expect(finalContent).toMatch(/functional_requirements:\s+- id: FR-AD-002/);

    console.log('✅ YAML编辑删除操作测试通过');
  });

  test('应该处理超出范围的数组索引 (幂等删除)', async () => {
    // 🎯 准备：创建只有2个元素的数组
    const data = { 
      items: [
        {id: 'ITEM-001'},
        {id: 'ITEM-002'}
      ] 
    };
    
    // 🚀 执行：尝试删除不存在的索引3 (幂等删除应该成功)
    const success = YAMLKeyPathOperator.delete(data, 'items.3');
    
    // ✅ 验证：幂等删除成功，数组保持不变
    expect(success).toBe(true); // 幂等删除：不存在的键删除应该成功
    expect(data.items.length).toBe(2);
    expect(data.items).toEqual([
      {id: 'ITEM-001'},
      {id: 'ITEM-002'}
    ]);

    console.log('✅ 超出范围索引处理测试通过');
  });

  test('应该处理空数组删除操作 (幂等删除)', async () => {
    // 🎯 准备：创建空数组
    const data = { 
      empty_array: []
    };
    
    // 🚀 执行：尝试删除空数组中的元素 (幂等删除应该成功)
    const success = YAMLKeyPathOperator.delete(data, 'empty_array.0');
    
    // ✅ 验证：幂等删除成功，数组保持空
    expect(success).toBe(true); // 幂等删除：不存在的键删除应该成功
    expect(data.empty_array.length).toBe(0);
    expect(data.empty_array).toEqual([]);

    console.log('✅ 空数组删除操作测试通过');
  });
});