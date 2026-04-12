# Publishing Guide

This document explains how to publish the AI Cost Overlay extension to different platforms.

## Files Overview

We maintain two README files:

- **README.md** - Comprehensive documentation for GitHub (includes development info, contributing, etc.)
- **EXTENSION_README.md** - Concise, user-focused documentation for the VS Code/Cursor marketplace

## Publishing to GitHub

No special preparation needed. Just push the code:

```bash
git add .
git commit -m "Prepare for release v1.0.0"
git push origin main
```

GitHub will automatically display the comprehensive `README.md`.

## Publishing to VS Code Marketplace

The marketplace requires a more concise README focused on user features.

### Option 1: Temporary Swap (Recommended)

```bash
# Backup the GitHub README
mv README.md README.github.md

# Use the marketplace README
mv EXTENSION_README.md README.md

# Build and package
npm run build
npx vsce package --no-yarn

# Or publish directly (requires Personal Access Token)
npx vsce publish --no-yarn

# Restore the GitHub README
mv README.md EXTENSION_README.md
mv README.github.md README.md
```

### Option 2: Use vsce --readmePath (if supported)

Check if your version of vsce supports the `--readmePath` flag:

```bash
npx vsce package --readmePath EXTENSION_README.md --no-yarn
```

**Note:** This flag may not be available in all vsce versions.

### Option 3: Create a release branch

```bash
# Create a release branch
git checkout -b release/v1.0.0

# Replace README
cp EXTENSION_README.md README.md
git add README.md
git commit -m "Use marketplace README for release"

# Build and package (the branch now has the marketplace README)
npm run build
npx vsce package --no-yarn

# Don't push this branch to GitHub, just use it for packaging
# Switch back to main when done
git checkout main
```

## Pre-Publish Checklist

Before publishing, verify:

- [ ] Version number is updated in `package.json`
- [ ] `CHANGELOG.md` is updated with new features/fixes
- [ ] `LICENSE` file is included
- [ ] `media/screenshot.png` is current and shows the extension clearly
- [ ] Extension icon (`media/icon.svg`) is present
- [ ] All commands listed in README are actually implemented
- [ ] Settings descriptions match the actual configuration options

## Building the Package

```bash
# Clean install
rm -rf node_modules
npm install

# Build the extension
npm run build

# Create the .vsix file
npx vsce package --no-yarn

# The file cursor-ai-cost-overlay-x.x.x.vsix will be created
```

## Testing the Package

Before publishing, test the packaged extension:

```bash
# In VS Code/Cursor, install from the generated .vsix
code --install-extension cursor-ai-cost-overlay-1.0.0.vsix
# or
cursor --install-extension cursor-ai-cost-overlay-1.0.0.vsix
```

Verify:
- [ ] Extension activates without errors
- [ ] Panel opens and shows pricing data
- [ ] Settings can be modified
- [ ] Commands work as expected

## Publishing to Open VSX Registry (Optional)

For users of VSCodium and other VS Code forks:

```bash
# Install ovsx
npm install -g ovsx

# Login (requires Open VSX account)
ovsx login <publisher-name>

# Publish
ovsx publish cursor-ai-cost-overlay-1.0.0.vsix
```

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes (e.g., 2.0.0)
- **MINOR**: New features, backward compatible (e.g., 1.1.0)
- **PATCH**: Bug fixes, backward compatible (e.g., 1.0.1)

## Release Notes Template

When creating a GitHub release, use this template:

```markdown
## What's New in v1.0.0

### Features
- Feature 1 description
- Feature 2 description

### Bug Fixes
- Fix 1 description

### Improvements
- Improvement 1 description

### Installation
Download `cursor-ai-cost-overlay-1.0.0.vsix` below and install via "Install from VSIX" in Cursor/VS Code.

---

**Full Changelog**: https://github.com/cursor-ai-cost-overlay/cursor-ai-cost-overlay/compare/v0.9.0...v1.0.0
```

## Troubleshooting

### vsce fails with "README not found"

Ensure `README.md` exists at the root level. If using `EXTENSION_README.md`, rename it first.

### vsce fails with "LICENSE not found"

The `LICENSE` file must be included in the package. Check that it's not in `.vscodeignore`.

### Extension fails to activate after install

1. Check the "Developer Tools" console for errors (Help > Toggle Developer Tools)
2. Verify all dependencies are properly built
3. Ensure `webview-dist/` contains the built webview files

### Marketplace rejects the package

Common issues:
- Missing `repository` field in `package.json`
- Invalid icon path
- README contains relative links that don't work in marketplace
- Screenshots not included in package

## Support

For publishing help, open an issue on GitHub or contact the maintainers.
