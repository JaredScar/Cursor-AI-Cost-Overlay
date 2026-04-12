/**
 * VS Code webview adapter.
 *
 * Exposes the same `window.electronAPI` interface used throughout the React app
 * so every hook and component works without modification.
 *
 * Startup flow (push-on-ready):
 *   1. Adapter sends { type: 'ready' } to the extension host.
 *   2. Host immediately pushes { type: 'init-settings', payload } and
 *      { type: 'pricing-update', payload }.
 *   3. getSettings() resolves as soon as init-settings arrives, or after a
 *      5-second safety timeout (falls back to empty defaults).
 */

/* global acquireVsCodeApi */

// Defensive: acquireVsCodeApi must only be called once per webview session.
// Wrap in try-catch so a failure here doesn't crash the entire bundle.
let _vscode = null;
try {
  _vscode = acquireVsCodeApi(); // eslint-disable-line no-undef
} catch (e) {
  console.warn('[CursorCostOverlay] acquireVsCodeApi failed:', e);
}

function _post(msg) {
  try { _vscode?.postMessage(msg); } catch (e) { /* noop */ }
}

// ── State ─────────────────────────────────────────────────────────────────────
let _settingsResolve  = null;
let _cachedSettings   = null;

let _onPricingUpdate  = null;
let _pricingBuffer    = null;   // holds a push that arrived before listener registered

let _onStatus = null;
let _statusBuffer = null;

// ── Message router ────────────────────────────────────────────────────────────
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  const { type, payload } = msg;

  if (type === 'init-settings') {
    _cachedSettings = payload ?? {};
    if (_settingsResolve) { _settingsResolve(_cachedSettings); _settingsResolve = null; }
    return;
  }

  if (type === 'pricing-update') {
    if (_onPricingUpdate) {
      _onPricingUpdate(payload);
    } else {
      _pricingBuffer = payload; // flush when the listener registers
    }
    return;
  }

  if (type === 'status') {
    if (_onStatus) {
      _onStatus(payload);
    } else {
      _statusBuffer = payload;
    }
    return;
  }
});

// ── Public API ────────────────────────────────────────────────────────────────
window.electronAPI = {
  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () => {
    if (_cachedSettings !== null) return Promise.resolve(_cachedSettings);
    return new Promise((resolve) => {
      _settingsResolve = resolve;
      // Safety: if the extension host never replies, fall back to defaults
      setTimeout(() => {
        if (_settingsResolve === resolve) {
          _settingsResolve = null;
          resolve({});
        }
      }, 5000);
    });
  },

  saveSettings: (s) => {
    _cachedSettings = { ..._cachedSettings, ...s };
    _post({ type: 'save-settings', payload: s });
    return Promise.resolve(true);
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  // Pricing arrives via pricing-update push (triggered by 'ready' and background
  // refreshes). getPricing() resolves immediately with null; usePricing shows
  // FALLBACK_PRICING until the first push arrives.
  getPricing:     () => Promise.resolve(null),
  refreshPricing: () => _post({ type: 'refresh-pricing' }),

  // ── Push subscriptions ────────────────────────────────────────────────────
  onPricingUpdate: (cb) => {
    _onPricingUpdate = cb;
    if (_pricingBuffer !== null) { cb(_pricingBuffer); _pricingBuffer = null; }
    return () => { if (_onPricingUpdate === cb) _onPricingUpdate = null; };
  },

  onStatus: (cb) => {
    _onStatus = cb;
    if (_statusBuffer !== null) { cb(_statusBuffer); _statusBuffer = null; }
    return () => { if (_onStatus === cb) _onStatus = null; };
  },

  // Focus is always true inside a VS Code panel
  onFocusChange: (cb) => { cb(true); return () => {}; },

  // ── No-ops (not applicable inside a VS Code webview) ─────────────────────
  getDisplays:         () => Promise.resolve([]),
  selectMonitor:       () => Promise.resolve(true),
  setMousePassthrough: () => {},
  startDrag:           () => {},
  moveDrag:            () => {},
  endDrag:             () => {},

  openExternal: (url) => _post({ type: 'open-external', payload: url }),

  selectModel: (modelId, modelName) => _post({ type: 'select-model', payload: { modelId, modelName } }),
};

// Signal to the extension host that the webview is ready.
_post({ type: 'ready' });
