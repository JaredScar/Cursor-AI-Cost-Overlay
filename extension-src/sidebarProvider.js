'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SETTINGS_KEY = 'overlaySettings';

const DEFAULT_SETTINGS = {
  peakHours: { enabled: false, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
  notifications: true,
  refreshIntervalHours: 6,
  priceAlerts: [], // Array of { modelId, threshold, direction: 'below'|'above', enabled }
  alertHistory: {}, // Track which alerts were triggered { [modelId_threshold]: timestamp }
};

// Create output channel for logging
let _outputChannel = null;
function getOutputChannel() {
  if (!_outputChannel) {
    _outputChannel = vscode.window.createOutputChannel('AI Cost Overlay', { log: true });
  }
  return _outputChannel;
}
function log(message) {
  const channel = getOutputChannel();
  channel.appendLine(`[CursorCostOverlay] ${message}`);
  // Also try console for extension host debugging
  console.log(`[CursorCostOverlay] ${message}`);
}

class SidebarProvider {
  constructor(context, pricingEngine) {
    this._context = context;
    this._pricing = pricingEngine;
    this._view = null;
  }

  /** Called by VS Code when the webview panel becomes visible. */
  resolveWebviewView(webviewView) {
    // Wrap everything so a setup error shows inside the panel instead of
    // producing the opaque "An error occurred while loading view" toast.
    try {
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._context.extensionUri, 'webview-dist'),
        ],
      };

      webviewView.webview.html = this._buildHtml(webviewView.webview);

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        const { type, id, payload } = msg;

        switch (type) {
          // Webview signals it is ready — push initial data immediately.
          case 'ready':
            this._view?.webview.postMessage({ type: 'init-settings', payload: this._getSettings() });
            this._view?.webview.postMessage({ type: 'pricing-update',  payload: this._pricing.getCached() });
            break;

          case 'get-pricing':
            this._reply(id, this._pricing.getCached());
            break;

          case 'refresh-pricing':
            await this._pricing.refresh(true);
            break;

          case 'get-settings':
            this._reply(id, this._getSettings());
            break;

          case 'save-settings':
            await this._saveSettings(payload);
            break;

          case 'open-external':
            if (payload) vscode.env.openExternal(vscode.Uri.parse(payload));
            break;

          case 'select-model':
            await this._selectCursorModel(payload?.modelId, payload?.modelName);
            break;

          case 'get-price-history':
            const historyData = this._pricing.getPriceHistory(
              payload?.modelIds,
              payload?.days || 30
            );
            this._reply(id, historyData);
            break;
        }
      }, undefined, this._context.subscriptions);

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) this._pushPricing();
      });

    } catch (err) {
      console.error('[CursorCostOverlay] resolveWebviewView failed:', err);
      try {
        webviewView.webview.html = `<!DOCTYPE html><html><body style="color:#f48771;padding:16px;font-family:monospace;font-size:12px">
          <b>Cursor AI Cost Overlay — load error</b><br><br>${String(err?.stack || err)}
        </body></html>`;
      } catch (_) { /* last resort */ }
    }
  }

  /** Push fresh pricing data into the webview (called from extension.js). */
  pushPricing(data) {
    this._view?.webview.postMessage({ type: 'pricing-update', payload: data });
  }

  _pushPricing() {
    this.pushPricing(this._pricing.getCached());
  }

  _reply(id, payload) {
    if (id === undefined) return;
    this._view?.webview.postMessage({ type: 'response', id, payload });
  }

  _getSettings() {
    return this._context.globalState.get(SETTINGS_KEY) ?? DEFAULT_SETTINGS;
  }

  async _saveSettings(updates) {
    const current = this._getSettings();
    await this._context.globalState.update(SETTINGS_KEY, { ...current, ...updates });
  }

  /**
   * Build the webview HTML by scanning the compiled assets directory.
   * Generating the HTML here (rather than parsing Vite's output) avoids all
   * string-manipulation fragility and crossorigin/CSP edge cases.
   */
  _buildHtml(webview) {
    const assetsDir = path.join(this._context.extensionPath, 'webview-dist', 'assets');

    let jsFile = '';
    let cssFile = '';
    try {
      const files = fs.readdirSync(assetsDir);
      jsFile  = files.find(f => f.endsWith('.js'))  || '';
      cssFile = files.find(f => f.endsWith('.css')) || '';
    } catch (_) {
      return this._notBuiltHtml();
    }

    if (!jsFile) return this._notBuiltHtml();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'webview-dist', 'assets', jsFile)
    );
    const styleUri = cssFile
      ? webview.asWebviewUri(
          vscode.Uri.joinPath(this._context.extensionUri, 'webview-dist', 'assets', cssFile)
        )
      : null;

    const nonce = crypto.randomBytes(16).toString('hex');
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `connect-src https:`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>AI Cost Overlay</title>
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ''}
</head>
<body>
  <div id="root">
    <div style="color:var(--vscode-foreground);padding:16px;font-size:12px;font-family:var(--vscode-font-family,sans-serif)">
      Loading AI Cost Overlay…
    </div>
  </div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Attempt to switch Cursor's active model.
   *
   * Sends status updates to the webview so user can see what's happening.
   */
  async _selectCursorModel(modelId, modelName) {
    if (!modelId) return;

    log(`Attempting to switch to model: ${modelId}`);
    this._sendStatus(`Switching to ${modelName}...`);

    // Working approach: Open AI panel, open model picker, copy model name to clipboard
    log('Opening AI panel and model picker...');
    this._sendStatus('Opening model picker...');
    
    try {
      // Step 1: Open the AI panel (composer)
      await vscode.commands.executeCommand('composer.focusComposer');
      await this._sleep(500);
      log('AI panel opened');
      
      // Step 2: Open the model picker dropdown
      await vscode.commands.executeCommand('composer.openModelToggle');
      await this._sleep(500);
      log('Model picker opened');
      
      // Step 3: Copy model name to clipboard for user to paste
      await vscode.env.clipboard.writeText(modelName);
      log(`Copied "${modelName}" to clipboard`);
      
      // Step 4: Show instructions to user
      this._sendStatus('Model name copied!');
      vscode.window.showInformationMessage(
        `AI Cost Overlay: "${modelName}" copied to clipboard. Paste it in the model picker to select it.`
      );
      
    } catch (err) {
      log(`Failed to open model picker: ${err.message}`);
      // Fallback: just copy to clipboard without opening picker
      try {
        await vscode.env.clipboard.writeText(modelName);
        this._sendStatus('Model name copied!');
        vscode.window.showInformationMessage(
          `AI Cost Overlay: "${modelName}" copied to clipboard — paste it in Cursor's model dropdown.`
        );
      } catch {
        this._sendStatus('Could not copy model name');
        vscode.window.showInformationMessage(
          `AI Cost Overlay: Please select "${modelName}" manually in Cursor's model dropdown.`
        );
      }
    }
  }

  _sendStatus(message) {
    this._view?.webview.postMessage({ type: 'status', payload: message });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _getProviderFromModelId(modelId) {
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) return 'openai';
    if (modelId.includes('gemini')) return 'google';
    if (modelId.startsWith('composer')) return 'cursor';
    if (modelId.startsWith('grok')) return 'xai';
    if (modelId.startsWith('kimi')) return 'moonshot';
    return 'unknown';
  }

  _notBuiltHtml() {
    return `<!DOCTYPE html><html><body style="color:var(--vscode-foreground);padding:16px;font-family:var(--vscode-font-family,sans-serif)">
      <p><strong>Webview assets not built.</strong></p>
      <p>Run <code>npm run build</code> in the extension source directory, then reload the window.</p>
    </body></html>`;
  }
}

module.exports = { SidebarProvider };
