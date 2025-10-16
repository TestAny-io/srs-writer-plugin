/**
 * Tool Access Control v3.0 Integration Tests
 * 
 * Tests the integration between ToolAccessController, ToolCacheManager, and SpecialistRegistry
 */

import { ToolAccessController } from '../../core/orchestrator/ToolAccessController';
import { ToolCacheManager } from '../../core/orchestrator/ToolCacheManager';
import { CallerType } from '../../types/index';

// Mock vscode
jest.mock('vscode');

// Mock logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            error: jest.fn()
        }))
    }
}));

// Mock SpecialistRegistry
const mockRegistry = {
    isSpecialistAvailable: jest.fn((id: string) => {
        return ['prototype_designer', 'fr_writer', 'project_initializer'].includes(id);
    }),
    scanAndRegister: jest.fn().mockResolvedValue({ validSpecialists: [] })
};

jest.mock('../../core/specialistRegistry', () => ({
    getSpecialistRegistry: jest.fn(() => mockRegistry)
}));

// Mock tool definitions
const mockTools = [
    {
        name: 'readFile',
        description: 'Read file',
        parameters: {},
        layer: 'atomic',
        accessibleBy: [CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]
    },
    {
        name: 'writePrototypeTheme',
        description: 'Write theme',
        parameters: {},
        layer: 'atomic',
        category: 'prototype',
        accessibleBy: ['prototype_designer']
    }
];

jest.mock('../../tools/index', () => ({
    getAllDefinitions: jest.fn(() => mockTools),
    getToolDefinition: jest.fn((name: string) => mockTools.find(t => t.name === name)),
    toolRegistry: {
        onCacheInvalidation: jest.fn((callback: Function) => {})
    }
}));

describe('Tool Access Control v3.0 Integration', () => {
    let controller: ToolAccessController;
    let cacheManager: ToolCacheManager;

    beforeEach(() => {
        controller = new ToolAccessController();
        cacheManager = new ToolCacheManager();
        jest.clearAllMocks();
    });

    describe('ToolAccessController and ToolCacheManager integration', () => {
        test('should cache tools with specialist ID', async () => {
            const result1 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const result2 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            
            expect(result1.definitions.length).toBeGreaterThan(0);
            expect(result1.definitions).toEqual(result2.definitions);
        });

        test('should have different caches for different specialists', async () => {
            const cache1 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const cache2 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            
            // prototype_designer should see writePrototypeTheme
            expect(cache1.definitions.find(t => t.name === 'writePrototypeTheme')).toBeDefined();
            
            // fr_writer should not see writePrototypeTheme
            expect(cache2.definitions.find(t => t.name === 'writePrototypeTheme')).toBeUndefined();
        });

        test('should have separate cache for type-level access', async () => {
            const withId = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const withoutId = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT);
            
            // With ID should have more tools
            expect(withId.definitions.length).toBeGreaterThan(withoutId.definitions.length);
        });
    });

    describe('SpecialistRegistry integration', () => {
        test('should validate specialist existence', () => {
            controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writePrototypeTheme', 'prototype_designer');
            
            expect(mockRegistry.isSpecialistAvailable).toHaveBeenCalledWith('prototype_designer');
        });

        test('should handle non-existent specialist gracefully', () => {
            // Test with a specialist that IS in accessibleBy but doesn't exist
            mockRegistry.isSpecialistAvailable.mockClear();
            mockRegistry.isSpecialistAvailable.mockReturnValueOnce(false);
            
            const hasAccess = controller.validateAccess(
                CallerType.SPECIALIST_CONTENT, 
                'writePrototypeTheme', 
                'prototype_designer'  // In accessibleBy, but mock returns false
            );
            
            expect(hasAccess).toBe(false);
            expect(mockRegistry.isSpecialistAvailable).toHaveBeenCalledWith('prototype_designer');
            
            // Reset mock
            mockRegistry.isSpecialistAvailable.mockReturnValue(true);
        });
    });

    describe('End-to-end workflow', () => {
        test('prototype_designer workflow', async () => {
            // Step 1: Get tools for prototype_designer
            const tools = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            
            // Should see general tools
            expect(tools.definitions.find(t => t.name === 'readFile')).toBeDefined();
            
            // Should see prototype-specific tools
            expect(tools.definitions.find(t => t.name === 'writePrototypeTheme')).toBeDefined();
            
            // Step 2: Validate access to prototype tool
            const canAccess = controller.validateAccess(
                CallerType.SPECIALIST_CONTENT,
                'writePrototypeTheme',
                'prototype_designer'
            );
            
            expect(canAccess).toBe(true);
        });

        test('fr_writer workflow', async () => {
            // Step 1: Get tools for fr_writer
            const tools = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            
            // Should see general tools
            expect(tools.definitions.find(t => t.name === 'readFile')).toBeDefined();
            
            // Should NOT see prototype-specific tools (token optimization)
            expect(tools.definitions.find(t => t.name === 'writePrototypeTheme')).toBeUndefined();
            
            // Step 2: Validate access denied
            const canAccess = controller.validateAccess(
                CallerType.SPECIALIST_CONTENT,
                'writePrototypeTheme',
                'fr_writer'
            );
            
            expect(canAccess).toBe(false);
        });
    });

    describe('Cache key generation', () => {
        test('should generate different cache keys for different specialists', async () => {
            await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            await cacheManager.getTools(CallerType.SPECIALIST_CONTENT); // no specialistId
            
            // All three should be cached separately
            // This is validated by the different tool lists they receive
            const tools1 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const tools2 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            const tools3 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT);
            
            expect(tools1.definitions.length).not.toBe(tools2.definitions.length);
            expect(tools1.definitions.length).toBeGreaterThan(tools3.definitions.length);
        });
    });
});

