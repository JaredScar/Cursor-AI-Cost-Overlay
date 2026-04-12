import { useState } from 'react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const REFRESH_OPTIONS = [1, 3, 6, 12, 24];

export function Settings({ settings, onSave, onClose }) {
  const [notifications, setNotifications] = useState(settings?.notifications ?? true);
  const [refreshHours, setRefreshHours]   = useState(settings?.refreshIntervalHours ?? 6);

  const [peakEnabled, setPeakEnabled] = useState(settings?.peakHours?.enabled ?? false);
  const [peakStart, setPeakStart]     = useState(settings?.peakHours?.start ?? '09:00');
  const [peakEnd, setPeakEnd]         = useState(settings?.peakHours?.end ?? '18:00');
  const [peakDays, setPeakDays]       = useState(settings?.peakHours?.days ?? [1, 2, 3, 4, 5]);

  function toggleDay(d) {
    setPeakDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function handleSave() {
    onSave({
      notifications,
      refreshIntervalHours: refreshHours,
      peakHours: { enabled: peakEnabled, start: peakStart, end: peakEnd, days: peakDays },
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
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-[var(--vscode-foreground)]">{label}</div>
        {hint && <div className="text-[10px] text-[var(--vscode-descriptionForeground)] leading-tight mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
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
        'relative w-8 h-[18px] rounded-full transition-colors flex-shrink-0 focus:outline-none',
        value ? 'bg-[var(--vscode-button-background)]' : 'bg-[var(--vscode-input-background)]',
      ].join(' ')}
      style={{ border: '1px solid var(--vscode-panel-border)' }}
    >
      <span
        className={[
          'absolute top-[2px] w-[13px] h-[13px] bg-white rounded-full shadow-sm transition-transform',
          value ? 'translate-x-[15px]' : 'translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  );
}
