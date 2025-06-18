# SRS Writer Plugin for VSCode

AI-powered Software Requirements Specification writer for VSCode

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Yarn package manager
- VSCode 1.85.0+

### Development Setup

```bash
# Install dependencies
yarn install

# Start development mode
yarn dev

# Build for production
yarn build:prod

# Run tests
yarn test

# Lint code
yarn lint

# Auto-fix lint issues
yarn lint:fix
```

### VSCode Extension Development

```bash
# Launch Extension Development Host
# Press F5 in VSCode or use the debug configuration
```

## 📁 Project Structure

```
srs-writer-plugin/
├── src/
│   ├── extension.ts              # Plugin entry point
│   ├── chat/                     # Chat participant logic
│   ├── core/                     # AI communication & prompt management
│   ├── parser/                   # SRS document parsing
│   ├── filesystem/               # File system operations
│   ├── types/                    # TypeScript interfaces
│   ├── constants/                # Application constants
│   └── utils/                    # Utilities (logger, error handler)
├── rules/                        # AI prompt rules
├── templates/                    # SRS document templates
└── dist/                         # Built files
```

## 🏗️ Architecture

The plugin follows a two-phase architecture:

1. **AI Generation Phase**: Uses VSCode's Language Model API to generate a structured "mother document"
2. **Code Processing Phase**: Deterministic parsing of the mother document into multiple files

### Core Components

- **PluginCore**: Main orchestrator and VSCode extension entry point
- **AICommunicator**: Handles all AI interactions via VSCode LM API
- **SRSParser**: Parses mother documents into structured file sets
- **FileSystemManager**: Manages local file system operations

## 🔧 Configuration

The plugin uses VSCode's built-in Language Model API. Ensure you have:
- GitHub Copilot or another supported AI provider configured
- Proper VSCode chat participant permissions

## 📝 Usage

1. Open VSCode with a project folder
2. Open the Chat panel
3. Type `@srs-writer` followed by your requirements
4. Example: `@srs-writer Create an SRS for a task management system`

The plugin will generate a complete SRS document set including:
- `SRS.md` - Main requirements document
- `fr.yaml` - Functional requirements
- `nfr.yaml` - Non-functional requirements
- `glossary.yaml` - Terms and definitions
- Additional supporting files

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run performance tests
yarn test -- --testPathPattern=performance
```

## 🔍 Debugging

1. Open the project in VSCode
2. Press `F5` to launch Extension Development Host
3. In the new VSCode window, use the plugin
4. Check logs in the original VSCode Output panel

## 📦 Building

```bash
# Development build
yarn build

# Production build (optimized)
yarn build:prod

# Clean build artifacts
yarn clean
```

## 🚀 Deployment

```bash
# Package extension
vsce package

# This will create a .vsix file for distribution
```

## 🛠️ Technology Stack

- **TypeScript**: Main development language
- **VSCode Extension API**: Platform integration
- **VSCode Language Model API**: AI interactions
- **marked.js**: Markdown parsing
- **js-yaml**: YAML generation
- **Webpack**: Module bundling
- **Jest**: Testing framework
- **ESLint**: Code linting

## 📋 Development Workflow

1. **Week 1**: Core framework and Chat Participant setup
2. **Week 2**: SRS Parser implementation and file generation
3. **Week 3**: Testing, optimization, and polish

## 🐛 Troubleshooting

### Common Issues

**Chat Participant not appearing**:
- Ensure VSCode version 1.85.0+
- Check that the extension is properly activated
- Verify chat participant registration in extension.ts

**AI not responding**:
- Verify AI provider (GitHub Copilot) is configured
- Check VSCode Language Model API access
- Review Output panel for error messages

**Build failures**:
- Run `yarn clean` then `yarn install`
- Check Node.js version (18+ required)
- Verify all dependencies are installed

## 📚 Documentation

- [Technical Architecture](docs/architecture.md) (Coming soon)
- [API Reference](docs/api.md) (Coming soon)
- [Contributing Guide](docs/contributing.md) (Coming soon)

## 📄 License

MIT License - see LICENSE file for details

## 👥 Team

- **Architecture**: Goodspeed
- **Product Management**: Stephan  
- **Development Lead**: Chris
- **AI Development**: Claude-4-Sonnet
- **Code Review**: Gemini 2.5 Pro

---

**Built with ❤️ for the developer community**
