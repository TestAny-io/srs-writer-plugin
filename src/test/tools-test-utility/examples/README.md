# Tool Call Test Examples

This directory contains example JSON files for testing tools directly using the `test-tool-call.ts` script.

## Usage

```bash
npm run test-tool -- src/test/tools-test-utility/examples/<example-file>.json
```

## Examples

### 1. Test Text File Edit - Empty oldString Error
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-empty-oldstring.json
```

Tests the error message when using empty `oldString` on a non-empty file. This should demonstrate the improved error message from Issue #4.

### 2. Test Text File Edit - Multiple Failures
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-multiple-failures.json
```

Tests multiple edit failures to see the comprehensive error summary.

### 3. Test Read File
```bash
npm run test-tool -- src/test/tools-test-utility/examples/test-read-file.json
```

Simple test to read a file and see the output format.

## Creating Your Own Test Cases

Create a JSON file with this structure:

```json
{
  "toolName": "toolNameHere",
  "args": {
    // Tool-specific arguments
  },
  "caller": "optional-caller-name"
}
```

## Inline Testing

You can also test without creating a file:

```bash
npm run test-tool -- --inline '{"toolName":"readFile","args":{"filePath":"package.json","reason":"test"}}'
```
