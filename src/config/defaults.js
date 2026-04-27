export const FALLBACK_PRICING = {
  schemaVersion: 2,
  models: [
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude 4.6 Sonnet',
      provider: 'Anthropic',
      inputPer1M: 3.00,
      outputPer1M: 15.00,
    },
    {
      id: 'claude-opus-4-7',
      name: 'Claude 4.7 Opus',
      provider: 'Anthropic',
      inputPer1M: 5.00,
      outputPer1M: 25.00,
    },
    {
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      provider: 'OpenAI',
      inputPer1M: 5.00,
      outputPer1M: 30.00,
    },
    {
      id: 'gpt-5.3-codex',
      name: 'GPT-5.3 Codex',
      provider: 'OpenAI',
      inputPer1M: 1.75,
      outputPer1M: 14.00,
    },
    {
      id: 'gemini-3.1-pro',
      name: 'Gemini 3.1 Pro',
      provider: 'Google',
      inputPer1M: 2.00,
      outputPer1M: 12.00,
    },
    {
      id: 'composer-2',
      name: 'Composer 2',
      provider: 'Cursor',
      inputPer1M: 0.50,
      outputPer1M: 2.50,
    },
    {
      id: 'grok-4.20',
      name: 'Grok 4.20',
      provider: 'xAI',
      inputPer1M: 2.00,
      outputPer1M: 6.00,
    },
  ],
  lastUpdated: null,
  source: 'fallback',
};

export const DEFAULT_SETTINGS = {
  setupComplete: false,
  selectedMonitor: 0,
  overlayPosition: 'top-right',
  opacity: 90,
  peakHours: {
    enabled: false,
    start: '09:00',
    end: '18:00',
    days: [1, 2, 3, 4, 5],
  },
  visibleModels: null,
  notifications: true,
  refreshIntervalHours: 6,
};
