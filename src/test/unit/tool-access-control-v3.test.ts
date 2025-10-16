/**
 * Tool Access Control v3.0 Unit Tests
 * 
 * Tests for the hybrid access control system (CallerType + CallerName)
 */

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
const mockIsSpecialistAvailable = jest.fn((id: string) => {
    const availableSpecialists = [
        'prototype_designer',
        'fr_writer',
        'project_initializer',
        'nfr_writer'
    ];
    return availableSpecialists.includes(id);
});

jest.mock('../../core/specialistRegistry', () => ({
    getSpecialistRegistry: jest.fn(() => ({
        isSpecialistAvailable: mockIsSpecialistAvailable,
        scanAndRegister: jest.fn().mockResolvedValue({ validSpecialists: [] })
    }))
}));

// Mock tool definitions (avoid importing from tools/index.ts)
const mockToolDefinitions = [
    {
        name: 'readFile',
        description: 'Read file content',
        parameters: {},
        layer: 'atomic',
        accessibleBy: [
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS
        ]
    },
    {
        name: 'writeFile',
        description: 'Write file content',
        parameters: {},
        layer: 'atomic',
        accessibleBy: [
            CallerType.SPECIALIST_PROCESS,
            'prototype_designer'  // Hybrid: CallerType + CallerName
        ]
    },
    {
        name: 'writePrototypeTheme',
        description: 'Write prototype theme',
        parameters: {},
        layer: 'atomic',
        category: 'prototype',
        accessibleBy: ['prototype_designer', 'project_initializer']  // Only CallerName
    },
    {
        name: 'previewPrototype',
        description: 'Preview prototype',
        parameters: {},
        layer: 'atomic',
        category: 'prototype',
        accessibleBy: ['prototype_designer']  // Exclusive
    }
];

jest.mock('../../tools/index', () => ({
    getAllDefinitions: jest.fn(() => mockToolDefinitions),
    getToolDefinition: jest.fn((name: string) => 
        mockToolDefinitions.find(t => t.name === name)
    ),
    CallerType: CallerType
}));

// Now import the class under test
import { ToolAccessController } from '../../core/orchestrator/ToolAccessController';

describe('ToolAccessController v3.0', () => {
    let controller: ToolAccessController;

    beforeEach(() => {
        controller = new ToolAccessController();
        jest.clearAllMocks();
    });

    describe('CallerType-based access (v2.0 compatibility)', () => {
        test('should allow SPECIALIST_CONTENT to access readFile', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT);
            expect(tools.find(t => t.name === 'readFile')).toBeDefined();
        });

        test('should allow SPECIALIST_PROCESS to access readFile', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_PROCESS);
            expect(tools.find(t => t.name === 'readFile')).toBeDefined();
        });
    });

    describe('CallerName-based access (v3.0 new)', () => {
        test('should allow prototype_designer to access writePrototypeTheme', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            expect(tools.find(t => t.name === 'writePrototypeTheme')).toBeDefined();
        });

        test('should deny fr_writer access to writePrototypeTheme', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            expect(tools.find(t => t.name === 'writePrototypeTheme')).toBeUndefined();
        });

        test('should allow project_initializer to access writePrototypeTheme', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_PROCESS, 'project_initializer');
            expect(tools.find(t => t.name === 'writePrototypeTheme')).toBeDefined();
        });

        test('should only allow prototype_designer to access previewPrototype', () => {
            const tools1 = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const tools2 = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            
            expect(tools1.find(t => t.name === 'previewPrototype')).toBeDefined();
            expect(tools2.find(t => t.name === 'previewPrototype')).toBeUndefined();
        });
    });

    describe('Hybrid access control (v3.0 new)', () => {
        test('should allow SPECIALIST_PROCESS to access writeFile via CallerType', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_PROCESS);
            expect(tools.find(t => t.name === 'writeFile')).toBeDefined();
        });

        test('should allow prototype_designer to access writeFile via CallerName', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            expect(tools.find(t => t.name === 'writeFile')).toBeDefined();
        });

        test('should deny other content specialists access to writeFile', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            expect(tools.find(t => t.name === 'writeFile')).toBeUndefined();
        });
    });

    describe('validateAccess method', () => {
        test('should validate CallerType access', () => {
            expect(controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'readFile')).toBe(true);
        });

        test('should validate CallerName access', () => {
            expect(controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writePrototypeTheme', 'prototype_designer')).toBe(true);
            expect(controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writePrototypeTheme', 'fr_writer')).toBe(false);
        });

        test('should validate hybrid access', () => {
            expect(controller.validateAccess(CallerType.SPECIALIST_PROCESS, 'writeFile')).toBe(true);
            expect(controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writeFile', 'prototype_designer')).toBe(true);
            expect(controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writeFile', 'fr_writer')).toBe(false);
        });
    });

    describe('SpecialistRegistry integration', () => {
        test('should reject non-existent specialist', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'non_existent');
            expect(tools.find(t => t.name === 'writePrototypeTheme')).toBeUndefined();
        });

        test('should call SpecialistRegistry.isSpecialistAvailable', () => {
            controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writePrototypeTheme', 'prototype_designer');
            expect(mockIsSpecialistAvailable).toHaveBeenCalledWith('prototype_designer');
        });
    });

    describe('Backward compatibility', () => {
        test('should work without specialistId', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT);
            expect(tools.find(t => t.name === 'readFile')).toBeDefined();
        });

        test('should not show specialist-specific tools without specialistId', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT);
            expect(tools.find(t => t.name === 'writePrototypeTheme')).toBeUndefined();
            expect(tools.find(t => t.name === 'previewPrototype')).toBeUndefined();
        });
    });

    describe('Token optimization', () => {
        test('prototype_designer sees prototype-specific tools', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
            const prototypeTools = tools.filter(t => t.category === 'prototype');
            expect(prototypeTools.length).toBe(2); // writePrototypeTheme + previewPrototype
        });

        test('fr_writer does not see prototype-specific tools', () => {
            const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
            const prototypeTools = tools.filter(t => t.category === 'prototype');
            expect(prototypeTools.length).toBe(0); // Token saving!
        });
    });
});
