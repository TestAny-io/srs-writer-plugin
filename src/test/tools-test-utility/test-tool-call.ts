#!/usr/bin/env ts-node
/**
 * Standalone Tool Call Test Utility
 *
 * Purpose: Directly invoke any tool from the compiled SRS Writer plugin
 * without going through the orchestrator, making it easy to test tool
 * error messages and behavior.
 *
 * Usage:
 *   npm run test-tool -- <tool-call-json-file>
 *   npm run test-tool -- --inline '{"toolName":"...", "args":{...}}'
 *
 * Example JSON file format:
 * {
 *   "toolName": "executeTextFileEdits",
 *   "args": {
 *     "summary": "Test edit",
 *     "targetFile": "test.css",
 *     "edits": [
 *       {
 *         "oldString": "",
 *         "newString": "content",
 *         "reason": "Test empty oldString"
 *       }
 *     ]
 *   }
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Module from 'module';

// Mock vscode module before loading any other modules
const originalRequire = Module.prototype.require;
(Module.prototype.require as any) = function (this: any, id: string) {
    if (id === 'vscode') {
        // Return a minimal mock of vscode module
        return {
            workspace: {
                workspaceFolders: [
                    {
                        uri: { fsPath: process.cwd() }
                    }
                ],
                fs: {
                    readFile: async (uri: any) => {
                        const content = fs.readFileSync(uri.fsPath || uri, 'utf-8');
                        return Buffer.from(content);
                    }
                },
                getConfiguration: () => ({
                    get: () => undefined
                })
            },
            Uri: {
                file: (p: string) => ({ fsPath: p }),
                joinPath: (base: any, ...pathSegments: string[]) => ({
                    fsPath: path.join(base.fsPath || base, ...pathSegments)
                })
            },
            window: {
                showErrorMessage: (msg: string) => console.error('VSCode Error:', msg),
                showWarningMessage: (msg: string) => console.warn('VSCode Warning:', msg),
                showInformationMessage: (msg: string) => console.info('VSCode Info:', msg),
                createOutputChannel: (name: string) => ({
                    appendLine: (msg: string) => {},
                    append: (msg: string) => {},
                    show: () => {},
                    hide: () => {},
                    dispose: () => {}
                })
            },
            OutputChannel: class {},
            LogLevel: {
                Trace: 0,
                Debug: 1,
                Info: 2,
                Warning: 3,
                Error: 4,
                Off: 5
            }
        };
    }
    return originalRequire.apply(this, arguments as any);
};

interface ToolCall {
    toolName: string;
    args: any;
    caller?: string;
}

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
    return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title: string) {
    console.log('\n' + colorize('='.repeat(80), 'cyan'));
    console.log(colorize(`  ${title}`, 'bright'));
    console.log(colorize('='.repeat(80), 'cyan') + '\n');
}

function printSection(title: string) {
    console.log(colorize(`\n▶ ${title}`, 'blue'));
    console.log(colorize('─'.repeat(80), 'dim'));
}

function printSuccess(message: string) {
    console.log(colorize(`✓ ${message}`, 'green'));
}

function printError(message: string) {
    console.log(colorize(`✗ ${message}`, 'red'));
}

function printWarning(message: string) {
    console.log(colorize(`⚠ ${message}`, 'yellow'));
}

function printJson(obj: any, indent: number = 2) {
    console.log(JSON.stringify(obj, null, indent));
}

async function loadToolRegistry() {
    try {
        // Import from compiled dist directory
        // Path from src/test/tools-test-utility/ to dist/
        const distPath = path.join(__dirname, '../../../dist/tools/index.js');

        if (!fs.existsSync(distPath)) {
            printError('Tool registry not found in dist directory.');
            printWarning('Please run "npm run compile" first to build the project.');
            process.exit(1);
        }

        const toolModule = await import(distPath);
        return toolModule;
    } catch (error) {
        printError(`Failed to load tool registry: ${(error as Error).message}`);
        printWarning('Make sure the project is compiled with "npm run compile"');
        process.exit(1);
    }
}

async function executeToolCall(toolCall: ToolCall) {
    printHeader('Tool Call Test Utility');

    printSection('Tool Call Input');
    console.log(colorize('Tool Name:', 'bright'), toolCall.toolName);
    console.log(colorize('Caller:', 'bright'), toolCall.caller || 'direct-test');
    console.log(colorize('Arguments:', 'bright'));
    printJson(toolCall.args);

    // Load tool registry from compiled code
    printSection('Loading Tool Registry');
    const toolModule = await loadToolRegistry();

    const {
        hasTool,
        getToolDefinition,
        executeTool: executeToolFromRegistry
    } = toolModule;

    // Check if tool exists
    if (!hasTool(toolCall.toolName)) {
        printError(`Tool "${toolCall.toolName}" not found in registry.`);

        // List available tools
        const allDefinitions = toolModule.getAllDefinitions();
        printSection('Available Tools');
        allDefinitions.forEach((def: any) => {
            console.log(`  • ${colorize(def.name, 'cyan')} (${def.category || 'general'})`);
        });
        process.exit(1);
    }

    printSuccess(`Tool "${toolCall.toolName}" found in registry.`);

    // Get tool definition
    const toolDef = getToolDefinition(toolCall.toolName);
    printSection('Tool Definition');
    console.log(colorize('Description:', 'bright'), toolDef.description.split('\n')[0]);
    console.log(colorize('Category:', 'bright'), toolDef.category || 'N/A');
    console.log(colorize('Layer:', 'bright'), toolDef.layer || 'N/A');
    console.log(colorize('Risk Level:', 'bright'), toolDef.riskLevel || 'N/A');

    // Execute tool
    printSection('Executing Tool');
    const startTime = Date.now();

    try {
        const result = await executeToolFromRegistry(toolCall.toolName, toolCall.args);
        const duration = Date.now() - startTime;

        printSection('Execution Result');
        console.log(colorize('Duration:', 'bright'), `${duration}ms`);
        console.log(colorize('Success:', 'bright'), result.success ?
            colorize('true', 'green') :
            colorize('false', 'red')
        );

        // Display result details
        printSection('Result Details');
        printJson(result);

        // Special formatting for common result patterns
        if (result.error) {
            printSection('Error Message (as AI would see it)');
            console.log(colorize(result.error, 'red'));
        }

        if (result.details && Array.isArray(result.details)) {
            printSection('Operation Details');
            result.details.forEach((detail: any, index: number) => {
                const status = detail.success ?
                    colorize('✓', 'green') :
                    colorize('✗', 'red');
                console.log(`${status} ${colorize(`Detail ${index + 1}:`, 'bright')}`);
                printJson(detail, 2);
            });
        }

        // Summary
        printSection('Summary');
        if (result.success) {
            printSuccess(`Tool executed successfully in ${duration}ms`);
        } else {
            printError(`Tool execution failed in ${duration}ms`);
            if (result.error) {
                printWarning('See "Error Message" section above for details');
            }
        }

    } catch (error) {
        const duration = Date.now() - startTime;
        printSection('Exception Thrown');
        printError(`Tool execution threw an exception after ${duration}ms`);
        console.log(colorize('Error Type:', 'bright'), (error as Error).name);
        console.log(colorize('Error Message:', 'bright'), (error as Error).message);
        if ((error as Error).stack) {
            printSection('Stack Trace');
            console.log((error as Error).stack);
        }
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(colorize('Usage:', 'bright'));
        console.log('  npm run test-tool -- <tool-call-json-file>');
        console.log('  npm run test-tool -- --inline \'{"toolName":"...", "args":{...}}\'');
        console.log('\n' + colorize('Examples:', 'bright'));
        console.log('  npm run test-tool -- examples/test-text-file-edit.json');
        console.log('  npm run test-tool -- --inline \'{"toolName":"readFile","args":{"filePath":"README.md"}}\'');
        process.exit(0);
    }

    let toolCall: ToolCall;

    if (args[0] === '--inline') {
        // Parse inline JSON
        try {
            toolCall = JSON.parse(args[1]);
        } catch (error) {
            printError('Invalid JSON format in --inline argument');
            console.log('Received:', args[1]);
            process.exit(1);
        }
    } else {
        // Read from file
        const filePath = path.resolve(args[0]);

        if (!fs.existsSync(filePath)) {
            printError(`File not found: ${filePath}`);
            process.exit(1);
        }

        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            toolCall = JSON.parse(fileContent);
        } catch (error) {
            printError(`Failed to parse JSON from file: ${(error as Error).message}`);
            process.exit(1);
        }
    }

    // Validate tool call structure
    if (!toolCall.toolName || !toolCall.args) {
        printError('Invalid tool call format. Must have "toolName" and "args" fields.');
        process.exit(1);
    }

    await executeToolCall(toolCall);
}

main().catch(error => {
    printError(`Unhandled error: ${error.message}`);
    console.error(error);
    process.exit(1);
});
