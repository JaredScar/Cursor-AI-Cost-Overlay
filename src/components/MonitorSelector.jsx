import { useMonitor } from '../hooks/useMonitor.js';

export function MonitorSelector({ onComplete }) {
  const { displays, selectedIndex, selectMonitor } = useMonitor();

  async function handleSelect(index) {
    await selectMonitor(index);
    onComplete();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-white">
      <div className="mb-6 text-center">
        <div className="text-2xl mb-2">⬡</div>
        <h1 className="text-lg font-semibold tracking-wide">Cursor AI Cost Overlay</h1>
        <p className="text-sm text-white/50 mt-1">Choose which monitor to display the overlay on</p>
      </div>

      <div className="w-full space-y-2">
        {displays.length === 0 && (
          <p className="text-center text-white/40 text-sm py-4">Detecting monitors…</p>
        )}
        {displays.map((d) => (
          <button
            key={d.id}
            onClick={() => handleSelect(d.index)}
            className={[
              'w-full text-left px-4 py-3 rounded-lg border transition-all duration-150',
              selectedIndex === d.index
                ? 'border-green-500/60 bg-green-500/10 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{d.label}</span>
              {d.primary && (
                <span className="text-xs text-white/40 border border-white/20 rounded px-1.5 py-0.5">
                  Primary
                </span>
              )}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {d.bounds.width} × {d.bounds.height}
              {d.scaleFactor !== 1 ? ` @ ${d.scaleFactor}×` : ''}
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs text-white/30 text-center">
        You can change this later in Settings
      </p>
    </div>
  );
}
