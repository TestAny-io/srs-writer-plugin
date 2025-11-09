# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2025-11-09

### Added

- **Diff View**: Added new diff view functionality for better visualization of document changes
    - Real-time comparison of document versions
    - Enhanced change tracking and review capabilities
    - Improved user experience for content verification

### Enhanced

- **Document Templates**: Comprehensive template improvements
    - Refined all document templates for better consistency
    - Enhanced template structure and formatting
    - Improved template documentation and usability

- **Specialist Rules**: Optimized specialist rules and guidelines
    - Refined orchestrator and specialist prompt templates
    - Improved AI agent behavior and response quality
    - Enhanced specialist execution efficiency

### Removed

- **Slash Commands**: Removed slash command functionality
    - Streamlined command interface
    - Simplified user interaction model
    - Reduced complexity in command handling

### Maintenance

- **Code Cleanup**: Removed unused code and dependencies
    - Improved codebase maintainability
    - Reduced bundle size
    - Enhanced performance

## [0.7.3] - 2025-11-08

### Added

- **Project Name Modification**: Added ability to rename projects via Project Management in Control Panel
    - Users can now change project names after creation
    - Accessible through Control Panel's Project Management menu
    - Improved project organization and flexibility

### Enhanced

- **Error Messages**: Improved clarity of `executeTextFileEdits` tool error messages
    - More descriptive error feedback for file editing operations
    - Better debugging experience for users and AI agents

### Removed

- **UI Simplification**: Removed "Create Project" command from Control Panel
    - Streamlined Control Panel interface
    - Reduced UI clutter for better user experience

### Fixed

- **Status Check Consistency**: Fixed status check inconsistency defect
    - Resolved synchronization issues in status checking mechanism
    - Improved system state reliability

## [0.7.1] - 2025-11-04

### Enhanced

- **Token Efficiency**: Optimized readYAMLFile tool output to reduce token consumption
    - Refactored output format for better conciseness
    - Improved YAML data structure representation
    - Enhanced performance for large YAML files

- **Documentation**: Updated README.md with new features and improved clarity
    - Added new sections for first-time setup and usage instructions
    - Improved overall documentation structure and readability
    - Added troubleshooting tips for common issues

## [0.7.0] - 2025-11-02

### Added

- **🔌 MCP (Model Context Protocol) Support** - SRS Writer now supports MCP tools!
    - **Dynamic Tool Registration**: Automatically discover and register tools from MCP servers
    - **Real Schema Query**: Query full tool schema (`inputSchema`) from MCP servers instead of generic parameters
    - **Three-tier Permission Control Architecture**:
        - Tier 1 (Global Default): All AI can access all MCP tools (user-friendly)
        - Tier 2 (Server-level): Configure in `permissions.default` of `mcp.json`
        - Tier 3 (Tool-level): Fine-grained control in `permissions.tools[toolName]` of `mcp.json`
    - **Multiple Configuration Sources Support**:
        - Workspace-level: `.vscode/mcp.json`
        - User-level: `~/Library/Application Support/Code/User/mcp.json` (macOS)
    - **Hot Reload**: Automatically reload tools when config file changes (1-second debounce)
    - **Platform Compatibility**: Supports macOS, Linux, Windows

## [0.6.1] - 2025-10-31

### Added

- **Improvement 1: Display Execution Plan** - Enhanced transparency for SRS Agent Workflow
    - Execution plan is now displayed in chat window before specialist execution starts
    - Shows complete task plan with step-by-step breakdown
    - Helps users understand what the system will do

- **Improvement 2: Full Transparency Tool Display + recordThought Content Display in specialist execution** - Real-time tool execution visibility
    - ALL tool executions are now displayed in specialist execution process
    - Each tool shows: success/failure status, tool name, and key parameters with smart parameter display rules

## [0.6.0] - 2025-10-29

### Added

- **New Specialist**: Prototype Designer (MVP)
    - Added new content specialist for rapid prototype design.
    - This specialist is responsible for creating a prototype from scratch based on user requirements.
    - It will add a new chapter to the SRS document called "Prototype Design".
    - It will generate prototype files in the prototype directory including index.html, theme.css, interactions.js.

### Enhanced

- **Context Window Optimization**: Significantly reduced context window usage
    - Optimized output format for 4 edit tools to reduce token consumption
    - Improved specialist prompt assembly engine efficiency
    - Added comprehensive tests for specialist prompt refactoring
- **Specialist Context Structure**: Improved organization and format
    - Reorganized specialist context sections for better clarity
    - Removed redundant sub-sections in context
    - Refined format for better readability and LLM comprehension

## [0.5.7] - 2025-10-28

### Fixed

- **Critical**: Fixed Turn 1 content missing in orchestrator's context
    - First turn conversation content is now properly recorded and included in context
    - Ensures orchestrator has complete conversation history from the start
- **Critical**: Fixed turn numbering inconsistency between conversation history and tool call history
    - Synchronized turn numbers across all history tracking components
    - Improved context coherence and debugging capability
- **Enhancement**: Removed unnecessary truncation in orchestrator's context
    - Optimized context management for better information retention
    - Improved orchestrator decision-making with fuller context
- **Enhancement**: Fixed direct_response behavior
    - Corrected response handling logic for direct orchestrator responses
    - Improved conversation flow consistency
- **Enhancement**: Added Turn information to tool execution history in orchestrator context
    - Enhanced traceability of tool executions across conversation turns
    - Better correlation between user requests and tool invocations

## [0.5.6] - 2025-10-26

### Fixed

- **Critical**: Fixed title deletion bug in `replace_section_content_only` operations
- **Critical**: Fixed blank line bug in delete operations
- **Enhancement**: SID generation stability improvements
    - Fixed special characters handling in SID generation
    - Enhanced SID generation contract with better Unicode support
    - Improved consistency across multiple document parses

### Enhanced

- **Content Matching System**: New intelligent content matching module
    - Advanced fuzzy matching with configurable similarity thresholds
    - Multi-line content matching with precise position detection
    - Smart whitespace handling for indented content

- **Iterative History Format**: Optimized specialist execution history
    - More compact and readable iteration logs
    - Better performance for long-running specialist executions
    - Enhanced debugging information

## [0.5.5] - 2025-10-25

### Added

- **MCP (Model Context Protocol) Integration**: Full MCP client support for extensible tool ecosystem
    - **MCP Client**: Core client implementation for connecting to MCP servers
    - **MCP Registry**: Centralized registry for managing MCP server connections and tool registrations
    - **MCP Tool Invoker**: Unified interface for invoking MCP-provided tools
    - **Type Safety**: Complete TypeScript type definitions for MCP protocol
    - **Error Handling**: Robust error handling and connection management

- **Internet Search Tool Refactor**: Complete redesign with multi-provider and multi-strategy architecture
    - **Multiple Strategies**:
        - Direct API Strategy: Direct integration with search provider APIs
        - Guidance Strategy: AI-guided search with intelligent query refinement
        - MCP Strategy: Delegated search through MCP protocol
    - **Multiple Providers**:
        - Tavily AI Search (recommended for international users)
        - Bing Search (Azure Cognitive Services)
        - Baidu Search (recommended for Chinese users)
    - **Search Cache**: Intelligent caching mechanism to reduce API calls and improve performance
    - **Configuration Management**: Centralized API key and provider configuration
    - **Comprehensive Testing**: Unit tests and integration tests for all strategies and providers

- **findInFiles Tool**: New powerful file search capability across workspace
    - **Pattern Matching**: Support for regex and plain text search patterns
    - **File Scanning**: Efficient workspace file scanning with configurable filters
    - **Result Formatting**: Structured search results with file paths, line numbers, and context
    - **Error Handling**: Graceful error handling with detailed error messages
    - **Modular Architecture**: Clean separation of concerns (Scanner, Matcher, Formatter, Engine)

- **Text File Editor Tools**: New direct text file editing capabilities
    - Complements existing semantic editing tools with traditional line-based editing
    - Support for reading, writing, and modifying plain text files
    - Enhanced error handling and validation

### Enhanced

- **Semantic Edit Engine**: Major capability expansion
    - **Delete Operations**: New delete operation type for `executeMarkdownEdits` tool
    - **Section Deletion**: Support for deleting entire sections or content within sections
    - **Smart Deletion**: Intelligent handling of section boundaries and nested content
    - **Validation Enhancement**: Improved validation for delete operations with clear error messages

- **Orchestrator**: Significant refactor and enhancement
    - Improved prompt management and assembly
    - Enhanced tool access control mechanisms
    - Better workspace context integration
    - Optimized plan generation and execution logic

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
