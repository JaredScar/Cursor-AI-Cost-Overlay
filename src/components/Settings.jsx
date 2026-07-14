import { useState } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const REFRESH_OPTIONS = [1, 3, 6, 12, 24];

// Fallback alert models used before live pricing arrives.
const FALLBACK_ALERT_MODELS = [
  { id: 'claude-sonnet-5',   name: 'Claude Sonnet 5' },
  { id: 'claude-opus-4-8',   name: 'Claude Opus 4.8' },
  { id: 'gpt-5.5',           name: 'GPT-5.5' },
  { id: 'gpt-5.4-nano',      name: 'GPT-5.4 Nano' },
  { id: 'gemini-3.1-pro',    name: 'Gemini 3.1 Pro' },
  { id: 'composer-2.5',      name: 'Composer 2.5' },
  { id: 'grok-4-5',          name: 'Grok 4.5' },
];

export function Settings({ settings, models = [], onSave, onClose }) {
  const [notifications, setNotifications] = useState(settings?.notifications ?? true);
  const [refreshHours, setRefreshHours]   = useState(settings?.refreshIntervalHours ?? 6);

  const [peakEnabled, setPeakEnabled] = useState(settings?.peakHours?.enabled ?? false);
  const [peakStart, setPeakStart]     = useState(settings?.peakHours?.start ?? '09:00');
  const [peakEnd, setPeakEnd]         = useState(settings?.peakHours?.end ?? '18:00');
  const [peakDays, setPeakDays]       = useState(settings?.peakHours?.days ?? [1, 2, 3, 4, 5]);

  // Price alerts state
  const [priceAlerts, setPriceAlerts] = useState(settings?.priceAlerts || []);
  const alertModels = models.length
    ? models.map((model) => ({ id: model.id, name: model.name }))
    : FALLBACK_ALERT_MODELS;

  function toggleDay(d) {
    setPeakDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function addAlert() {
    const newAlert = {
      id: Date.now().toString(),
      modelId: alertModels[0].id,
      threshold: 1.00,
      direction: 'below',
      enabled: true,
    };
    setPriceAlerts([...priceAlerts, newAlert]);
  }

  function updateAlert(id, updates) {
    setPriceAlerts(priceAlerts.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  function removeAlert(id) {
    setPriceAlerts(priceAlerts.filter(a => a.id !== id));
  }

  function handleSave() {
    onSave({
      notifications,
      refreshIntervalHours: refreshHours,
      peakHours: { enabled: peakEnabled, start: peakStart, end: peakEnd, days: peakDays },
      priceAlerts,
    });
    onClose();
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
        <span className="text-[11px] font-semibold text-[var(--vscode-foreground)]">Settings</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--vscode-foreground)] opacity-40 hover:opacity-90 hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-all text-xs leading-none"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">

        {/* Notifications */}
        <Row label="Notifications" hint="Alert when best-value model changes">
          <Toggle value={notifications} onChange={setNotifications} />
        </Row>

        {/* Peak Hours */}
        <div>
          <Row label="Peak Hours" hint="Highlight cost during your working hours">
            <Toggle value={peakEnabled} onChange={setPeakEnabled} />
          </Row>

          {peakEnabled && (
            <div className="mt-2.5 space-y-2.5 pl-0.5">
              {/* Time range */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <FieldLabel>Start</FieldLabel>
                  <input
                    type="time"
                    value={peakStart}
                    onChange={(e) => setPeakStart(e.target.value)}
                    className="vsc-input"
                  />
                </div>
                <div className="self-end pb-1 text-[var(--vscode-descriptionForeground)] text-xs">–</div>
                <div className="flex-1">
                  <FieldLabel>End</FieldLabel>
                  <input
                    type="time"
                    value={peakEnd}
                    onChange={(e) => setPeakEnd(e.target.value)}
                    className="vsc-input"
                  />
                </div>
              </div>

              {/* Day pills */}
              <div>
                <FieldLabel>Days</FieldLabel>
                <div className="flex gap-1">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(i)}
                      className={[
                        'flex-1 text-[10px] py-1 rounded transition-colors',
                        peakDays.includes(i)
                          ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                          : 'bg-[var(--vscode-input-background)] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]',
                      ].join(' ')}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Refresh interval */}
        <div>
          <FieldLabel>Pricing refresh interval</FieldLabel>
          <div className="flex gap-1 mt-1">
            {REFRESH_OPTIONS.map((h) => (
              <button
                key={h}
                onClick={() => setRefreshHours(h)}
                className={[
                  'flex-1 py-1.5 text-[10px] rounded transition-colors',
                  refreshHours === h
                    ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                    : 'bg-[var(--vscode-input-background)] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]',
                ].join(' ')}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Price Alerts */}
        <div className="border-t border-[var(--vscode-panel-border)] pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] font-medium text-[var(--vscode-foreground)]">Price Alerts</div>
              <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">Get notified when prices change</div>
            </div>
            <button
              onClick={addAlert}
              className="px-2 py-1 text-[10px] rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
            >
              + Add
            </button>
          </div>

          {priceAlerts.length === 0 && (
            <div className="text-[10px] text-[var(--vscode-descriptionForeground)] italic py-2">
              No alerts configured. Click "+ Add" to create one.
            </div>
          )}

          <div className="space-y-2">
            {priceAlerts.map((alert) => (
              <div key={alert.id} className="p-2 rounded bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Toggle
                    value={alert.enabled}
                    onChange={(v) => updateAlert(alert.id, { enabled: v })}
                  />
                  <select
                    value={alert.modelId}
                    onChange={(e) => updateAlert(alert.id, { modelId: e.target.value })}
                    className="flex-1 text-[10px] py-1 px-1.5 rounded bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)]"
                  >
                    {alertModels.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-[var(--vscode-foreground)] opacity-40 hover:opacity-90 hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-all text-xs"
                    aria-label="Remove alert"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">Notify when price is</span>
                  <select
                    value={alert.direction}
                    onChange={(e) => updateAlert(alert.id, { direction: e.target.value })}
                    className="text-[10px] py-1 px-1.5 rounded bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] border border-[var(--vscode-dropdown-border)]"
                  >
                    <option value="below">below</option>
                    <option value="above">above</option>
                  </select>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={alert.threshold}
                    onChange={(e) => updateAlert(alert.id, { threshold: parseFloat(e.target.value) || 0 })}
                    className="w-16 text-[10px] py-1 px-1.5 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)]"
                  />
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">/M tokens</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-t border-[var(--vscode-panel-border)]">
        <button
          onClick={handleSave}
          className="w-full py-1.5 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] text-xs rounded transition-colors font-medium"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-2 pr-1">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-[var(--vscode-foreground)]">{label}</div>
        {hint && <div className="text-[10px] text-[var(--vscode-descriptionForeground)] leading-tight mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0 pl-1">{children}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mb-1">{children}</div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange((v) => !v)}
      className={[
        'relative inline-flex items-center flex-shrink-0 w-8 h-[18px] rounded-full overflow-hidden',
        'transition-colors focus:outline-none focus-visible:ring-2',
        value ? 'bg-[var(--vscode-button-background)]' : 'bg-[var(--vscode-input-background)]',
      ].join(' ')}
      style={{ border: '1px solid var(--vscode-panel-border)', minWidth: '2rem' }}
    >
      <span
        className={[
          'absolute top-[2px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform duration-150',
          value ? 'bg-white translate-x-[15px]' : 'bg-[var(--vscode-descriptionForeground)] translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  );
}
