import { IDParser } from '../../../tools/document/scaffoldGenerator/IDParser';
import { ExtractedId, ScaffoldErrorType } from '../../../tools/document/scaffoldGenerator/types';

describe('IDParser', () => {
    describe('extractAllIds', () => {
        test('应该正确提取基础实体ID', async () => {
            const srsContent = `
# SRS文档测试

## 功能需求
FR-LOGIN-001: 用户登录功能
FR-AUTH-002: 用户认证
UC-USER-001: 用户管理用例
US-ADMIN-001: 管理员故事

## 非功能需求  
NFR-PERF-001: 性能要求
IFR-API-001: API接口
DAR-USER-001: 用户数据
            `;

            const result = await IDParser.extractAllIds(srsContent);

            expect(result).toHaveLength(7);
            
            // 验证基础实体ID
            const ids = result.map(r => r.id);
            expect(ids).toContain('FR-LOGIN-001');
            expect(ids).toContain('FR-AUTH-002');
            expect(ids).toContain('UC-USER-001');
            expect(ids).toContain('US-ADMIN-001');
            expect(ids).toContain('NFR-PERF-001');
            expect(ids).toContain('IFR-API-001');
            expect(ids).toContain('DAR-USER-001');
        });

        test('应该正确提取ADC复合实体ID', async () => {
            const srsContent = `
## 项目假设和约束

### 假设条件
ADC-ASSU-001: 网络连接假设
ADC-ASSU-002: 用户行为假设

### 依赖关系
ADC-DEPEN-001: 第三方服务依赖
ADC-DEPEN-002: 数据库依赖

### 约束条件
ADC-CONST-001: 技术约束
ADC-CONST-002: 时间约束
            `;

            const result = await IDParser.extractAllIds(srsContent);

            expect(result).toHaveLength(6);
            
            const adcIds = result.filter(r => r.type === 'adc');
            expect(adcIds).toHaveLength(6);
            
            // 验证ADC子类型
            const assuIds = adcIds.filter(r => r.subType === 'ASSU');
            const depenIds = adcIds.filter(r => r.subType === 'DEPEN');
            const constIds = adcIds.filter(r => r.subType === 'CONST');
            
            expect(assuIds).toHaveLength(2);
            expect(depenIds).toHaveLength(2);
            expect(constIds).toHaveLength(2);
        });

        test('应该正确处理混合ID格式', async () => {
            const srsContent = `
# 完整SRS测试

US-LOGIN-001: 登录用户故事
UC-AUTH-001: 认证用例
FR-SECURITY-001: 安全功能需求
NFR-PERFORMANCE-001: 性能非功能需求
IFR-REST-001: REST接口需求
DAR-USER-001: 用户数据需求

ADC-ASSU-001: 基础假设
ADC-DEPEN-001: 外部依赖
ADC-CONST-001: 系统约束

# 一些无关文本和无效ID
INVALID-001: 这不是有效ID
FR: 这也不是
US-: 这个也不对
            `;

            const result = await IDParser.extractAllIds(srsContent);

            // 应该提取9个有效ID，忽略无效的
            expect(result).toHaveLength(9);
            
            // 验证类型分布
            const basicIds = result.filter(r => r.type === 'basic');
            const adcIds = result.filter(r => r.type === 'adc');
            
            expect(basicIds).toHaveLength(6);
            expect(adcIds).toHaveLength(3);
            
            // 验证排序（应该按字母顺序）
            const ids = result.map(r => r.id);
            const sortedIds = [...ids].sort();
            expect(ids).toEqual(sortedIds);
        });

        test('应该正确去重重复的ID', async () => {
            const srsContent = `
FR-LOGIN-001: 第一次出现
FR-LOGIN-001: 重复出现
FR-AUTH-002: 其他ID
FR-LOGIN-001: 再次重复
US-ADMIN-001: 用户故事
US-ADMIN-001: 重复的用户故事
            `;

            const result = await IDParser.extractAllIds(srsContent);

            // 应该只有3个唯一ID
            expect(result).toHaveLength(3);
            
            const ids = result.map(r => r.id);
            expect(ids).toContain('FR-LOGIN-001');
            expect(ids).toContain('FR-AUTH-002');
            expect(ids).toContain('US-ADMIN-001');
            
            // 验证每个ID只出现一次
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(3);
        });

        test('应该处理复杂的ID格式', async () => {
            const srsContent = `
FR-USER_MANAGEMENT-001: 下划线格式
FR-DATA-SYNC-002: 连字符格式
US-MOBILE_APP-001: 移动应用
NFR-LOAD_BALANCER-001: 负载均衡
ADC-ASSU-NETWORK_CONNECTIVITY-001: 长格式ADC
ADC-DEPEN-THIRD_PARTY-API-001: 复杂依赖
            `;

            const result = await IDParser.extractAllIds(srsContent);

            expect(result).toHaveLength(6);
            
            // 验证复杂格式被正确识别
            const ids = result.map(r => r.id);
            expect(ids).toContain('FR-USER_MANAGEMENT-001');
            expect(ids).toContain('FR-DATA-SYNC-002');
            expect(ids).toContain('ADC-ASSU-NETWORK_CONNECTIVITY-001');
            expect(ids).toContain('ADC-DEPEN-THIRD_PARTY-API-001');
        });

        test('应该在空文档时抛出错误', async () => {
            await expect(IDParser.extractAllIds('')).rejects.toMatchObject({
                type: ScaffoldErrorType.INVALID_SRS_FORMAT,
                message: 'SRS文档内容为空'
            });

            await expect(IDParser.extractAllIds('   \n  \t  ')).rejects.toMatchObject({
                type: ScaffoldErrorType.INVALID_SRS_FORMAT,
                message: 'SRS文档内容为空'
            });
        });

        test('应该在没有找到ID时返回空数组', async () => {
            const srsContent = `
# SRS文档

这是一个没有任何需求ID的文档。
只有普通文本内容。

## 章节1
一些描述文字。

## 章节2  
更多文字，但没有ID。
            `;

            const result = await IDParser.extractAllIds(srsContent);
            expect(result).toHaveLength(0);
        });
    });

    describe('validateIdFormat', () => {
        test('应该验证有效的基础实体ID', () => {
            expect(IDParser.validateIdFormat('US-LOGIN-001')).toBe(true);
            expect(IDParser.validateIdFormat('UC-AUTH-001')).toBe(true);
            expect(IDParser.validateIdFormat('FR-SECURITY-001')).toBe(true);
            expect(IDParser.validateIdFormat('NFR-PERFORMANCE-001')).toBe(true);
            expect(IDParser.validateIdFormat('IFR-API-001')).toBe(true);
            expect(IDParser.validateIdFormat('DAR-USER-001')).toBe(true);
        });

        test('应该验证有效的ADC实体ID', () => {
            expect(IDParser.validateIdFormat('ADC-ASSU-001')).toBe(true);
            expect(IDParser.validateIdFormat('ADC-DEPEN-001')).toBe(true);
            expect(IDParser.validateIdFormat('ADC-CONST-001')).toBe(true);
        });

        test('应该拒绝无效的ID格式', () => {
            expect(IDParser.validateIdFormat('INVALID-001')).toBe(false);
            expect(IDParser.validateIdFormat('FR')).toBe(false);
            expect(IDParser.validateIdFormat('US-')).toBe(false);
            expect(IDParser.validateIdFormat('ADC-INVALID-001')).toBe(false);
            expect(IDParser.validateIdFormat('ADC-ASSU')).toBe(false);
            expect(IDParser.validateIdFormat('')).toBe(false);
        });

        test('应该处理边界情况', () => {
            expect(IDParser.validateIdFormat('FR-A-1')).toBe(true);
            expect(IDParser.validateIdFormat('US-VERY_LONG_NAME_WITH_UNDERSCORES-001')).toBe(true);
            expect(IDParser.validateIdFormat('ADC-ASSU-COMPLEX_NAME-001')).toBe(true);
        });
    });

    describe('getSupportedFormats', () => {
        test('应该返回支持格式的说明', () => {
            const formats = IDParser.getSupportedFormats();
            
            expect(formats).toBeInstanceOf(Array);
            expect(formats.length).toBeGreaterThan(0);
            
            // 验证包含关键信息
            const formatsText = formats.join('\n');
            expect(formatsText).toContain('US-xxx');
            expect(formatsText).toContain('UC-xxx');
            expect(formatsText).toContain('FR-xxx');
            expect(formatsText).toContain('NFR-xxx');
            expect(formatsText).toContain('IFR-xxx');
            expect(formatsText).toContain('DAR-xxx');
            expect(formatsText).toContain('ADC-ASSU-xxx');
            expect(formatsText).toContain('ADC-DEPEN-xxx');
            expect(formatsText).toContain('ADC-CONST-xxx');
        });
    });
}); 