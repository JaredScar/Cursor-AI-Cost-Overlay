'use strict';

const vscode = require('vscode');
const { PricingEngine } = require('./extension-src/pricingEngine');
const { SidebarProvider } = require('./extension-src/sidebarProvider');

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const pricing = new PricingEngine(context.globalState);
  const sidebar = new SidebarProvider(context, pricing);

  // ── Sidebar panel ──────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cursorCostOverlay.panel', sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── Status bar ─────────────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBar.command = 'cursorCostOverlay.focusPanel';
  statusBar.tooltip = 'Best value Cursor model right now — click to open AI Cost panel';
  statusBar.show();
  context.subscriptions.push(statusBar);

  function updateStatusBar(data) {
    if (!data?.models?.length) {
      statusBar.text = '$(symbol-numeric) AI Costs';
      return;
    }
    const best = [...data.models].sort(
      (a, b) => (a.inputPer1M * 0.7 + a.outputPer1M * 0.3) - (b.inputPer1M * 0.7 + b.outputPer1M * 0.3)
    )[0];
    if (best) {
      statusBar.text = `$(symbol-numeric) ${best.name} · $${best.inputPer1M.toFixed(2)}/M`;
    }
  }

  // Push pricing into the webview and status bar whenever it updates
  pricing.onUpdate((data) => {
    sidebar.pushPricing(data);
    updateStatusBar(data);

    if (context.globalState.get('overlaySettings')?.notifications !== false) {
      const prev = context.globalState.get('lastBestModelId');
      const best = [...(data.models || [])].sort(
        (a, b) => (a.inputPer1M * 0.7 + a.outputPer1M * 0.3) - (b.inputPer1M * 0.7 + b.outputPer1M * 0.3)
      )[0];
      if (best && prev && best.id !== prev) {
        vscode.window.showInformationMessage(
          `AI Cost Overlay: best value model is now ${best.name} ($${best.inputPer1M}/M input)`
        );
      }
      if (best) context.globalState.update('lastBestModelId', best.id);
    }
  });

  // ── Commands ───────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorCostOverlay.refreshPricing', () => {
      pricing.refresh(true);
      vscode.window.showInformationMessage('Cursor Cost Overlay: refreshing pricing data…');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorCostOverlay.focusPanel', () => {
      vscode.commands.executeCommand('cursorCostOverlay.panel.focus');
    })
  );

  // ── Initial load ────────────────────────────────────────────────────────────
  // Show cached/fallback data immediately in the status bar
  updateStatusBar(pricing.getCached());
  // Fetch fresh data in the background
  pricing.refresh(false);
}

function deactivate() {}

module.exports = { activate, deactivate };
