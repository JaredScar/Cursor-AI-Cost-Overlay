import { useState, useEffect } from 'react';
import { Overlay } from './components/Overlay.jsx';
import { Charts } from './components/Charts.jsx';
import { usePricing } from './hooks/usePricing.js';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [view, setView] = useState('overlay'); // 'overlay' | 'charts'
  const { pricing } = usePricing();

  useEffect(() => {
    window.electronAPI.getSettings()
      .then((s) => setSettings(s ?? {}))
      .catch(() => setSettings({}));
  }, []);

  async function handleSaveSettings(updates) {
    const merged = { ...settings, ...updates };
    setSettings(merged);
    await window.electronAPI.saveSettings(updates);
  }

  if (settings === null) {
    return (
      <div className="panel-root flex items-center justify-center py-8">
        <div className="text-[var(--vscode-descriptionForeground)] text-xs animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  if (view === 'charts') {
    return <Charts models={pricing?.models || []} onClose={() => setView('overlay')} />;
  }

  return (
    <Overlay
      pricing={pricing}
      settings={settings}
      onSaveSettings={handleSaveSettings}
      onOpenCharts={() => setView('charts')}
    />
  );
}
