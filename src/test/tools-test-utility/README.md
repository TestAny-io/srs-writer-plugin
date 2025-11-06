# Tool Testing Scripts

## test-tool-call.ts - Standalone Tool Call Test Utility

A utility to directly test individual tools from the compiled SRS Writer plugin without going through the full orchestrator pipeline.

### Purpose

- **Quick Error Message Verification**: Easily reproduce and verify tool error messages (like Issue #4)
- **Tool Development Testing**: Test tool implementations during development
- **Bug Reproduction**: Create reproducible test cases for tool behavior issues
- **Integration Testing**: Verify tool behavior with real compiled code

### Prerequisites

1. Compile the project first:
   ```bash
   npm run compile
   ```

### Usage

#### Option 1: Using JSON Files

1. Create a JSON file with your tool call:
   ```json
   {
     "toolName": "executeTextFileEdits",
     "args": {
       "summary": "Your test description",
       "targetFile": "path/to/file",
       "edits": [...]
     }
   }
   ```

2. Run the test:
   ```bash
   npm run test-tool -- path/to/your/test.json
   ```

#### Option 2: Inline JSON

```bash
npm run test-tool -- --inline '{"toolName":"readFile","args":{"filePath":"README.md","reason":"test"}}'
```

### Example Test Cases

See `src/test/tools-test-utility/examples/` for ready-to-use examples:

#### 1. Test Empty oldString Error (Issue #4)
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-empty-oldstring.json
```

**Expected Output:**
```
▶ Error Message (as AI would see it)
────────────────────────────────────────────────────────────────────────────────
1/1 edit(s) failed in "test-file.css". | Edit 1 ("Try to use empty oldString on non-empty file"): Cannot use empty oldString to replace content in non-empty file (file has 21 characters). Please provide specific text to replace, or use writeFile tool to overwrite the entire file. | Suggestion: Use readFile to verify current file content and ensure exact text matching.
```

#### 2. Test Multiple Failures
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-text-not-found.json
```

Shows how partial failures are reported with detailed information for each failed edit.

#### 3. Test Read File
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-read-file.json
```

Simple test to verify basic tool execution.

### Output Format

The tool provides a comprehensive, color-coded output:

1. **Tool Call Input**: Shows the exact tool call being tested
2. **Loading Tool Registry**: Confirms tool exists in compiled code
3. **Tool Definition**: Displays tool metadata (description, category, layer, risk level)
4. **Executing Tool**: Real-time logs during execution
5. **Execution Result**: Success/failure status and duration
6. **Result Details**: Full JSON output from the tool
7. **Error Message**: Highlighted section showing exactly what the AI would see
8. **Operation Details**: Breakdown of individual operations (for batch tools)
9. **Summary**: Final outcome

### Creating Your Own Test Cases

1. Create a new JSON file in `src/test/tools-test-utility/examples/`
2. Structure:
   ```json
   {
     "toolName": "name-of-tool",
     "args": {
       // Tool-specific arguments based on tool definition
     },
     "caller": "optional-caller-name"  // Optional
   }
   ```

3. Find available tools:
   - Check `dist/tools/index.js` after compilation
   - Use `getAllDefinitions()` to list all tools
   - If you provide a wrong tool name, the utility will list all available tools

### Testing Other Tools

This utility works with ANY tool in the registry. Examples:

**Read File:**
```json
{
  "toolName": "readFile",
  "args": {
    "filePath": "src/extension.ts",
    "reason": "Testing file read"
  }
}
```

**Execute Markdown Edits:**
```json
{
  "toolName": "executeMarkdownEdits",
  "args": {
    "summary": "Test semantic edits",
    "targetFilePath": "docs/README.md",
    "editIntents": [...]
  }
}
```

**Search Project:**
```json
{
  "toolName": "searchProject",
  "args": {
    "query": "executeTextFileEdits",
    "includePatterns": ["*.ts"]
  }
}
```

### Limitations

1. **Workspace Context**: The tool runs with minimal mocked VSCode context
   - `workspaceFolders` points to current directory
   - Some workspace-dependent features may behave differently

2. **Session Manager**: SessionManager is not initialized, so tools fall back to workspace root

3. **No UI Interactions**: Tools that require user input will use default/mocked values

4. **File Operations**: File operations are real - be careful with destructive operations

### Troubleshooting

**Error: "Tool not found in registry"**
- Make sure you've run `npm run compile` first
- Check the tool name spelling
- The utility will list all available tools

**Error: "Cannot find module 'vscode'"**
- This should be handled by the vscode mock
- If you see this, the mock may need updating

**Tool behaves differently than in VSCode**
- Check if the tool depends on SessionManager or workspace state
- Some tools may need additional mocking for full functionality

### Use Cases

1. **Verify Issue #4 Fix**: Test that `executeTextFileEdits` provides detailed error messages
2. **Regression Testing**: Create test cases for fixed bugs
3. **Development Workflow**: Quickly test tool changes without full extension reload
4. **Documentation**: Generate example outputs for tool documentation
5. **Bug Reports**: Create reproducible test cases to attach to issues

### See Also

- `src/test/tools-test-utility/examples/README.md` - Detailed examples catalog
- `src/tools/` - Tool implementations
- GitHub Issues - For bug reports and feature requests
