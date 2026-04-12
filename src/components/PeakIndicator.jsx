import { useState, useEffect } from 'react';
import { formatPeakStatus, minutesUntilChange } from '../utils/peakHours.js';

export function PeakIndicator({ peakConfig }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { inPeak, label, icon } = formatPeakStatus(peakConfig, now);
  const change = minutesUntilChange(peakConfig, now);
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // When peak hours are disabled, render nothing — no clutter
  if (!peakConfig?.enabled) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--vscode-panel-border)]">
      <div className="flex items-center gap-1.5">
        <span className={inPeak ? 'text-yellow-400' : 'text-green-400'}>{icon}</span>
        <span className={`text-xs ${inPeak ? 'text-yellow-400' : 'text-green-400'} opacity-80`}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {change && (
          <span className="text-xs text-[var(--vscode-descriptionForeground)]">
            {change.nextLabel}{' '}
            {change.minutes < 60 ? `${change.minutes}m` : `${Math.floor(change.minutes / 60)}h`}
          </span>
        )}
        <span className="text-xs text-[var(--vscode-descriptionForeground)] font-mono">{timeStr}</span>
      </div>
    </div>
  );
}
