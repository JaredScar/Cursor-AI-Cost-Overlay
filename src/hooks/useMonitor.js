import { useState, useEffect, useCallback } from 'react';

export function useMonitor() {
  const [displays, setDisplays] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    window.electronAPI.getDisplays().then(setDisplays);
    window.electronAPI.getSettings().then((s) => {
      if (s?.selectedMonitor !== undefined) setSelectedIndex(s.selectedMonitor);
    });
  }, []);

  const selectMonitor = useCallback(async (index) => {
    await window.electronAPI.selectMonitor(index);
    setSelectedIndex(index);
  }, []);

  return { displays, selectedIndex, selectMonitor };
}
