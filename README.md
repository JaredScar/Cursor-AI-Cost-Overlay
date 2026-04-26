# Cursor AI Cost Overlay

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A VS Code/Cursor extension that brings real-time AI model pricing directly into your editor. Make informed decisions about which AI model to use based on cost, context window, and value.

![AI Cost Overlay panel showing model pricing sorted by cost, with GPT-5.4 Nano highlighted as best value](media/screenshot.png)

## Overview

When using AI coding assistants like Cursor, it's easy to lose track of how much different models cost. GPT-4.1 might be overkill for a simple task, while a cheaper model could handle it just as well. **AI Cost Overlay** solves this by showing you real-time pricing information right in your editor sidebar.

### Key Benefits

- **Cost Awareness**: See exactly how much each model costs per 1M tokens
- **Smart Recommendations**: Quickly identify the best value models
- **Context Window Info**: Know the token limits before you start
- **Seamless Integration**: Works within your existing workflow

## Features

- **Real-time Pricing**: Fetches live model pricing from LiteLLM's comprehensive registry with configurable refresh intervals (12h, 24h, 48h, or 72h)
- **Smart Recommendations**: Highlights best-value models based on price-per-token and context window size
- **Cursor Integration**: Click any model to open the model picker and copy the model name for easy selection
- **Customizable Display**: Toggle between daily, weekly, and monthly cost perspectives
- **Offline Support**: Cached pricing data ensures the extension works even without internet
- **Auto-refresh**: Optional automatic pricing updates on startup

## Installation

### From VSIX (Recommended for Cursor)

1. Download `cursor-ai-cost-overlay-1.0.0.vsix` from the [releases page](../../releases)
2. In Cursor/VS Code, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Reload the window when prompted

### From Source

```bash
git clone https://github.com/cursor-ai-cost-overlay/cursor-ai-cost-overlay.git
cd cursor-ai-cost-overlay
npm install
npm run build
npx vsce package --no-yarn
# Install the generated .vsix file
```

## Usage

### Opening the Panel

Click the **dollar sign ($) icon** in the left sidebar (Activity Bar) to open the AI Cost Overlay panel.

### Understanding the Display

The panel shows all available AI models with:

- **Model Name**: Human-readable name (e.g., "GPT-4.1 Nano")
- **Cost**: Input and output price per 1M tokens
- **Context Window**: Maximum tokens the model can handle
- **Value Badge**: Highlights the most cost-effective option

### Switching Models

Click any model card to:
1. Open the Cursor AI panel
2. Open the model picker dropdown
3. Copy the model name to your clipboard

Then paste the model name in the picker to select it.

### Settings

Click the gear icon in the panel to access settings:

| Setting | Description | Default |
|---------|-------------|---------|
| Refresh Interval | How often to fetch new pricing data | 24 hours |
| Auto-refresh | Update pricing automatically on startup | Enabled |
| Best Value Days | Days to consider for value calculations | 7 |
| Display Mode | Show daily, weekly, or monthly costs | Daily |

### Available Commands

Access these via the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `AI Cost Overlay: Open Panel` | Show the cost overlay sidebar |
| `AI Cost Overlay: Refresh Pricing` | Manually refresh pricing data |
| `AI Cost Overlay: Open Settings` | Configure extension settings |

## How It Works

### Data Sources

The extension combines pricing data from multiple sources:

1. **LiteLLM Model Registry**: Community-maintained pricing database for hundreds of AI models
   - Source: https://github.com/BerriAI/litellm
   - Updated: Based on your refresh interval setting

2. **Cursor-Specific Models**: Hardcoded pricing for Cursor's proprietary models
   - Source: https://cursor.com/docs/models-and-pricing
   - Models: Composer, Claude variants, GPT variants, Gemini variants, Grok variants

### Caching Strategy

Pricing data is cached locally to ensure the extension works offline:
- **Cache Duration**: Configurable (12h, 24h, 48h, or 72h)
- **Fallback**: If the LiteLLM API is unavailable, cached data is used
- **Update Strategy**: LiteLLM data supplements (not replaces) Cursor's canonical model list

### Value Calculation

The "Best Value" badge is calculated using:
- Input cost per 1M tokens
- Output cost per 1M tokens
- Context window size
- Historical usage patterns (if available)

## Development

### Project Structure

```
cursor-ai-cost-overlay/
├── extension-src/
│   ├── extension.js          # Main extension entry point
│   ├── sidebarProvider.js    # Webview view provider
│   └── pricingEngine.js      # Pricing data fetching and caching
├── src/                      # React webview source
│   ├── App.jsx
│   ├── components/
│   └── vscodeAdapter.js
├── media/
│   ├── icon.svg              # Extension icon
│   └── screenshot.png        # README screenshot
├── package.json              # Extension manifest
├── vite.config.js           # Build configuration
└── README.md
```

### Tech Stack

- **Extension Host**: Node.js + VS Code Extension API
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Communication**: VS Code Webview API (`postMessage`)
- **State**: `context.globalState` for persistence

### Building

```bash
# Install dependencies
npm install

# Build webview
npm run build

# Package extension
npx vsce package --no-yarn
```

### Running in Development

1. Press `F5` in VS Code to open a new Extension Development Host
2. The extension will be automatically loaded
3. Changes to extension code require reloading the window
4. Changes to webview code are hot-reloaded by Vite

## Contributing

Contributions are welcome! Here's how to help:

### Reporting Issues

- Use the [GitHub Issues](../../issues) page
- Include your Cursor/VS Code version
- Attach relevant logs from the "AI Cost Overlay" output channel
- Describe expected vs actual behavior

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and ensure the build passes
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for non-obvious logic
- Update README.md if adding features
- Test on both VS Code and Cursor editors

## Roadmap

- [x] **Custom model price alerts** — Get notified when model prices drop below or rise above your thresholds
- [x] **Historical pricing charts** — Track price trends over time with interactive charts
- [ ] Usage cost tracking (if API becomes available)
- [ ] Team/organization pricing plans
- [ ] Integration with other AI coding tools

## FAQ

**Q: Why can't the extension automatically switch the model?**  
A: Cursor doesn't expose a public API for programmatic model switching. The extension opens the model picker and copies the model name to make manual selection as easy as possible.

**Q: Where does the pricing data come from?**  
A: Primary source is Cursor's official [Models & Pricing](https://cursor.com/docs/models-and-pricing) page, with the [LiteLLM model registry](https://github.com/BerriAI/litellm) used as a fallback if Cursor's docs are unavailable.

**Q: Does this work with VS Code too?**  
A: Yes! While designed for Cursor, the extension works in standard VS Code as well.

**Q: Is my usage data collected?**  
A: No. The extension only fetches public pricing data and stores it locally. No usage statistics or personal data is collected.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [LiteLLM](https://github.com/BerriAI/litellm) for maintaining the comprehensive model pricing database
- Cursor team for the excellent AI editor
- VS Code team for the extensible editor platform

---

**Made with ❤️ by the Cursor AI Cost Overlay community**

[Report Bug](../../issues) · [Request Feature](../../issues) · [View License](LICENSE)
