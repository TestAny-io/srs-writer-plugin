/**
 * BaseDirValidator 单元测试
 *
 * 测试 5 项基本验证：
 * 1. 非空验证
 * 2. 绝对路径验证
 * 3. 存在性验证
 * 4. 目录类型验证
 * 5. 工作区范围验证
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BaseDirValidator, BaseDirValidationError, BaseDirErrorCode } from '../../utils/baseDir-validator';

describe('BaseDirValidator', () => {
    let testWorkspaceRoot: string;
    let testProjectDir: string;

    beforeAll(() => {
        // 创建临时测试目录
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'srs-test-workspace-'));
        testProjectDir = path.join(testWorkspaceRoot, 'test-project');
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

    describe('validateBaseDir()', () => {

        describe('✅ 检查 1: 非空验证', () => {
            it('应该拒绝 null', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir(null as any),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.EMPTY &&
                               error.message.includes('baseDir is missing or empty');
                    }
                );
            });

            it('应该拒绝 undefined', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir(undefined as any),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.EMPTY;
                    }
                );
            });

            it('应该拒绝空字符串', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir(''),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.EMPTY;
                    }
                );
            });

            it('应该拒绝只有空格的字符串', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir('   '),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.EMPTY;
                    }
                );
            });
        });

        describe('✅ 检查 2: 绝对路径验证', () => {
            it('应该拒绝相对路径 "./project"', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir('./project'),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.NOT_ABSOLUTE &&
                               error.message.includes('must be an absolute path');
                    }
                );
            });

            it('应该拒绝相对路径 "../project"', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir('../project'),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.NOT_ABSOLUTE;
                    }
                );
            });

            it('应该拒绝相对路径 "project"', () => {
                assert.throws(
                    () => BaseDirValidator.validateBaseDir('project'),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.NOT_ABSOLUTE;
                    }
                );
            });
        });

        describe('✅ 检查 3: 存在性验证', () => {
            it('应该拒绝不存在的路径', () => {
                const nonExistentPath = path.join(testWorkspaceRoot, 'does-not-exist');

                assert.throws(
                    () => BaseDirValidator.validateBaseDir(nonExistentPath),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.NOT_EXIST &&
                               error.message.includes('does not exist');
                    }
                );
            });

            it('应该接受存在的目录', () => {
                const result = BaseDirValidator.validateBaseDir(testProjectDir);
                assert.ok(result);
                assert.strictEqual(
                    path.normalize(result),
                    path.normalize(fs.realpathSync(testProjectDir))
                );
            });
        });

        describe('✅ 检查 4: 目录类型验证', () => {
            it('应该拒绝文件路径（而非目录）', () => {
                const testFile = path.join(testProjectDir, 'test-file.txt');
                fs.writeFileSync(testFile, 'test content');

                assert.throws(
                    () => BaseDirValidator.validateBaseDir(testFile),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.NOT_DIRECTORY &&
                               error.message.includes('is not a directory');
                    }
                );
            });

            it('应该接受目录路径', () => {
                const result = BaseDirValidator.validateBaseDir(testProjectDir);
                assert.ok(result);
            });
        });

        describe('✅ 检查 5: 工作区范围验证', () => {
            it('应该拒绝工作区外的路径（默认 checkWithinWorkspace=true）', () => {
                // 在某些 CI 环境中，可能无法创建工作区外的目录，跳过此测试
                if (process.env.CI) {
                    return; // Skip in CI environment
                }

                const outsidePath = path.join(os.tmpdir(), 'outside-workspace-test');

                try {
                    fs.mkdirSync(outsidePath, { recursive: true });

                    assert.throws(
                        () => BaseDirValidator.validateBaseDir(outsidePath, {
                            checkWithinWorkspace: true
                        }),
                        (error: BaseDirValidationError) => {
                            return error.code === BaseDirErrorCode.OUTSIDE_WORKSPACE &&
                                   error.message.includes('outside workspace');
                        }
                    );
                } finally {
                    fs.rmSync(outsidePath, { recursive: true, force: true });
                }
            });

            it('应该允许在工作区内的路径', () => {
                // 模拟设置 workspace root
                const vscodeWorkspaceMock = testWorkspaceRoot;

                // 注意：实际实现中会通过 vscode.workspace.workspaceFolders 获取
                // 这里只测试逻辑，假设 testProjectDir 在 testWorkspaceRoot 内
                const result = BaseDirValidator.validateBaseDir(testProjectDir);
                assert.ok(result);
                assert.strictEqual(
                    path.normalize(result),
                    path.normalize(fs.realpathSync(testProjectDir))
                );
            });
        });

        describe('🔧 Options: checkWithinWorkspace', () => {
            it('当 checkWithinWorkspace=false 时应该跳过工作区检查', () => {
                if (process.env.CI) {
                    return; // Skip in CI environment
                }

                const outsidePath = path.join(os.tmpdir(), 'outside-workspace-test-2');

                try {
                    fs.mkdirSync(outsidePath, { recursive: true });

                    // 应该不抛出异常
                    const result = BaseDirValidator.validateBaseDir(outsidePath, {
                        checkWithinWorkspace: false
                    });
                    assert.ok(result);
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(outsidePath))
                    );
                } finally {
                    fs.rmSync(outsidePath, { recursive: true, force: true });
                }
            });
        });

        describe('🔗 符号链接处理', () => {
            it('应该解析符号链接到真实路径', () => {
                // 符号链接在 Windows 上需要管理员权限，跳过
                if (process.platform === 'win32') {
                    return; // Skip on Windows
                }

                const targetDir = path.join(testProjectDir, 'real-dir');
                const symlinkPath = path.join(testProjectDir, 'symlink-dir');

                fs.mkdirSync(targetDir);
                fs.symlinkSync(targetDir, symlinkPath);

                try {
                    const result = BaseDirValidator.validateBaseDir(symlinkPath);

                    // 应该返回真实路径
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(symlinkPath))
                    );
                } finally {
                    fs.unlinkSync(symlinkPath);
                    fs.rmdirSync(targetDir);
                }
            });
        });

        describe('🌍 跨平台路径', () => {
            it('应该正确处理 Windows 路径分隔符', () => {
                if (process.platform === 'win32') {
                    const windowsPath = testProjectDir.replace(/\//g, '\\');
                    const result = BaseDirValidator.validateBaseDir(windowsPath);
                    assert.ok(result);
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(testProjectDir))
                    );
                }
            });

            it('应该正确处理 POSIX 路径分隔符', () => {
                if (process.platform !== 'win32') {
                    const result = BaseDirValidator.validateBaseDir(testProjectDir);
                    assert.ok(result);
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(testProjectDir))
                    );
                }
            });
        });
    });

    describe('validatePathWithinBaseDir()', () => {

        describe('✅ 基本功能', () => {
            it('应该解析相对路径到绝对路径', () => {
                const relativePath = 'src/components/App.tsx';
                const result = BaseDirValidator.validatePathWithinBaseDir(
                    relativePath,
                    testProjectDir
                );

                const expected = path.join(testProjectDir, relativePath);
                // 相对于真实 baseDir 进行路径解析
                const realBaseDir = fs.realpathSync(testProjectDir);
                const expectedRealPath = path.resolve(realBaseDir, relativePath);
                assert.strictEqual(
                    path.normalize(result),
                    path.normalize(expectedRealPath)
                );
            });

            it('应该接受已经是绝对路径的路径', () => {
                const absolutePath = path.join(testProjectDir, 'src/App.tsx');
                const result = BaseDirValidator.validatePathWithinBaseDir(
                    absolutePath,
                    testProjectDir
                );

                // 绝对路径应该被标准化为真实路径
                // 获取相对于 testProjectDir 的相对路径，然后解析到真实 baseDir
                const relativePart = path.relative(testProjectDir, absolutePath);
                const realBaseDir = fs.realpathSync(testProjectDir);
                const expectedRealPath = path.resolve(realBaseDir, relativePart);
                assert.strictEqual(
                    path.normalize(result),
                    path.normalize(expectedRealPath)
                );
            });
        });

        describe('🛡️ 路径逃逸检测', () => {
            it('应该拒绝尝试逃逸 baseDir 的路径（使用 ../）', () => {
                const escapePath = '../../../etc/passwd';

                assert.throws(
                    () => BaseDirValidator.validatePathWithinBaseDir(escapePath, testProjectDir),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.PATH_ESCAPE &&
                               error.message.includes('escape');
                    }
                );
            });

            it('应该拒绝绝对路径指向 baseDir 外部', () => {
                const outsidePath = path.join(testWorkspaceRoot, '..', 'outside.txt');

                assert.throws(
                    () => BaseDirValidator.validatePathWithinBaseDir(outsidePath, testProjectDir),
                    (error: BaseDirValidationError) => {
                        return error.code === BaseDirErrorCode.PATH_ESCAPE;
                    }
                );
            });

            it('应该接受在 baseDir 内的路径', () => {
                const safePath = 'src/deep/nested/file.txt';
                const result = BaseDirValidator.validatePathWithinBaseDir(
                    safePath,
                    testProjectDir
                );

                assert.ok(result);
                const realBaseDir = fs.realpathSync(testProjectDir);
                assert.ok(result.startsWith(realBaseDir));
            });
        });

        describe('🔗 符号链接处理', () => {
            it('应该解析符号链接目标', () => {
                if (process.platform === 'win32') {
                    return; // Skip on Windows
                }

                const realFile = path.join(testProjectDir, 'real-file.txt');
                const symlinkFile = path.join(testProjectDir, 'symlink-file.txt');

                fs.writeFileSync(realFile, 'content');
                fs.symlinkSync(realFile, symlinkFile);

                try {
                    const result = BaseDirValidator.validatePathWithinBaseDir(
                        symlinkFile,
                        testProjectDir
                    );

                    // 应该解析到真实路径
                    assert.strictEqual(
                        path.normalize(result),
                        path.normalize(fs.realpathSync(symlinkFile))
                    );
                } finally {
                    fs.unlinkSync(symlinkFile);
                    fs.unlinkSync(realFile);
                }
            });
        });
    });

    describe('getSafeBaseDir()', () => {
        it('当 baseDir 为 null 时应该返回 workspace root', () => {
            // 在测试中，workspace root 被设置为 testWorkspaceRoot
            const result = BaseDirValidator.getSafeBaseDir(null);
            assert.ok(result);
            assert.strictEqual(
                path.normalize(result),
                path.normalize(testWorkspaceRoot)
            );
        });

        it('当 baseDir 有效时应该返回验证后的 baseDir', () => {
            const result = BaseDirValidator.getSafeBaseDir(testProjectDir);
            assert.strictEqual(
                path.normalize(result),
                path.normalize(fs.realpathSync(testProjectDir))
            );
        });
    });

    describe('BaseDirValidationError', () => {
        it('应该包含错误代码', () => {
            try {
                BaseDirValidator.validateBaseDir(null as any);
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof BaseDirValidationError);
                assert.strictEqual((error as BaseDirValidationError).code, BaseDirErrorCode.EMPTY);
            }
        });

        it('应该包含清晰的错误消息', () => {
            try {
                BaseDirValidator.validateBaseDir('');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof BaseDirValidationError);
                assert.ok((error as Error).message.length > 20); // 非空详细消息
            }
        });

        it('错误应该是 Error 的子类', () => {
            try {
                BaseDirValidator.validateBaseDir(undefined as any);
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error instanceof BaseDirValidationError);
            }
        });
    });
});
