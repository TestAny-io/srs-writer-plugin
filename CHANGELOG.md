# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2025-08-13

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
