import * as path from 'path';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * 🚀 智能路径解析测试套件
 * 
 * 测试覆盖所有corner case：
 * - 正常路径拼接
 * - 双重项目名问题
 * - 父子目录同名问题  
 * - 绝对路径处理
 * - 安全性验证
 * - 特殊字符处理
 * - 边界情况
 */

// 模拟PlanExecutor中的智能路径解析方法
class SmartPathResolver {
    private logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };

    /**
     * 🚀 智能路径解析：处理各种路径格式和corner case
     */
    public smartPathResolution(targetFile: string, baseDir: string | null, projectName: string | null): string {
        // 输入验证
        this.validateTargetFile(targetFile);

        // Case 1: target_file是绝对路径
        if (path.isAbsolute(targetFile)) {
            this.logger.info(`🔍 [PATH] Case 1: 绝对路径 -> ${targetFile}`);
            return targetFile;
        }
        
        // Case 2: 没有baseDir，使用target_file作为相对路径
        if (!baseDir) {
            this.logger.info(`🔍 [PATH] Case 2: 无baseDir -> ${targetFile}`);
            return targetFile;
        }
        
        // Case 3: 没有projectName，直接拼接
        if (!projectName) {
            const result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 3: 无projectName -> ${result}`);
            return result;
        }
        
        // Case 4: 核心逻辑 - 检查重复项目名问题
        return this.resolveProjectNameDuplication(targetFile, baseDir, projectName);
    }

    /**
     * 🚀 解决项目名重复问题的核心逻辑
     */
    private resolveProjectNameDuplication(targetFile: string, baseDir: string, projectName: string): string {
        // 标准化项目名（处理特殊字符）
        const normalizedProjectName = this.normalizeProjectName(projectName);
        
        // 检查baseDir是否以项目名结尾
        const baseDirEndsWithProject = this.pathEndsWithProjectName(baseDir, normalizedProjectName);
        
        // 检查target_file是否以项目名开头
        const targetFileStartsWithProject = this.pathStartsWithProjectName(targetFile, normalizedProjectName);
        

        
        let result: string;
        
        if (baseDirEndsWithProject && targetFileStartsWithProject) {
            // Case 4a: 双重项目名 - 需要精确处理，避免父子目录同名问题
            result = this.handleDuplicateProjectName(targetFile, baseDir, normalizedProjectName);
            this.logger.info(`🔍 [PATH] Case 4a: 双重项目名 -> ${result}`);
            
        } else if (baseDirEndsWithProject && !targetFileStartsWithProject) {
            // Case 4b: baseDir包含项目名，target_file不包含 - 正常拼接
            result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 4b: baseDir含项目名 -> ${result}`);
            
        } else if (!baseDirEndsWithProject && targetFileStartsWithProject) {
            // Case 4c: baseDir不包含项目名，target_file包含 - 正常拼接
            result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 4c: target_file含项目名 -> ${result}`);
            
        } else {
            // Case 4d: 都不包含项目名 - 可能需要插入项目名
            result = this.handleMissingProjectName(targetFile, baseDir, normalizedProjectName);
            this.logger.info(`🔍 [PATH] Case 4d: 都不含项目名 -> ${result}`);
        }
        
        return result;
    }

    /**
     * 🚀 处理双重项目名问题 - 精确版本，避免父子目录同名陷阱
     */
    private handleDuplicateProjectName(targetFile: string, baseDir: string, projectName: string): string {
        // 标准化路径分隔符
        const normalizedTargetFile = targetFile.replace(/[\\\/]/g, path.sep);
        const normalizedBaseDir = baseDir.replace(/[\\\/]/g, path.sep);
        const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
        
        // 分析baseDir和targetFile的结构
        const baseDirParts = normalizedBaseDir.split(path.sep);
        const targetFileParts = normalizedTargetFile.split(path.sep);
        
        // 检查是否真的是双重项目名，而不是父子目录同名
        if (targetFileParts.length > 1 && targetFileParts[0] === normalizedProjectName) {
            // 获取baseDir中最后一个目录名
            const lastBaseDirPart = baseDirParts[baseDirParts.length - 1];
            
            if (lastBaseDirPart === normalizedProjectName) {
                // 确实是双重项目名，移除target_file中的项目名前缀
                const relativePath = targetFileParts.slice(1).join(path.sep);
                
                // 额外验证：确保这不是有意的子目录结构
                if (this.isIntentionalSubdirectory(normalizedTargetFile, normalizedProjectName)) {
                    this.logger.info(`🔍 [PATH] 检测到有意的子目录结构，保持原样`);
                    return path.join(normalizedBaseDir, normalizedTargetFile);
                }
                
                this.logger.info(`🔍 [PATH] 移除重复项目名前缀: ${normalizedTargetFile} -> ${relativePath}`);
                return path.join(normalizedBaseDir, relativePath);
            }
        }
        
        // 如果不是双重项目名，正常拼接
        return path.join(normalizedBaseDir, normalizedTargetFile);
    }

    /**
     * 🚀 检查是否是有意的子目录结构
     */
    private isIntentionalSubdirectory(targetFile: string, projectName: string): boolean {
        const parts = targetFile.split(path.sep);
        
        // 如果路径中有多个相同的项目名，可能是有意的
        const projectNameCount = parts.filter(part => part === projectName).length;
        
        // 如果有深层次的目录结构，更可能是有意的
        if (parts.length > 3 && projectNameCount > 1) {
            return true;
        }
        
        // 检查是否是常见的有意子目录模式
        const intentionalPatterns = [
            `${projectName}/src/${projectName}`,
            `${projectName}/lib/${projectName}`,
            `${projectName}/packages/${projectName}`,
            `${projectName}/modules/${projectName}`
        ];
        
        return intentionalPatterns.some(pattern => targetFile.startsWith(pattern));
    }

    /**
     * 🚀 处理缺失项目名的情况
     */
    private handleMissingProjectName(targetFile: string, baseDir: string, projectName: string): string {
        // 检查是否应该插入项目名
        const shouldInsertProject = this.shouldInsertProjectName(targetFile, baseDir, projectName);
        
        if (shouldInsertProject) {
            const result = path.join(baseDir, projectName, targetFile);
            this.logger.info(`🔍 [PATH] 插入项目名: ${targetFile} -> ${result}`);
            return result;
        }
        
        // 否则直接拼接
        return path.join(baseDir, targetFile);
    }

    /**
     * 🚀 判断是否应该插入项目名
     */
    private shouldInsertProjectName(targetFile: string, baseDir: string, projectName: string): boolean {
        // 如果targetFile是常见的项目根文件，不插入项目名
        const rootFiles = [
            'package.json', 'README.md', 'SRS.md', 'LICENSE', 
            '.gitignore', 'tsconfig.json', 'webpack.config.js'
        ];
        
        if (rootFiles.includes(targetFile)) {
            return false;
        }
        
        // 如果targetFile包含目录分隔符，可能需要插入项目名
        if (targetFile.includes(path.sep)) {
            return true;
        }
        
        // 默认不插入
        return false;
    }

    /**
     * 🚀 标准化项目名
     */
    private normalizeProjectName(projectName: string): string {
        // 处理项目名中的特殊字符，但保持原有格式
        const normalized = projectName.trim();
        
        // 检查项目名是否包含路径分隔符（这通常是错误的）
        if (normalized.includes(path.sep)) {
            this.logger.warn(`⚠️ 项目名包含路径分隔符，可能存在问题: ${normalized}`);
        }
        
        return normalized;
    }

    /**
     * 🚀 检查路径是否以项目名结尾
     */
    private pathEndsWithProjectName(pathStr: string, projectName: string): boolean {
        // 处理项目名包含路径分隔符的情况
        if (projectName.includes(path.sep) || projectName.includes('/') || projectName.includes('\\')) {
            // 如果项目名包含路径分隔符，检查路径是否以整个项目名结尾
            const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
            const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
            return normalizedPath.endsWith(normalizedProjectName);
        }
        
        // 标准化路径分隔符，确保正确分割
        const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
        const pathParts = normalizedPath.split(path.sep);
        const lastPart = pathParts[pathParts.length - 1];
        return lastPart === projectName;
    }

    /**
     * 🚀 检查路径是否以项目名开头
     */
    private pathStartsWithProjectName(pathStr: string, projectName: string): boolean {
        // 处理Windows和Unix路径分隔符的差异
        const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
        const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
        
        // 处理项目名包含路径分隔符的情况
        if (normalizedProjectName.includes(path.sep)) {
            return normalizedPath.startsWith(normalizedProjectName + path.sep) || 
                   normalizedPath === normalizedProjectName;
        }
        
        const pathParts = normalizedPath.split(path.sep);
        return pathParts.length > 0 && pathParts[0] === normalizedProjectName;
    }

    /**
     * 🚀 验证目标文件路径的安全性
     */
    private validateTargetFile(targetFile: string): void {
        // 禁止路径遍历
        if (targetFile.includes('..')) {
            throw new Error(`不安全的路径遍历: ${targetFile}`);
        }
        
        // 禁止绝对路径到系统敏感目录
        if (path.isAbsolute(targetFile)) {
            const sensitiveDirectories = ['/etc', '/usr/bin', '/bin', '/sbin', '/root'];
            const normalizedPath = path.normalize(targetFile);
            
            for (const sensitiveDir of sensitiveDirectories) {
                if (normalizedPath.startsWith(sensitiveDir)) {
                    throw new Error(`不允许访问系统敏感目录: ${targetFile}`);
                }
            }
        }
        
        // 禁止空路径
        if (!targetFile || targetFile.trim() === '') {
            throw new Error(`目标文件路径不能为空`);
        }
    }
}

// 测试用例定义
interface TestCase {
    name: string;
    baseDir: string | null;
    projectName: string | null;
    targetFile: string;
    expected: string;
    description: string;
}

interface SecurityTestCase {
    name: string;
    baseDir: string | null;
    projectName: string | null;
    targetFile: string;
    shouldThrow: boolean;
    expectedError?: string;
    description: string;
}

describe('智能路径解析测试套件', () => {
    let resolver: SmartPathResolver;

    beforeEach(() => {
        resolver = new SmartPathResolver();
    });

    describe('基本功能测试', () => {
        const basicTestCases: TestCase[] = [
            // 正常情况
            {
                name: '正常路径拼接',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: 'src/main.ts',
                expected: path.join('/workspace/MyProject', 'src/main.ts'),
                description: '基本的路径拼接功能'
            },
            
            // 绝对路径
            {
                name: '绝对路径直接返回',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: '/absolute/path/file.ts',
                expected: '/absolute/path/file.ts',
                description: '绝对路径应该直接返回，不进行拼接'
            },
            
            // 无baseDir
            {
                name: '无baseDir使用相对路径',
                baseDir: null,
                projectName: 'MyProject',
                targetFile: 'MyProject/src/main.ts',
                expected: 'MyProject/src/main.ts',
                description: '没有baseDir时直接返回targetFile'
            },
            
            // 无projectName
            {
                name: '无projectName直接拼接',
                baseDir: '/workspace',
                projectName: null,
                targetFile: 'MyProject/src/main.ts',
                expected: path.join('/workspace', 'MyProject/src/main.ts'),
                description: '没有projectName时直接拼接baseDir和targetFile'
            }
        ];

        basicTestCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('双重项目名问题测试', () => {
        const duplicateProjectNameCases: TestCase[] = [
            // 经典双重项目名问题
            {
                name: '双重项目名修复',
                baseDir: '/Users/user/workspace/BlackpinkFanWebapp',
                projectName: 'BlackpinkFanWebapp',
                targetFile: 'BlackpinkFanWebapp/SRS.md',
                expected: path.join('/Users/user/workspace/BlackpinkFanWebapp', 'SRS.md'),
                description: '修复AI返回的双重项目名路径'
            },
            
            // 双重项目名 - 深层路径
            {
                name: '双重项目名深层路径',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: 'MyProject/src/components/Header.tsx',
                expected: path.join('/workspace/MyProject', 'src/components/Header.tsx'),
                description: '处理包含子目录的双重项目名'
            },
            
            // baseDir包含项目名，targetFile不包含
            {
                name: 'baseDir含项目名正常拼接',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: 'src/main.ts',
                expected: path.join('/workspace/MyProject', 'src/main.ts'),
                description: 'baseDir包含项目名，targetFile不包含时正常拼接'
            },
            
            // baseDir不包含项目名，targetFile包含
            {
                name: 'targetFile含项目名正常拼接',
                baseDir: '/workspace',
                projectName: 'MyProject',
                targetFile: 'MyProject/src/main.ts',
                expected: path.join('/workspace', 'MyProject/src/main.ts'),
                description: 'baseDir不包含项目名，targetFile包含时正常拼接'
            }
        ];

        duplicateProjectNameCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('父子目录同名问题测试', () => {
        const parentChildSameNameCases: TestCase[] = [
            // 父子目录同名 - 简单情况
            {
                name: '父子目录同名基本情况',
                baseDir: '/workspace/parent/child',
                projectName: 'child',
                targetFile: 'child/file.txt',
                expected: path.join('/workspace/parent/child', 'file.txt'),
                description: '父子目录同名时正确处理双重项目名'
            },
            
            // 父子目录同名 - 复杂情况
            {
                name: '父子目录同名复杂情况',
                baseDir: '/aaaa/bbbb/bbbb',
                projectName: 'bbbb',
                targetFile: 'bbbb/ccc.md',
                expected: path.join('/aaaa/bbbb/bbbb', 'ccc.md'),
                description: '处理用户提到的父子目录同名corner case'
            },
            
            // 三层同名目录
            {
                name: '三层同名目录',
                baseDir: '/workspace/test/test/test',
                projectName: 'test',
                targetFile: 'test/file.txt',
                expected: path.join('/workspace/test/test/test', 'file.txt'),
                description: '处理三层同名目录的情况'
            }
        ];

        parentChildSameNameCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('有意子目录结构测试', () => {
        const intentionalSubdirCases: TestCase[] = [
            // 有意的子目录结构 - src目录
            {
                name: '有意的src子目录',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: 'MyProject/src/MyProject/index.ts',
                expected: path.join('/workspace/MyProject', 'MyProject/src/MyProject/index.ts'),
                description: '保持有意的src子目录结构'
            },
            
            // 有意的子目录结构 - lib目录
            {
                name: '有意的lib子目录',
                baseDir: '/workspace/MyLib',
                projectName: 'MyLib',
                targetFile: 'MyLib/lib/MyLib/core.ts',
                expected: path.join('/workspace/MyLib', 'MyLib/lib/MyLib/core.ts'),
                description: '保持有意的lib子目录结构'
            },
            
            // 有意的子目录结构 - packages目录
            {
                name: '有意的packages子目录',
                baseDir: '/workspace/MyPackage',
                projectName: 'MyPackage',
                targetFile: 'MyPackage/packages/MyPackage/package.json',
                expected: path.join('/workspace/MyPackage', 'MyPackage/packages/MyPackage/package.json'),
                description: '保持有意的packages子目录结构'
            }
        ];

        intentionalSubdirCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('特殊字符项目名测试', () => {
        const specialCharCases: TestCase[] = [
            // 包含空格的项目名
            {
                name: '包含空格的项目名',
                baseDir: '/workspace/My Project',
                projectName: 'My Project',
                targetFile: 'My Project/README.md',
                expected: path.join('/workspace/My Project', 'README.md'),
                description: '正确处理包含空格的项目名'
            },
            
            // 包含特殊字符的项目名
            {
                name: '包含特殊字符的项目名',
                baseDir: '/workspace/Project@2024',
                projectName: 'Project@2024',
                targetFile: 'Project@2024/src/main.ts',
                expected: path.join('/workspace/Project@2024', 'src/main.ts'),
                description: '正确处理包含特殊字符的项目名'
            },
            
            // 包含中文的项目名
            {
                name: '包含中文的项目名',
                baseDir: '/workspace/我的项目',
                projectName: '我的项目',
                targetFile: '我的项目/README.md',
                expected: path.join('/workspace/我的项目', 'README.md'),
                description: '正确处理包含中文的项目名'
            }
        ];

        specialCharCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('项目根文件处理测试', () => {
        const rootFileCases: TestCase[] = [
            // 项目根文件不插入项目名
            {
                name: 'package.json不插入项目名',
                baseDir: '/workspace',
                projectName: 'MyProject',
                targetFile: 'package.json',
                expected: path.join('/workspace', 'package.json'),
                description: 'package.json作为根文件不应插入项目名'
            },
            
            // README.md不插入项目名
            {
                name: 'README.md不插入项目名',
                baseDir: '/workspace',
                projectName: 'MyProject',
                targetFile: 'README.md',
                expected: path.join('/workspace', 'README.md'),
                description: 'README.md作为根文件不应插入项目名'
            },
            
            // SRS.md不插入项目名
            {
                name: 'SRS.md不插入项目名',
                baseDir: '/workspace',
                projectName: 'MyProject',
                targetFile: 'SRS.md',
                expected: path.join('/workspace', 'SRS.md'),
                description: 'SRS.md作为根文件不应插入项目名'
            },
            
            // 子目录中的文件应该插入项目名
            {
                name: '子目录文件插入项目名',
                baseDir: '/workspace',
                projectName: 'MyProject',
                targetFile: 'src/main.ts',
                expected: path.join('/workspace', 'MyProject', 'src/main.ts'),
                description: '子目录中的文件应该插入项目名'
            }
        ];

        rootFileCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('安全性测试', () => {
        const securityTestCases: SecurityTestCase[] = [
            // 路径遍历攻击
            {
                name: '路径遍历攻击防护',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: '../../../etc/passwd',
                shouldThrow: true,
                expectedError: '不安全的路径遍历',
                description: '应该阻止路径遍历攻击'
            },
            
            // 系统敏感目录
            {
                name: '系统敏感目录防护',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: '/etc/passwd',
                shouldThrow: true,
                expectedError: '不允许访问系统敏感目录',
                description: '应该阻止访问系统敏感目录'
            },
            
            // 空路径
            {
                name: '空路径防护',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: '',
                shouldThrow: true,
                expectedError: '目标文件路径不能为空',
                description: '应该阻止空路径'
            },
            
            // 只包含空格的路径
            {
                name: '空格路径防护',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: '   ',
                shouldThrow: true,
                expectedError: '目标文件路径不能为空',
                description: '应该阻止只包含空格的路径'
            }
        ];

        securityTestCases.forEach(testCase => {
            it(testCase.name, () => {
                if (testCase.shouldThrow) {
                    expect(() => {
                        resolver.smartPathResolution(
                            testCase.targetFile,
                            testCase.baseDir,
                            testCase.projectName
                        );
                    }).toThrow(testCase.expectedError);
                } else {
                    expect(() => {
                        resolver.smartPathResolution(
                            testCase.targetFile,
                            testCase.baseDir,
                            testCase.projectName
                        );
                    }).not.toThrow();
                }
            });
        });
    });

    describe('边界情况测试', () => {
        const edgeCases: TestCase[] = [
            // 项目名包含路径分隔符（应该警告但不报错）
            {
                name: '项目名包含路径分隔符',
                baseDir: '/workspace/parent/child',
                projectName: 'parent/child',
                targetFile: 'src/main.ts',
                expected: path.join('/workspace/parent/child', 'src/main.ts'),
                description: '项目名包含路径分隔符时应该警告但继续处理'
            },
            
            // 超长路径
            {
                name: '超长路径处理',
                baseDir: '/workspace/MyProject',
                projectName: 'MyProject',
                targetFile: 'src/components/deeply/nested/very/deep/structure/component.tsx',
                expected: path.join('/workspace/MyProject', 'src/components/deeply/nested/very/deep/structure/component.tsx'),
                description: '正确处理超长路径'
            },
            
            // 单字符项目名
            {
                name: '单字符项目名',
                baseDir: '/workspace/a',
                projectName: 'a',
                targetFile: 'a/file.txt',
                expected: path.join('/workspace/a', 'file.txt'),
                description: '正确处理单字符项目名'
            }
        ];

        edgeCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('Windows路径兼容性测试', () => {
        const windowsPathCases: TestCase[] = [
            // Windows路径分隔符
            {
                name: 'Windows路径分隔符',
                baseDir: 'C:\\workspace\\MyProject',
                projectName: 'MyProject',
                targetFile: 'MyProject\\src\\main.ts',
                expected: 'C:/workspace/MyProject/src/main.ts',  // 标准化后的路径
                description: '正确处理Windows路径分隔符'
            },
            
            // 混合路径分隔符
            {
                name: '混合路径分隔符',
                baseDir: 'C:\\workspace\\MyProject',
                projectName: 'MyProject',
                targetFile: 'MyProject/src/main.ts',
                expected: 'C:/workspace/MyProject/src/main.ts',  // 标准化后的路径
                description: '正确处理混合路径分隔符'
            }
        ];

        windowsPathCases.forEach(testCase => {
            it(testCase.name, () => {
                const result = resolver.smartPathResolution(
                    testCase.targetFile,
                    testCase.baseDir,
                    testCase.projectName
                );
                expect(result).toBe(testCase.expected);
            });
        });
    });
});

// 性能测试
describe('性能测试', () => {
    let resolver: SmartPathResolver;

    beforeEach(() => {
        resolver = new SmartPathResolver();
    });

    it('大量路径解析性能测试', () => {
        const startTime = Date.now();
        
        // 执行1000次路径解析
        for (let i = 0; i < 1000; i++) {
            resolver.smartPathResolution(
                'MyProject/src/component.tsx',
                '/workspace/MyProject',
                'MyProject'
            );
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // 1000次操作应该在1秒内完成
        expect(duration).toBeLessThan(1000);
    });
}); 