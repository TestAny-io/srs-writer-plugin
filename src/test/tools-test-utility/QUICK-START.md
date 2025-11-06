# Tool Test Utility - Quick Start

## 30-Second Start

```bash
# 1. Compile project
npm run compile

# 2. Create a test CSS file
echo "body { color: red; }" > test-file.css

# 3. Run example test
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-empty-oldstring.json
```

## Common Commands

```bash
# Test executeTextFileEdits with empty oldString error
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-empty-oldstring.json

# Test multiple edit failures
npm run test-tool -- src/test/tools-test-utility/examples/test-text-file-edit-text-not-found.json

# Test readFile
npm run test-tool -- src/test/tools-test-utility/examples/test-read-file.json

# Inline test (no file needed)
npm run test-tool -- --inline '{"toolName":"readFile","args":{"filePath":"package.json","reason":"quick test"}}'
```

## Create Your Own Test

1. Create JSON file:
```json
{
  "toolName": "yourToolName",
  "args": {
    "arg1": "value1",
    "arg2": "value2"
  }
}
```

2. Run it:
```bash
npm run test-tool -- your-test.json
```

## What You'll See

- ✅ Success: Green checkmarks and "Tool executed successfully"
- ❌ Failure: Red X's with detailed error messages
- 📊 Details: Full JSON output of tool execution
- 🎯 Error Message: Highlighted section showing what AI sees

## More Info

See `scripts/README.md` for full documentation.
