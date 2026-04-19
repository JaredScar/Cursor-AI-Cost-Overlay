import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

// Available models for selection
const CHART_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet' },
  { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus' },
  { id: 'claude-sonnet-4-5', name: 'Claude 4.5 Sonnet' },
  { id: 'gpt-5.4', name: 'GPT-5.4' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
  { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
  { id: 'composer-2', name: 'Composer 2' },
  { id: 'grok-4.20', name: 'Grok 4.20' },
];

const DAYS_OPTIONS = [7, 14, 30];

export function Charts({ onClose }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState(null);
  const [selectedModels, setSelectedModels] = useState(['gpt-5.4-nano', 'composer-2', 'gemini-3-flash']);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch price history
  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const data = await window.electronAPI.getPriceHistory({
          modelIds: selectedModels,
          days: days,
        });
        setChartData(data);
        if (!data?.datasets?.length) {
          setError('No historical data available yet. Data will appear after pricing refreshes over time.');
        }
      } catch (err) {
        setError('Failed to load price history');
        console.error('Failed to load price history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [selectedModels, days]);

  // Create/update chart
  useEffect(() => {
    if (!canvasRef.current || !chartData?.datasets?.length) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#cccccc',
              font: { size: 10 },
              boxWidth: 12,
              padding: 8,
            },
          },
          title: {
            display: true,
            text: 'Input Price ($/1M tokens)',
            color: '#cccccc',
            font: { size: 11, weight: 'normal' },
          },
          tooltip: {
            backgroundColor: '#1e1e1e',
            titleColor: '#cccccc',
            bodyColor: '#cccccc',
            borderColor: '#444',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const y = context.parsed.y;
                return `${context.dataset.label}: $${y != null ? y.toFixed(2) : 'N/A'}/M`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#333' },
            border: { display: false },
            ticks: {
              color: '#999',
              font: { size: 9 },
              maxRotation: 40,
              minRotation: 40,
            },
          },
          y: {
            beginAtZero: false,
            grid: { color: '#333' },
            border: { display: false },
            ticks: {
              color: '#999',
              font: { size: 9 },
              callback: (value) => `$${value}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [chartData]);

  function toggleModel(modelId) {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= 5) {
        return [...prev.slice(1), modelId]; // Keep max 5 models
      }
      return [...prev, modelId];
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)]">
        <span className="text-[11px] font-semibold text-[var(--vscode-foreground)]">Price History</span>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--vscode-foreground)] opacity-40 hover:opacity-90 hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-all text-xs leading-none"
          aria-label="Close charts"
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div className="px-3 py-2 space-y-2 border-b border-[var(--vscode-panel-border)]">
        {/* Time range selector */}
        <div>
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mb-1">Time Range</div>
          <div className="flex gap-1">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={[
                  'flex-1 py-1 text-[10px] rounded transition-colors',
                  days === d
                    ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                    : 'bg-[var(--vscode-input-background)] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]',
                ].join(' ')}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {/* Model selector */}
        <div>
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)] mb-1">
            Models (select up to 5)
          </div>
          <div className="flex flex-wrap gap-1">
            {CHART_MODELS.map((model) => {
              const isSelected = selectedModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className={[
                    'px-2 py-1 text-[9px] rounded transition-colors',
                    isSelected
                      ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                      : 'bg-[var(--vscode-input-background)] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]',
                  ].join(' ')}
                  title={model.name}
                >
                  {model.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 px-3 pt-2 pb-1 relative" style={{ minHeight: 0 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">Loading...</div>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="text-[11px] text-[var(--vscode-descriptionForeground)] text-center leading-relaxed">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && chartData?.datasets?.length > 0 && (
          <canvas ref={canvasRef} style={{ width: '100%', height: '220px' }} />
        )}
      </div>

      {/* Info footer */}
      <div className="px-3 py-2 border-t border-[var(--vscode-panel-border)]">
        <div className="text-[9px] text-[var(--vscode-descriptionForeground)]">
          Historical data is collected automatically when pricing refreshes.
          {chartData?.labels?.length > 0 && (
            <span> Showing {chartData.labels.length} data points.</span>
          )}
        </div>
      </div>
    </div>
  );
}
