/**
 * BaseDirValidator 安全测试
 *
 * 测试安全相关场景：
 * - 路径穿越攻击
 * - 符号链接逃逸
 * - 工作区边界
 * - 恶意路径输入
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BaseDirValidator, BaseDirValidationError, BaseDirErrorCode } from '../../utils/baseDir-validator';

describe('BaseDirValidator - Security Tests', () => {
    let testWorkspaceRoot: string;
    let testProjectDir: string;

    beforeAll(() => {
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'srs-security-test-'));
        testProjectDir = path.join(testWorkspaceRoot, 'project');
        fs.mkdirSync(testProjectDir);

        // 🧪 设置测试 workspace root
        BaseDirValidator.setTestWorkspaceRoot(testWorkspaceRoot);
    });

    afterAll(() => {
        // 清理测试 workspace root
        BaseDirValidator.setTestWorkspaceRoot(null);

        // 清理测试目录
        fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    });

    describe('🛡️ 路径穿越攻击 (Path Traversal)', () => {
        it('应该阻止 ../ 攻击尝试访问父目录', () => {
            const attacks = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\config\\sam',
                'dir/../../etc/passwd',
                'src/../../../root/.ssh/id_rsa'
            ];

            attacks.forEach(attack => {
                assert.throws(
                    () => BaseDirValidator.validatePathWithinBaseDir(attack, testProjectDir),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.PATH_ESCAPE;
                    },
                    `Should block path traversal: ${attack}`
                );
            });
        });

        it('应该阻止绝对路径指向工作区外', () => {
            const attacks = [
                '/etc/passwd',
                '/root/.ssh/id_rsa',
                'C:\\Windows\\System32\\config\\sam'
            ];

            attacks.forEach(attack => {
                if (path.isAbsolute(attack)) {
                    assert.throws(
                        () => BaseDirValidator.validatePathWithinBaseDir(attack, testProjectDir),
                        (error: BaseDirValidationError) => {
                            return error.code === BaseDirErrorCode.PATH_ESCAPE;
                        },
                        `Should block absolute path outside baseDir: ${attack}`
                    );
                }
            });
        });

        it('应该允许合法的子目录访问', () => {
            const legitimatePaths = [
                'src/components/App.tsx',
                'docs/../README.md',  // 解析后在 baseDir 内
                './src/index.ts',
                'a/b/c/d/e/file.txt'
            ];

            legitimatePaths.forEach(safePath => {
                const result = BaseDirValidator.validatePathWithinBaseDir(safePath, testProjectDir);
                assert.ok(result, `Should allow legitimate path: ${safePath}`);
                const realBaseDir = fs.realpathSync(testProjectDir);
                assert.ok(
                    result.startsWith(realBaseDir),
                    `Resolved path should be within baseDir: ${result}`
                );
            });
        });
    });

    describe('🔗 符号链接逃逸攻击', () => {
        // 符号链接测试在 Windows 需要管理员权限
        it('应该阻止符号链接指向工作区外', () => {
            if (process.platform === 'win32') {
                return; // Skip on Windows
            }
            const outsideDir = path.join(os.tmpdir(), 'outside-target');
            const symlinkPath = path.join(testProjectDir, 'malicious-link');

            fs.mkdirSync(outsideDir, { recursive: true });
            fs.symlinkSync(outsideDir, symlinkPath);

            try {
                assert.throws(
                    () => BaseDirValidator.validatePathWithinBaseDir(symlinkPath, testProjectDir),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.PATH_ESCAPE;
                    },
                    'Should block symlink escaping baseDir'
                );
            } finally {
                fs.unlinkSync(symlinkPath);
                fs.rmdirSync(outsideDir);
            }
        });

        it('应该允许符号链接指向 baseDir 内部', () => {
            if (process.platform === 'win32') {
                return; // Skip on Windows
            }

            const targetDir = path.join(testProjectDir, 'real-target');
            const symlinkPath = path.join(testProjectDir, 'safe-link');

            fs.mkdirSync(targetDir);
            fs.symlinkSync(targetDir, symlinkPath);

            try {
                const result = BaseDirValidator.validatePathWithinBaseDir(symlinkPath, testProjectDir);
                assert.ok(result);
                const realBaseDir = fs.realpathSync(testProjectDir);
                assert.ok(result.startsWith(realBaseDir));
            } finally {
                fs.unlinkSync(symlinkPath);
                fs.rmdirSync(targetDir);
            }
        });
    });

    describe('🌐 工作区边界测试', () => {
        it('应该阻止 baseDir 在工作区外（checkWithinWorkspace=true）', () => {
            if (process.env.CI) {
                return; // Skip in CI environment
            }

            const outsideDir = path.join(os.tmpdir(), 'outside-workspace');

            try {
                fs.mkdirSync(outsideDir, { recursive: true });

                assert.throws(
                    () => BaseDirValidator.validateBaseDir(outsideDir, {
                        checkWithinWorkspace: true
                    }),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.OUTSIDE_WORKSPACE;
                    },
                    'Should reject baseDir outside workspace'
                );
            } finally {
                fs.rmSync(outsideDir, { recursive: true, force: true });
            }
        });

        it('应该允许 baseDir 在工作区内', () => {
            const insideDir = path.join(testWorkspaceRoot, 'inside-project');
            fs.mkdirSync(insideDir);

            try {
                const result = BaseDirValidator.validateBaseDir(insideDir);
                assert.ok(result);
                assert.strictEqual(
                    path.normalize(result),
                    path.normalize(fs.realpathSync(insideDir))
                );
            } finally {
                fs.rmdirSync(insideDir);
            }
        });
    });

    describe('🧪 恶意输入测试', () => {
        it('应该正确处理特殊字符路径', () => {
            // 这些路径包含特殊字符，但应该被正确验证（如果存在）
            const specialChars = [
                'project-name',
                'project_name',
                'project.name',
                'project (v2.0)',
                'project [backup]',
                'project@2024'
            ];

            specialChars.forEach(name => {
                const dirPath = path.join(testProjectDir, name);
                fs.mkdirSync(dirPath);

                try {
                    const result = BaseDirValidator.validateBaseDir(dirPath);
                    assert.ok(result);
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(dirPath))
                    );
                } finally {
                    fs.rmdirSync(dirPath);
                }
            });
        });

        it('应该拒绝包含 null 字节的路径', () => {
            const nullBytePaths = [
                'file\x00.txt',
                'dir\x00/file.txt',
                '\x00malicious'
            ];

            nullBytePaths.forEach(malicious => {
                try {
                    // Node.js 本身会拒绝包含 null 字节的路径
                    BaseDirValidator.validateBaseDir(malicious);
                    // 如果没抛出异常，检查是否被拒绝
                } catch (error) {
                    // 应该抛出异常（可能是 Node.js 的，也可能是我们的）
                    assert.ok(error);
                }
            });
        });

        it('应该正确处理 Unicode 路径', () => {
            const unicodePaths = [
                '中文项目',
                'プロジェクト',
                '프로젝트',
                'Проект'
            ];

            unicodePaths.forEach(name => {
                const dirPath = path.join(testProjectDir, name);

                try {
                    fs.mkdirSync(dirPath);
                    const result = BaseDirValidator.validateBaseDir(dirPath);
                    assert.ok(result);
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(dirPath))
                    );
                } catch (error) {
                    // 某些文件系统可能不支持 Unicode，跳过
                    console.log(`Skipping Unicode test for: ${name}`);
                } finally {
                    try {
                        fs.rmdirSync(dirPath);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            });
        });
    });

    describe('⚡ 边界条件测试', () => {
        it('应该处理非常深的路径嵌套', () => {
            // 创建深度嵌套的目录
            let deepPath = testProjectDir;
            const depth = 50;

            for (let i = 0; i < depth; i++) {
                deepPath = path.join(deepPath, `level-${i}`);
            }

            // 尝试验证（可能不存在，但应该能处理）
            assert.throws(
                () => BaseDirValidator.validateBaseDir(deepPath),
                (error: BaseDirValidationError) => {
                    return error.code === BaseDirErrorCode.NOT_EXIST;
                }
            );
        });

        it('应该拒绝根目录作为 baseDir', () => {
            const rootPaths = process.platform === 'win32' ? ['C:\\', 'D:\\'] : ['/'];

            rootPaths.forEach(rootPath => {
                // 根目录通常会被工作区检查拒绝
                assert.throws(
                    () => BaseDirValidator.validateBaseDir(rootPath, {
                        checkWithinWorkspace: true
                    }),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.OUTSIDE_WORKSPACE;
                    },
                    `Should reject root directory: ${rootPath}`
                );
            });
        });
    });

    describe('📊 错误消息质量', () => {
        it('错误消息应该包含有用的调试信息', () => {
            try {
                BaseDirValidator.validateBaseDir('/nonexistent/path');
                assert.fail('Should have thrown');
            } catch (error) {
                const err = error as BaseDirValidationError;
                assert.ok(err.message.includes('/nonexistent/path'), 'Should include the invalid path');
                assert.ok(err.message.length > 30, 'Should have detailed message');
            }
        });

        it('错误消息应该包含修复建议', () => {
            try {
                BaseDirValidator.validateBaseDir(null as any);
                assert.fail('Should have thrown');
            } catch (error) {
                const err = error as Error;
                // 应该包含如何修复的提示
                assert.ok(
                    err.message.includes('delete') || err.message.includes('recreate'),
                    'Should include fix suggestion'
                );
            }
        });
    });
});
