# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **readMarkdownFile: Simplify Path Security Validation** (2025-10-20)
    - 🔧 Simplified path security validation in `readMarkdownFile` tool to support cross-project file access
    - **Change**: Absolute paths are now allowed to access files outside baseDir boundary
    - **Rationale**: Align with other 18+ file tools (readTextFile, executeMarkdownEdits, etc.) that already support absolute paths
    - **Code Cleanup**: 
        - Removed redundant baseDir boundary check (dead code after absolute path early return)
        - Removed redundant `path.relative()` check (dead code after `..` check, since normalized paths without `..` cannot escape baseDir)
        - Simplified from 30 lines to 20 lines (~33% reduction)
    - **Security**: Directory traversal protection (`..` in relative paths) remains enforced ✅
    - **Logic**: 1) Absolute paths → accept, 2) Relative paths with `..` → reject, 3) Other relative paths → resolve and accept
    - **Impact**: AI specialists can now read markdown files from other projects when given explicit absolute paths
    - **Use Case**: Enable cross-project document analysis and reference during UAT
    - **Testing**: 22/23 path-related tests passing (1 pre-existing failure unrelated to this change)
    - Files modified: `src/tools/document/enhanced-readfile-tools.ts` (PathValidator.validatePath method, lines 443-469)

### Fixed

- **KNOWLEDGE_QA Mode: Tool Calls Execution Priority Fix** (2025-10-19)
    - 🐛 Fixed critical issue where tool calls were ignored when AI returned both `direct_response` and `tool_calls` in KNOWLEDGE_QA mode
    - **Root Cause**: Incorrect if-else priority in `srsAgentEngine.ts` (lines 620-671) caused early return when `direct_response` was present, preventing tool execution
    - **Solution**: Adjusted logic priority to check `tool_calls` first, supporting "respond + search" interaction pattern
    - **Behavior Changes**:
      - Before: When both present → show response, ignore tools ❌
      - After: When both present → show response + search indicator, execute tools ✅
    - **Impact**: Enables Gate 2 (Proactive Domain Modeling Rule) in orchestrator.md to work correctly
    - **Testing**:
      - Added comprehensive unit tests: `src/test/unit/knowledge-qa-tool-execution.test.ts` (5 test scenarios)
      - Created standalone functional test: `dev-tools/test-knowledge-qa-fix.js` (all checks passed ✅)
      - Regression test: Build successful with no new errors
    - **New User Experience**: AI can now provide immediate feedback while simultaneously searching for more information
    - Files modified: `src/core/srsAgentEngine.ts` (lines 620-671)

- **Orchestrator Prompt: Enhanced Workspace Context with Project Files Display** (2025-10-16)
    - 🔧 Improved workspace context information in orchestrator prompt by restructuring Base Status and Project Status sections
    - **Base Status Changes**:
      - Renamed: `Base Directory` → `Workspace Absolute Path` (now displays workspace root instead of project base dir)
      - Provides clearer distinction between workspace and project contexts
    - **Project Status Enhancements**:
      - Renamed: `Base Directory` → `Project Directory (Absolute Path)` (value unchanged)
      - Added: `Project Files (Relative to baseDir)` section listing all project files and directories
      - Implementation reuses specialist environment sensing logic from PromptAssemblyEngine
      - Sorting: directories first (alphabetically), then files (alphabetically)
      - Filters: excludes hidden files (starting with .) and node_modules directory
    - **Error Handling**:
      - Gracefully handles missing/inaccessible directories
      - Returns informative messages: "No files found" or "Unable to list files"
    - Test coverage:
      - Added 20 comprehensive tests covering integration and functional scenarios
      - Tests verify: format correctness, sorting order, edge cases, special characters in paths, large projects
      - All tests passing ✅
    - Files modified: `src/core/orchestrator/PromptManager.ts` (+110 lines)

- **Environment Sensing: Remove Invalid CurrentDirectory Concept** (2025-10-16)
    - 🐛 Fixed issue where environment sensing was listing system root directories (/Applications, /System, etc.) in AI prompts
    - Root cause: VSCode has no concept of "current directory", but the code was using `process.cwd()` which pointed to arbitrary system locations
    - Solution: Removed `currentDirectory` and `currentDirectoryFiles` fields from `EnvironmentContext`
    - Impact: AI prompts now only show project files from `baseDir`, no longer showing irrelevant system directories
    - Test updates: All environment sensing tests (unit, integration, functional, regression) updated to reflect the new behavior
    - Related: `PromptAssemblyEngine.ts`, all `PromptAssemblyEngine-EnvironmentSensing` test files

- **Specialist思考记录管理** (2025-10-08)
    - 🐛 修复specialist在恢复模式下错误清空思考记录的问题
    - 现在specialist恢复执行时会保留之前的思考记录，提升AI工作连续性
    - 详细分析：`thoughtRecord-fix-report.md`

- **askQuestion多次用户交互支持** (2025-10-08) - ✅ **已修复（方案2）+ 三个后续Bug修复**
    - 🐛 修复specialist恢复后多次调用askQuestion时的状态管理问题
    - **方案2修复**（统一返回值类型）：
      - 改用明确的`intent`机制替代boolean返回值，消除语义歧义
      - 修复resumeContext的对象合并逻辑，强制保留planExecutorState
      - `resumePlanExecutorWithUserResponse`返回`{intent, result, metadata}`
      - `handleUserResponse`使用清晰的intent分支处理
      - ✅ **实际验证成功**：SuperDesign流程完整执行，不再出现"旧格式"错误
    - **三个后续Bug修复**（2025-10-08）：
      1. **iteration计数不增加** - 将iteration++移到所有return之前，确保每完成一次AI调用就递增
      2. **recordThought丢失** - ThoughtRecordManager改为单例，确保思考记录在多次恢复中保持
      3. **等待提示缺失** - 在两处添加明确的"⏸️ 等待您的回复..."提示
    - **核心原理**（与用户达成共识）：
      - 一次循环 = 组装提示词 → AI响应 → 执行工具 → 收集结果
      - AI是无状态的，每次都需要完整提示词
      - 每完成一次循环就应该iteration++
      - askQuestion、taskComplete等工具不应该被特殊对待
    - **测试验证**：
      - ✅ 编译成功，零TypeScript错误
      - ✅ 所有ThoughtRecord测试通过（10个单元+4个集成）
      - ✅ solution2完整流程测试通过（6个测试）
      - ✅ specialistExecutor回归测试通过（26个测试）
      - ⚠️ **需要实际场景验证**：请在真实环境测试prototype_designer的SuperDesign流程
    - **影响范围**：所有specialist，特别是需要多次用户交互的specialist
    - **参考文档**：`design/askQuestionToolRefactor/` - 完整的分析、设计和修复记录

### Technical Debt

- **用户交互处理架构债务**
    - 识别出两条不一致的用户交互处理路径（executeIteration vs resumePlanExecutorWithUserResponse）
    - 规划了阶段式重构方案：短期快速修复 → 中期统一返回值 → 长期提取UserInteractionManager
    - 参考文档：`design/askQuestionToolRefactor/`

### Fixed
- **Critical: Fixed newline character loss in executeMarkdownEdits tool** - When performing multiple consecutive edits without explicit newline characters at the end of content, the tool would "eat" the trailing newline, causing subsequent lines to be incorrectly joined together. This issue would compound with each edit, eventually merging completely separate content sections.
  - Root cause: The WorkspaceEdit.replace() method was using `Position(line, lineLength)` which includes the implicit newline character in the range, causing it to be replaced/removed.
  - Solution: Added automatic newline character handling in the `applyIntent` method of `SmartIntentExecutor`. The fix ensures that:
    - Non-empty content without trailing newline gets `\n` added (idempotent)
    - Content with existing newline is left unchanged
    - Empty content is not modified
    - Works correctly with multi-line content, Unicode characters, and special cases
  - Impact: All replace and insert operations now maintain proper line structure across multiple sequential edits

### Added
- Comprehensive unit tests for newline handling in `applyIntent` method with 14 test cases covering:
  - Basic newline addition/preservation
  - Edge cases (Windows CRLF, empty content, whitespace-only content)
  - Unicode and multi-byte characters
  - Code blocks and special formatting
  - Multiple sequential processing stability
  - Simulated real-world editing scenarios

### Changed
- Modified `SmartIntentExecutor.applyIntent()` method to add intelligent newline handling for all content before applying edits

## [0.5.2] - 2025-09-12

### Added

- **SRS Reviewer Specialist**: New requirements document quality review expert
    - **7-Dimensional Quality Assessment Model**: Document structure completeness, requirements completeness, requirements consistency, requirements clarity, technical feasibility, business value, and AI generation quality
    - **Professional Scoring Standards**: 0-10 point scoring system based on IEEE 830 standards
    - **Structured Review Reports**: Automatically generates detailed review reports with specific improvement suggestions and itemized scores
    - **AI Content Professional Assessment**: Specialized detection for AI-generated content issues (hallucination, over-idealization, domain adaptation)
    - **Dynamic Specialist Registration**: Supports specialist_config configuration format for configurable expert registration mechanism

- **Path Resolver Enhancement**: New intelligent path resolution tool
    - **Existence Checking**: Automatically validates file and directory path validity
    - **Smart Path Resolution**: Supports intelligent conversion between relative and absolute paths
    - **Error Handling Optimization**: Provides detailed path resolution error messages and suggestions

### Enhanced

- **Semantic Edit Engine**: Core functionality optimization
    - **SID Location Precision Improvement**: Enhanced SID-based semantic location algorithms
    - **Hierarchical SID Support**: Improved semantic location capabilities for complex document structures
    - **Relative Line Number Calculation**: Optimized relative line number calculation logic
    - **Endpoint Line Calculation**: Improved accuracy of edit range endpoint calculations

- **File System Tools**: Feature expansion
    - **readTextFile Tool Enhancement**: Improved reliability and error handling for text file reading
    - **Path Resolution Integration**: Integrated new path resolver to enhance file operation stability
    - **Existence Validation**: Added pre-check mechanism for file and directory existence

- **YAML Editor**: Stability improvements
    - **Error Handling Optimization**: Improved error handling mechanisms during YAML file editing
    - **Data Validation Enhancement**: Strengthened validation logic for YAML data structures
    - **Read/Write Operation Stability**: Enhanced reliability of YAML file read/write operations

### Fixed

- **Semantic Edit Tools**: Multiple bug fixes
    - **SID Location Errors**: Fixed SID location inaccuracy issues in certain scenarios
    - **Line Number Calculation Errors**: Fixed boundary condition errors in relative line number calculations
    - **Edit Range Issues**: Fixed precision problems in semantic edit range calculations

## [0.5.1] - 2025-09-08

### Enhanced

- **Traceability Completion Tool**: Major functionality enhancements
    - **ID Consistency Validation Integration**: Automatically validates SRS-YAML ID consistency before executing traceability relationship calculations
    - **Unified Quality Reports**: Replaces original summary logs with standardized quality report files
    - **Enhanced Error Handling**: Continues with subsequent processing even when ID inconsistency issues are found
    - **Performance Optimization**: Improved execution time statistics and report generation mechanisms
    - **More Detailed Logging**: Enhanced debugging information and execution status tracking

- **Session Manager**: Core architecture optimization
    - Added 262 lines of code, significantly enhancing session handling capabilities
    - Improved project switching and session synchronization mechanisms
    - Enhanced error recovery and state consistency checking
    - Optimized session lifecycle management

### Fixed

- **Session Switching Stability**: Fixed multiple issues in the session switching process
    - Resolved state synchronization problems during project switching
    - Improved session observer notification mechanisms
    - Enhanced session recovery reliability

## [0.5.0] - 2025-09-05

### Added

- **Folders View Enhancer**: New Git branch switching capability in VS Code Explorer
    - Added Git branch selection directly from Explorer title bar
    - Real-time branch switching with automatic workspace update
    - Smart handling of uncommitted changes with user confirmation
    - Integration with project session synchronization for SRS branches

- **Session Log Service**: Unified session logging system
    - Centralized logging service for all specialist and tool executions
    - Comprehensive task completion tracking with execution times
    - Tool execution context recording with success/failure status
    - Project-specific session log files (`srs-writer-session_{{projectName}}.json`)
    - Error isolation ensuring log failures don't impact main workflows

- **Session Path Manager**: Enhanced session file management
    - Intelligent session file path resolution and management
    - Support for both workspace-relative and global session storage
    - Automatic directory creation and file organization
    - Improved error handling for session file operations

### Enhanced

- **Session Management System**: Major architecture refactor
    - **v5.0 Architecture**: Unified hybrid storage with event sourcing
    - **Observer Pattern**: Automatic notification system for all dependent components
    - **Singleton Pattern**: Global unique instance eliminating multi-head management issues
    - **Sync Status Checking**: Automatic data consistency detection and repair
    - **Mixed Storage**: Dual storage system (currentSession + operations) for fast recovery and complete audit trails
    - **Event Sourcing**: All operations are type-safe recorded for complete operation history tracking

- **Project Management**: Improved project switching and session handling
    - Enhanced project initialization with comprehensive Git integration
    - Simplified new session creation workflow (`startNewSession` method)
    - Improved project scanning with real project names from log files
    - Better error handling and recovery mechanisms for failed operations

- **Git Integration**: Advanced Git branch management
    - Enhanced Git operations with better error handling and retry logic
    - Automatic WIP (work-in-progress) branch creation and switching
    - Smart Git status detection and change management
    - Improved branch creation and switching workflows

### Fixed

- **Session State Consistency**: Resolved session synchronization issues
    - Fixed session context switching problems during project changes
    - Resolved file system race conditions in session management
    - Improved session observer notification reliability
    - Fixed session archiving and cleanup processes

- **Error Handling**: Enhanced error recovery and logging
    - Better error messages and user feedback for failed operations
    - Improved error isolation preventing cascading failures
    - Enhanced debugging capabilities with detailed operation logs
    - Fixed edge cases in Git operations and file system interactions

## [0.4.7] - 2025-08-29

### Added

- **Git Integration**: Comprehensive Git branch management for projects
    - Automatic Git branch creation (`SRS/ProjectName`) when creating new projects via `createNewProjectFolder`
    - Intelligent Git status detection with proper handling of staged/unstaged changes
    - Auto-commit functionality for staged changes before branch creation
    - Git branch information persistence in `SessionContext` and `srs-writer-log.json`

- **Workspace Initialization**: Enhanced "Create Workspace & Initialize" feature
    - Automatic Git repository initialization with `main` branch
    - Smart `.gitignore` file creation excluding templates and temporary files
    - Initial commit creation with "init commit" message
    - Graceful error handling with user-friendly fallback instructions

- **Project Switching**: Git branch switching integration
    - Unified project information system reading from `srs-writer-log.json`
    - Automatic Git branch switching when switching projects
    - Enhanced project scanning with real project names from log files
    - Git branch status display in project switch success messages

## [0.4.6] - 2025-08-28

### Fixed

- **Critical**: Fixed the issue where excessively long source documents that exceeded the context window caused the specialist to fall into an infinite loop during the iteration process.

## [0.4.5] - 2025-08-28

### Added

- **New Feature**: Support for .poml specialist rule files
    - Added comprehensive support for `.poml` file format alongside existing `.md` files
    - Implemented priority system: `.poml` files take precedence over `.md` files when both exist
    - Maintains full backward compatibility with existing `.md` specialist files

### Enhanced

- **UI Improvement**: Updated status bar icon from `$(notebook-kernel)` to `$(edit)` for better visual representation
- **Build System**: Enhanced specialist configuration build process to handle multiple file formats
- **Validation**: Improved specialist validation scripts with dynamic file scanning instead of hardcoded lists
- **Architecture**: Centralized file extension logic for consistent handling across the entire system

## [0.4.4] - 2025-08-15

### Enhanced

- **Critical**: Advanced Token Limit and Empty Response Recovery System
    - Implemented intelligent retry mechanism for token limit errors with automatic prompt optimization
    - Added unified retry strategy for both "Message exceeds token limit" and empty AI responses (3 retries each)
    - Enhanced specialist execution with smart history cleanup during retries - removes "迭代 X - 结果" entries to reduce token usage
    - Automatic warning injection at history top: "Warning!!! Your previous tool call cause message exceeds token limit, please find different way to perform task successfully."
    - Token limit errors now trigger prompt re-optimization and regeneration during retries
    - Empty response handling now follows same intelligent retry pattern as token limit errors
    - Retry attempts are independent of specialist iteration limits and reset after successful tool execution

## [0.4.3] - 2025-08-15

### Fixed

- **Critical**: Enhanced network error retry mechanism for VSCode LLM API calls
    - Added automatic retry logic for network-related errors (net::ERR_NETWORK_CHANGED, connection failures, etc.)
    - Implemented exponential backoff strategy with 3 retries for network errors and 1 retry for server errors
    - Fixed issue where network interruptions during AI response stream processing would cause immediate plan failure
    - Retry attempts no longer consume specialist iteration limits, ensuring consistent execution behavior
    - Enhanced error classification to identify retryable vs. non-retryable errors automatically
    - Improved error messages with retry status information for better user feedback

### Enhanced

- **Robustness**: Specialist execution resilience improvements
    - Network errors are now gracefully handled without terminating entire plan execution
    - Enhanced error handling covers both initial request sending and response stream processing phases
    - Added comprehensive debugging logs for UAT phase validation (to be cleaned post-UAT)
    - Improved system stability during network connectivity fluctuations

## [0.4.0] - 2025-08-14

### Added

- **New Feature**: Plugin Settings quick access in Control Panel
    - Added "Plugin Settings" option to SRS Writer Control Panel
    - One-click access to plugin configuration from status bar
    - Direct navigation to plugin settings without manual search
    - Supports multiple fallback mechanisms for maximum compatibility

### Enhanced

- **Project Switching**: Improved project switch experience with plan interruption
    - Added intelligent plan execution detection during project switching
    - Implemented user confirmation dialog when switching with active plans
    - Added graceful plan cancellation at specialist loop level for immediate termination
    - Enhanced progress bar with real-time synchronization of plan termination status
    - Comprehensive context cleanup to prevent cross-project data contamination

- **User Experience**: Streamlined interface interactions
    - Removed redundant status bar tooltip to eliminate "flashing" popups during project switching
    - Optimized status bar updates from polling-based to event-driven for better performance
    - Eliminated unnecessary confirmation dialogs in settings access for smoother workflow
    - Improved visual feedback during project switching operations

### Technical Improvements

- **Architecture**: Enhanced global engine framework integration
    - Strengthened cancellation mechanism propagation through execution chain
    - Improved specialist-level execution control with callback-based cancellation
    - Added comprehensive project context lifecycle management
    - Enhanced session observer pattern for real-time status updates

## [0.3.4] - 2025-08-13

### Added

- **New Feature**: "Exit Current Project" option in project switching interface
    - Allows users to exit current project and return to clean plugin state
    - Soft restart functionality using VSCode window reload
    - Comprehensive project archiving before restart
    - Progress indicators for user feedback during restart process

### Enhanced

- **UI/UX Improvements**: Complete English interface support
    - Renamed "状态管理" to "Control Panel" for better functionality representation
    - Converted all interface text to English for international users
    - Updated quickpick placeholders and descriptions to English
    - Improved user experience for American and international users

- **Documentation Structure**: SRS Table of Contents integration in prompts
    - Added SRS ToC (Table of Contents) loading functionality using `readMarkdownFile` tool
    - Integrated ToC into 9-part prompt structure (previously 8-part)
    - Enhanced `PromptAssemblyEngine` with `loadProjectSRSContent` method using ToC mode
    - Implemented stable SID generation for consistent `executeSemanticEdits` operations
    - Added `SRS_TOC` and `CURRENT_SRS_TOC` context variables for specialist prompts

### Fixed

- **Stability**: SID generation consistency verification
    - Validated SID stability across multiple document parses
    - Ensured consistent SID generation for duplicate titles using hash-based disambiguation
    - Verified compatibility with `executeSemanticEdits` tool requirements

## [0.3.0] - 2025-08-10

### Fixed

- **Critical**: Fixed `executeMarkdownEdits` section heading inclusion issue - AI can now precisely control whether to edit titles or content
- **Critical**: Fixed absolute vs relative line number mismatch - now uses absolute line numbers for intuitive "what you see is what you get" editing
- **Breaking**: Made `endLine` parameter required for `replace_lines_in_section` operations to eliminate ambiguity
- Enhanced error handling in `executeMarkdownEdits` - specific error messages now properly propagate to AI agents
- Fixed `internalHistory` displaying generic "unknown error" instead of specific failure reasons
- Resolved negative line numbers bug in SID mapping that made the tool unusable

### Enhanced

- **Major**: Redesigned `readMarkdownFile` output structure:
    - Removed redundant `utf8` and `codepoint` fields from `TextOffset`
    - Updated `offset.utf16` to provide section ranges instead of just title position
    - Added `endLine` field to `TableOfContentsTreeNode` for better section boundary information
- Improved `executeMarkdownEdits` tool definition with clearer absolute line number documentation
- Enhanced validation logic to provide better error messages and section boundary hints
- Removed deprecated `sectionTitle` fuzzy matching - now enforces strict SID-based targeting

### Performance

- Simplified line number calculation logic removing complex relative-to-absolute conversions
- Enhanced caching mechanisms in semantic editing pipeline
- Optimized AST processing for better document parsing performance

### Developer Experience

- Updated all tool definitions with clearer parameter descriptions
- Enhanced debug logging for better troubleshooting
- Improved TypeScript type safety across semantic editing interfaces
- Added comprehensive test coverage for new line number handling

### Removed

- Document conversion functionality (markitdown integration) - moved to separate office-to-markdown plugin
- All Word/PPT to Markdown conversion tools and components
- Document format conversion commands from status menu
- Deprecated `sectionTitle` parameter from `readMarkdownFile` tool

## [0.2.2] - 2025-08-05

### Fixed

- Completely rollback Project Initializer Specialist rules to fix AI illusion issue
- Fixed CHANGELOG.md not being included in published package (added to package.json files field)

## [0.2.1] - 2025-08-04

### Fixed

- Fixed VSCode marketplace CHANGELOG page display issue by adding CHANGELOG.md file
- Improved specialist rule definitions for better AI agent performance

### Changed

- Updated orchestrator rules for enhanced workflow coordination
- Refined specialist templates for business requirements and rule writer
- Enhanced summary writer specialist guidelines
- Improved use case writer and user journey writer specifications
- Updated user story writer rules for better story generation

### Documentation

- Added comprehensive CHANGELOG.md following Keep a Changelog standards
- Improved documentation structure for marketplace display

## [0.2.0] - 2025-08-04

### Added

- AI-powered Software Requirements Specification writer for VSCode
- Chat participant integration with natural language understanding
- Multiple specialist writers for different document sections:
    - ADC (Assumptions, Dependencies, Constraints) Writer
    - Business Requirements and Rule Writer
    - Functional Requirements Writer
    - Interface and Data Requirement Writer
    - Non-Functional Requirements Writer
    - Overall Description Writer
    - Prototype Designer
    - Summary Writer
    - Use Case Writer
    - User Journey Writer
    - User Story Writer
- Intelligent orchestrator system for coordinating specialists
- Template-based document generation
- Quality checking and linting capabilities
- Enterprise RAG knowledge base integration support
- Local knowledge search functionality
- Internet search integration for real-time information
- Project switching and management features
- Semantic editing and document manipulation tools

### Infrastructure

- TypeScript-based extension architecture
- Webpack build system
- Comprehensive testing suite with integration tests
- GitHub repository setup with proper licensing
- VSCode marketplace publishing configuration
