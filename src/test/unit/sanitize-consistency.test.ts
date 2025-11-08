/**
 * 验证各个模块的 sanitize 逻辑一致性
 */

import { SessionPathManager } from '../../core/SessionPathManager';
import { ProjectNameValidator } from '../../utils/project-name-validator';

describe('Sanitize Consistency', () => {
    let pathManager: SessionPathManager;

    beforeEach(() => {
        pathManager = new SessionPathManager('/test/workspace');
    });

    test('应该在所有模块中使用一致的 sanitize 逻辑', () => {
        const testCases = [
            'my@project#name',
            'project*with?special',
            'project:with<>chars',
            'project|with|pipes',
        ];

        testCases.forEach(input => {
            // SessionPathManager 的结果
            const sessionPath = pathManager.getProjectSessionPath(input);
            const sessionSanitized = sessionPath.match(/srs-writer-session_(.+)\.json$/)?.[1];

            // ProjectNameValidator 的结果（50字符限制）
            const validatorSanitized = ProjectNameValidator.sanitizeProjectName(input).substring(0, 50);

            // 应该一致
            expect(sessionSanitized).toBe(validatorSanitized);
        });
    });

    test('应该正确处理路径分隔符', () => {
        // 注意：正常流程不会有包含 / 的 projectName（会被 validator 拒绝）
        // 但 sanitize 方法应该能安全处理
        const input = 'my/project';

        const sessionPath = pathManager.getProjectSessionPath(input);

        // 不应该包含路径分隔符
        expect(sessionPath).not.toContain('/srs-writer-session_my/');
        expect(sessionPath).toMatch(/srs-writer-session_[^\/]+\.json$/);
    });
});
