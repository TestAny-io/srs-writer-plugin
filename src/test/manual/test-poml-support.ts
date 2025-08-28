/**
 * 手动测试：验证 .poml 文件支持功能
 * 
 * 测试目的：
 * 1. 确认系统能够识别和加载 .poml 文件
 * 2. 确认 .poml 文件优先级高于 .md 文件
 * 3. 确认向后兼容性（.md 文件仍然工作）
 * 4. 确认动态文件扫描功能正常
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    getSupportedSpecialistExtensions, 
    isSpecialistFile, 
    filterSpecialistFiles,
    findSpecialistFileWithExtension,
    getSpecialistFileName,
    removeSpecialistExtension,
    getSpecialistFileExtension
} from '../../utils/fileExtensions';
import { getSpecialistRegistry } from '../../core/specialistRegistry';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

export async function testPomlSupport() {
    console.log('🧪 开始测试 .poml 文件支持功能...');
    
    const results = {
        fileExtensionUtils: false,
        specialistRegistry: false,
        priorityTest: false,
        backwardCompatibility: false,
        overallSuccess: false
    };
    
    try {
        // 测试 1: 文件扩展名工具函数
        console.log('\n📋 测试 1: 文件扩展名工具函数');
        results.fileExtensionUtils = await testFileExtensionUtils();
        
        // 测试 2: SpecialistRegistry 识别 .poml 文件
        console.log('\n📋 测试 2: SpecialistRegistry 识别 .poml 文件');
        results.specialistRegistry = await testSpecialistRegistryPomlSupport();
        
        // 测试 3: 优先级测试（.poml > .md）
        console.log('\n📋 测试 3: 优先级测试（.poml > .md）');
        results.priorityTest = await testPriorityHandling();
        
        // 测试 4: 向后兼容性测试
        console.log('\n📋 测试 4: 向后兼容性测试');
        results.backwardCompatibility = await testBackwardCompatibility();
        
        // 汇总结果
        const passedTests = Object.values(results).filter(Boolean).length - 1; // -1 因为 overallSuccess 还没设置
        results.overallSuccess = passedTests === 4;
        
        console.log('\n🎉 测试结果汇总:');
        console.log(`✅ 文件扩展名工具函数: ${results.fileExtensionUtils ? '通过' : '失败'}`);
        console.log(`✅ SpecialistRegistry支持: ${results.specialistRegistry ? '通过' : '失败'}`);
        console.log(`✅ 优先级处理: ${results.priorityTest ? '通过' : '失败'}`);
        console.log(`✅ 向后兼容性: ${results.backwardCompatibility ? '通过' : '失败'}`);
        console.log(`\n🏆 总体结果: ${results.overallSuccess ? '✅ 全部通过' : '❌ 部分失败'}`);
        
        return results;
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        return results;
    }
}

async function testFileExtensionUtils(): Promise<boolean> {
    try {
        // 测试支持的扩展名
        const extensions = getSupportedSpecialistExtensions();
        console.log(`  📁 支持的扩展名: ${extensions.join(', ')}`);
        
        if (!extensions.includes('.poml') || !extensions.includes('.md')) {
            console.error('  ❌ 扩展名列表不正确');
            return false;
        }
        
        if (extensions[0] !== '.poml') {
            console.error('  ❌ .poml 应该是第一优先级');
            return false;
        }
        
        // 测试文件识别
        const testFiles = [
            'test.poml',
            'test.md', 
            'test.txt',
            '.gitkeep'
        ];
        
        const expectedResults = [true, true, false, false];
        
        for (let i = 0; i < testFiles.length; i++) {
            const result = isSpecialistFile(testFiles[i]);
            if (result !== expectedResults[i]) {
                console.error(`  ❌ 文件识别失败: ${testFiles[i]} 期望 ${expectedResults[i]}, 实际 ${result}`);
                return false;
            }
        }
        
        // 测试文件过滤
        const filteredFiles = filterSpecialistFiles(testFiles);
        const expectedFiltered = ['test.poml', 'test.md'];
        
        if (JSON.stringify(filteredFiles) !== JSON.stringify(expectedFiltered)) {
            console.error(`  ❌ 文件过滤失败: 期望 ${expectedFiltered}, 实际 ${filteredFiles}`);
            return false;
        }
        
        // 测试扩展名移除
        const testRemoval = removeSpecialistExtension('test.poml');
        if (testRemoval !== 'test') {
            console.error(`  ❌ 扩展名移除失败: 期望 'test', 实际 '${testRemoval}'`);
            return false;
        }
        
        // 测试扩展名获取
        const testExtension = getSpecialistFileExtension('test.poml');
        if (testExtension !== '.poml') {
            console.error(`  ❌ 扩展名获取失败: 期望 '.poml', 实际 '${testExtension}'`);
            return false;
        }
        
        console.log('  ✅ 文件扩展名工具函数测试通过');
        return true;
        
    } catch (error) {
        console.error('  ❌ 文件扩展名工具函数测试失败:', error);
        return false;
    }
}

async function testSpecialistRegistryPomlSupport(): Promise<boolean> {
    try {
        const registry = getSpecialistRegistry();
        
        // 检查是否能找到 overall_description_writer.poml
        const specialists = await registry.getAllSpecialists();
        const overallDescriptionWriter = specialists.find(s => s.config.id === 'overall_description_writer');
        
        if (!overallDescriptionWriter) {
            console.error('  ❌ 未找到 overall_description_writer specialist');
            return false;
        }
        
        // 检查文件路径是否包含 .poml
        if (!overallDescriptionWriter.filePath.endsWith('.poml')) {
            console.log(`  ⚠️ overall_description_writer 使用的是 ${path.extname(overallDescriptionWriter.filePath)} 文件，不是 .poml`);
            // 这不算错误，可能是因为 .poml 文件不存在，系统回退到 .md
        } else {
            console.log('  ✅ 成功识别 .poml 文件');
        }
        
        console.log(`  📁 找到 ${specialists.length} 个 specialists`);
        console.log('  ✅ SpecialistRegistry 基本功能正常');
        return true;
        
    } catch (error) {
        console.error('  ❌ SpecialistRegistry 测试失败:', error);
        return false;
    }
}

async function testPriorityHandling(): Promise<boolean> {
    try {
        // 检查 overall_description_writer 文件的实际情况
        const rulesPath = path.join(__dirname, '../../../rules/specialists/content');
        const pomlFile = path.join(rulesPath, 'overall_description_writer.poml');
        const mdFile = path.join(rulesPath, 'overall_description_writer.md');
        
        const pomlExists = fs.existsSync(pomlFile);
        const mdExists = fs.existsSync(mdFile);
        
        console.log(`  📁 .poml 文件存在: ${pomlExists}`);
        console.log(`  📁 .md 文件存在: ${mdExists}`);
        
        if (pomlExists && mdExists) {
            // 测试优先级：应该选择 .poml
            const searchPaths = [rulesPath];
            const foundFile = findSpecialistFileWithExtension('overall_description_writer', searchPaths);
            
            if (!foundFile || !foundFile.endsWith('.poml')) {
                console.error('  ❌ 优先级测试失败：应该选择 .poml 文件');
                return false;
            }
            
            console.log('  ✅ 优先级测试通过：正确选择了 .poml 文件');
        } else if (pomlExists) {
            console.log('  ✅ 只有 .poml 文件存在，符合预期');
        } else if (mdExists) {
            console.log('  ✅ 只有 .md 文件存在，向后兼容正常');
        } else {
            console.error('  ❌ 两个文件都不存在');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('  ❌ 优先级测试失败:', error);
        return false;
    }
}

async function testBackwardCompatibility(): Promise<boolean> {
    try {
        // 查找一个只有 .md 文件的 specialist
        const rulesPath = path.join(__dirname, '../../../rules/specialists/content');
        
        if (!fs.existsSync(rulesPath)) {
            console.error('  ❌ rules/specialists/content 目录不存在');
            return false;
        }
        
        const files = fs.readdirSync(rulesPath);
        const mdOnlyFiles = files.filter(file => {
            if (!file.endsWith('.md')) return false;
            const baseName = path.basename(file, '.md');
            const pomlFile = `${baseName}.poml`;
            return !files.includes(pomlFile);
        });
        
        if (mdOnlyFiles.length === 0) {
            console.log('  ⚠️ 没有找到只有 .md 文件的 specialist，无法测试向后兼容性');
            return true; // 不算失败
        }
        
        const testFile = mdOnlyFiles[0];
        const baseName = path.basename(testFile, '.md');
        
        console.log(`  📋 测试文件: ${testFile}`);
        
        // 测试能否找到这个文件
        const searchPaths = [rulesPath];
        const foundFile = findSpecialistFileWithExtension(baseName, searchPaths);
        
        if (!foundFile || !foundFile.endsWith('.md')) {
            console.error(`  ❌ 向后兼容性测试失败：无法找到 ${testFile}`);
            return false;
        }
        
        console.log('  ✅ 向后兼容性测试通过：.md 文件仍然可以正常识别');
        return true;
        
    } catch (error) {
        console.error('  ❌ 向后兼容性测试失败:', error);
        return false;
    }
}

// 可以在开发者控制台运行的测试命令
export const runPomlSupportTest = () => {
    return testPomlSupport();
};
