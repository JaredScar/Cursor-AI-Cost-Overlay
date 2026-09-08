import { useState, useEffect } from 'react';
import { ModelCard } from './ModelCard.jsx';
import { Recommendation } from './Recommendation.jsx';
import { PeakIndicator } from './PeakIndicator.jsx';
import { Settings } from './Settings.jsx';
import { sortedModels, getBestModel, formatLastUpdated } from '../utils/recommendation.js';
import { describePricingSource } from '../utils/pricingSource.js';

export function Overlay({ pricing, settings, onSaveSettings, onOpenCharts }) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState(null);

  // Subscribe to status messages from the extension host
  useEffect(() => {
    const unsub = window.electronAPI.onStatus((msg) => {
      setStatus(msg);
      // Clear status after 3 seconds
      setTimeout(() => setStatus(null), 3000);
    });
    return unsub;
  }, []);

  function handleSelectModel(model) {
    setSelectedId(model.id);
    window.electronAPI.selectModel(model.id, model.name);
    // Clear the selection highlight after a moment
    setTimeout(() => setSelectedId(null), 2000);
  }

  const models = sortedModels(pricing?.models, settings?.visibleModels);
  const best = getBestModel(pricing?.models, settings?.visibleModels);
  const source = describePricingSource(pricing);
  const sourceBadgeClass = {
    live: 'text-green-400 border-green-400/40',
    cache: 'text-[var(--vscode-descriptionForeground)] border-[var(--vscode-panel-border)]',
    stale: 'text-[var(--vscode-notificationsWarningIcon-foreground)] border-current',
    fallback: 'text-[var(--vscode-notificationsWarningIcon-foreground)] border-current',
    local: 'text-[var(--vscode-descriptionForeground)] border-[var(--vscode-panel-border)]',
  }[source.kind] || 'text-[var(--vscode-descriptionForeground)] border-[var(--vscode-panel-border)]';

  return (
    <div className="panel-root">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
        <span className="text-xs font-semibold text-[var(--vscode-foreground)] tracking-wide opacity-80">
          AI Model Costs
        </span>
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-[9px] text-[var(--vscode-descriptionForeground)] italic animate-pulse">
              {status}
            </span>
          )}
          <span
            className={`text-[9px] font-semibold tracking-wide uppercase border rounded px-1.5 py-0.5 ${sourceBadgeClass}`}
            title={source.detail}
          >
            {source.badge}
          </span>
          <button
            onClick={onOpenCharts}
            className="text-[var(--vscode-foreground)] opacity-30 hover:opacity-70 transition-opacity text-sm leading-none"
            title="View Price History Charts"
          >
            📊
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="text-[var(--vscode-foreground)] opacity-30 hover:opacity-70 transition-opacity text-sm leading-none"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {showSettings ? (
        <Settings
          settings={settings}
          models={pricing?.models || []}
          onSave={onSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          {/* Peak Indicator */}
          <PeakIndicator peakConfig={settings?.peakHours} />

          {/* Best Value */}
          <Recommendation best={best} models={pricing?.models || []} />

          {/* Model list header */}
          <div className="px-3 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold tracking-widest opacity-30 text-[var(--vscode-foreground)] uppercase">
                All Models ({models.length}) · 70/30 Blend
              </span>
              <div className="flex-1 h-px bg-[var(--vscode-panel-border)]" />
            </div>
          </div>

          {/* Model list */}
          <div className="px-1 pb-1 space-y-0.5 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            {models.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                allModels={models}
                isBest={m.id === best?.id}
                isSelected={m.id === selectedId}
                onSelect={handleSelectModel}
              />
            ))}
            {models.length === 0 && (
              <p className="text-center text-[var(--vscode-descriptionForeground)] text-xs py-4">
                No pricing data
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-start justify-between gap-2 px-3 py-2 border-t border-[var(--vscode-panel-border)]">
            <div className="min-w-0">
              <div
                className="text-[10px] text-[var(--vscode-foreground)] opacity-80"
                title={source.detail}
              >
                {source.short}
              </div>
              <div className="text-[9px] text-[var(--vscode-descriptionForeground)]">
                {models.length} models · updated {formatLastUpdated(pricing?.lastUpdated)}
              </div>
            </div>
            <button
              onClick={() => window.electronAPI.refreshPricing()}
              className="text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] transition-colors flex-shrink-0"
              title="Fetch latest prices from Cursor’s website"
            >
              ↻
            </button>
          </div>
        </>
      )}
    </div>
  );
}
