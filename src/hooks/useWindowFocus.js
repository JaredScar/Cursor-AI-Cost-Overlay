import { useState, useEffect } from 'react';

export function useWindowFocus() {
  // Default visible — watcher will correct this within ~3s
  const [isCursorFocused, setIsCursorFocused] = useState(true);

  useEffect(() => {
    const unsub = window.electronAPI.onFocusChange((focused) => {
      setIsCursorFocused(focused);
    });
    return unsub;
  }, []);

  return isCursorFocused;
}
