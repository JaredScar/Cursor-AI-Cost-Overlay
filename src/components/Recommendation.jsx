import { savingsVsMax, formatPrice } from '../utils/recommendation.js';

export function Recommendation({ best, models }) {
  if (!best) return null;

  const savings = savingsVsMax(best, models);

  return (
    <div className="mx-3 my-2 rounded-lg border border-green-500/25 bg-green-500/[0.06] p-3">
      <div className="text-[9px] font-semibold tracking-widest text-green-400/70 uppercase mb-1.5">
        Best Value Now
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400 text-sm">✦</span>
            <span className="text-sm font-semibold text-[var(--vscode-foreground)]">{best.name}</span>
          </div>
          <div className="text-xs text-[var(--vscode-descriptionForeground)] mt-0.5 ml-5">
            {best.provider} · in {formatPrice(best.inputPer1M)} / out {formatPrice(best.outputPer1M)}
          </div>
        </div>

        {savings > 0 && (
          <div className="text-right flex-shrink-0">
            <div className="text-green-400 font-bold text-sm">{savings}%</div>
            <div className="text-[9px] text-[var(--vscode-descriptionForeground)]">cheaper</div>
          </div>
        )}
      </div>
    </div>
  );
}
