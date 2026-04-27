import { effectiveCost, modelTier, formatEffectiveCost, formatPrice } from '../utils/recommendation.js';

const TIER_STYLES = {
  green:  { dot: 'bg-green-400',  text: 'text-green-400',  bar: 'bg-green-500/60'  },
  yellow: { dot: 'bg-yellow-400', text: 'text-yellow-400', bar: 'bg-yellow-500/60' },
  red:    { dot: 'bg-red-400',    text: 'text-red-400',    bar: 'bg-red-500/60'    },
};

const PROVIDER_BADGE = {
  Anthropic: 'bg-orange-500/15 text-orange-400',
  OpenAI:    'bg-emerald-500/15 text-emerald-400',
  Google:    'bg-blue-500/15 text-blue-400',
};

export function ModelCard({ model, allModels, isBest, isSelected, onSelect }) {
  const tier = modelTier(model, allModels);
  const styles = TIER_STYLES[tier];

  const costs = allModels.map(effectiveCost);
  const maxCost = Math.max(...costs);
  const barWidth = maxCost > 0 ? Math.max(4, (effectiveCost(model) / maxCost) * 100) : 4;

  return (
    <div
      role="button"
      tabIndex={0}
      title={`Use ${model.name} in Cursor. Effective 70/30 blend: ${formatEffectiveCost(model)}. Input: ${formatPrice(model.inputPer1M)}. Output: ${formatPrice(model.outputPer1M)}.`}
      onClick={() => onSelect?.(model)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(model)}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-md transition-all cursor-pointer',
        isSelected
          ? 'bg-[var(--vscode-focusBorder)]/20 ring-1 ring-[var(--vscode-focusBorder)]'
          : isBest
          ? 'bg-green-500/[0.08] hover:bg-green-500/[0.14]'
          : 'hover:bg-[var(--vscode-list-hoverBackground)]',
        'focus:outline-none',
      ].join(' ')}
    >
      {/* Status dot */}
      <div className="flex-shrink-0 relative">
        <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
        {isBest && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${styles.dot} animate-ping opacity-50`} />
        )}
      </div>

      {/* Name + provider */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--vscode-foreground)] truncate font-medium leading-tight opacity-90">
            {model.name}
          </span>
          {isBest && (
            <span className="text-[9px] text-green-400 border border-green-500/30 rounded px-1 leading-tight flex-shrink-0">
              BEST
            </span>
          )}
        </div>
        <div className="mt-0.5">
          <span className={`text-[9px] px-1 rounded ${PROVIDER_BADGE[model.provider] || 'text-[var(--vscode-descriptionForeground)]'}`}>
            {model.provider}
          </span>
        </div>
      </div>

      {/* Price + bar */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-baseline gap-1">
          <span className={`text-[11px] font-mono font-semibold ${styles.text}`}>
            {formatEffectiveCost(model)}
          </span>
          <span className="text-[8px] text-[var(--vscode-descriptionForeground)]">blend</span>
        </div>
        <div className="w-16 h-1 bg-[var(--vscode-panel-border)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${styles.bar} transition-all duration-500`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}
