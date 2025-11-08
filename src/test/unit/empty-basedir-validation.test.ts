/**
 * Empty BaseDir Validation Test
 *
 * Verifies that empty baseDir in session files is properly detected and rejected
 * This test covers the bug fix for validation bypass when baseDir is an empty string
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { SessionManager } from '../../core/session-manager';
import { UnifiedSessionFile } from '../../types/session';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            readFile: jest.fn(),
            writeFile: jest.fn(),
            createDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path }))
    },
    ExtensionContext: {}
}));

// Mock fs
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    },
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),
    realpathSync: jest.fn()
}));

// Mock git operations
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn().mockResolvedValue('main')
}));

describe('Empty BaseDir Validation', () => {
    let sessionManager: SessionManager;
    let mockContext: vscode.ExtensionContext;
    let mockFs: jest.Mocked<typeof fs>;
    let mockFsSync: jest.Mocked<typeof fsSync>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalStoragePath: '/test/global/storage',
            extensionPath: '/test/extension/path'
        } as any;

        mockFs = fs as jest.Mocked<typeof fs>;
        mockFsSync = fsSync as jest.Mocked<typeof fsSync>;

        mockFsSync.existsSync.mockReturnValue(true);
        mockFsSync.mkdirSync.mockReturnValue(undefined);
        (mockFsSync.statSync as any).mockReturnValue({ isDirectory: () => true });
        (mockFsSync.realpathSync as any).mockImplementation((p: string) => p);

        sessionManager = SessionManager.getInstance(mockContext);

        const mockPathManager = {
            getProjectSessionPath: jest.fn((projectName: string) =>
                `/test/workspace/.session-log/srs-writer-session_${projectName}.json`
            ),
            getMainSessionPath: jest.fn(() =>
                '/test/workspace/.session-log/srs-writer-session_main.json'
            ),
            validateWorkspacePath: jest.fn(() => true),
            ensureSessionDirectory: jest.fn().mockResolvedValue(undefined)
        };

        sessionManager['pathManager'] = mockPathManager as any;
    });

    afterEach(() => {
        (SessionManager as any)._instance = null;
    });

    describe('Scenario 2a: baseDir is empty string', () => {
        it('should reject session file with empty baseDir when loading from file', async () => {
            // This test uses switch project, which is the real-world scenario
            // that triggers validation
            const sessionWithEmptyBaseDir: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-id',
                    projectName: 'testproject',
                    baseDir: '',  // ⚠️ Empty string - should be rejected
                    activeFiles: [],
                    gitBranch: 'main',
                    metadata: {
                        srsVersion: 'v1.0',
                        created: '2024-01-01T00:00:00.000Z',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        version: '5.0'
                    }
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-01'
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Setup current session
            sessionManager['currentSession'] = {
                sessionContextId: 'current-id',
                projectName: 'currentproject',
                baseDir: '/test/workspace/currentproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(sessionWithEmptyBaseDir)));

            // Attempt to switch to project with empty baseDir - should reject
            await expect(
                sessionManager.switchToProjectSession('testproject')
            ).rejects.toThrow('Invalid session file: baseDir is missing or empty');
        });

        it('should reject switching to project with empty baseDir', async () => {
            const sessionWithEmptyBaseDir = {
                sessionContextId: 'test-id',
                projectName: 'testproject',
                baseDir: '',  // ⚠️ Empty string
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            const unifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: sessionWithEmptyBaseDir,
                operations: [],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-01' },
                createdAt: '2024-01-01T00:00:00.000Z',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Setup: Current session is valid
            sessionManager['currentSession'] = {
                sessionContextId: 'current-id',
                projectName: 'currentproject',
                baseDir: '/test/workspace/currentproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(unifiedFile)));

            // Attempt to switch to project with empty baseDir - should reject
            await expect(
                sessionManager.switchToProjectSession('testproject')
            ).rejects.toThrow('Invalid session file: baseDir is missing or empty');
        });
    });

    describe('Scenario: baseDir is null or undefined', () => {
        it('should reject session file with null baseDir', async () => {
            const sessionWithNullBaseDir: any = {
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-id',
                    projectName: 'testproject',
                    baseDir: null,  // ⚠️ null
                    activeFiles: [],
                    gitBranch: 'main',
                    metadata: {
                        srsVersion: 'v1.0',
                        created: '2024-01-01T00:00:00.000Z',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        version: '5.0'
                    }
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-01'
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Setup current session
            sessionManager['currentSession'] = {
                sessionContextId: 'current-id',
                projectName: 'currentproject',
                baseDir: '/test/workspace/currentproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(sessionWithNullBaseDir)));

            await expect(
                sessionManager.switchToProjectSession('testproject')
            ).rejects.toThrow('Invalid session file: baseDir is missing or empty');
        });

        it('should reject session file with undefined baseDir', async () => {
            const sessionWithUndefinedBaseDir: any = {
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-id',
                    projectName: 'testproject',
                    // baseDir: undefined - field not present
                    activeFiles: [],
                    gitBranch: 'main',
                    metadata: {
                        srsVersion: 'v1.0',
                        created: '2024-01-01T00:00:00.000Z',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        version: '5.0'
                    }
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-01'
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Setup current session
            sessionManager['currentSession'] = {
                sessionContextId: 'current-id',
                projectName: 'currentproject',
                baseDir: '/test/workspace/currentproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(sessionWithUndefinedBaseDir)));

            await expect(
                sessionManager.switchToProjectSession('testproject')
            ).rejects.toThrow('Invalid session file: baseDir is missing or empty');
        });
    });

    describe('Verification: Valid baseDir passes', () => {
        it('should accept session file with valid baseDir', async () => {
            const sessionWithValidBaseDir: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-id',
                    projectName: 'testproject',
                    baseDir: '/test/workspace/testproject',  // ✅ Valid baseDir
                    activeFiles: [],
                    gitBranch: 'main',
                    metadata: {
                        srsVersion: 'v1.0',
                        created: '2024-01-01T00:00:00.000Z',
                        lastModified: '2024-01-01T00:00:00.000Z',
                        version: '5.0'
                    }
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-01'
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                lastUpdated: '2024-01-01T00:00:00.000Z'
            };

            // Setup current session
            sessionManager['currentSession'] = {
                sessionContextId: 'current-id',
                projectName: 'currentproject',
                baseDir: '/test/workspace/currentproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(Buffer.from(JSON.stringify(sessionWithValidBaseDir)));
            mockFs.writeFile.mockResolvedValue(undefined);

            // Should successfully switch without throwing
            await expect(
                sessionManager.switchToProjectSession('testproject')
            ).resolves.not.toThrow();

            // Verify session was switched
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('testproject');
            expect(currentSession?.baseDir).toBe('/test/workspace/testproject');
        });
    });
});
