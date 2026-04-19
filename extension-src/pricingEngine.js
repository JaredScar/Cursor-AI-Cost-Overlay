'use strict';

const https = require('https');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = 'pricingCache';
const HISTORY_KEY = 'pricingHistory';
const MAX_HISTORY_DAYS = 30; // Keep last 30 days of price history

// ── Canonical Cursor model list ────────────────────────────────────────────────
// Prices sourced from https://cursor.com/docs/models-and-pricing (per 1M tokens).
// This list is always shown — LiteLLM fetch only overrides individual prices
// where it has matching data, so unlisted / too-new models still appear.
const CURSOR_MODELS = [
  // ── Anthropic ────────────────────────────────────────────────────────────────
  { id: 'claude-sonnet-4-6',        name: 'Claude 4.6 Sonnet',  provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-opus-4-6',          name: 'Claude 4.6 Opus',    provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-sonnet-4-5',        name: 'Claude 4.5 Sonnet',  provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-opus-4-5',          name: 'Claude 4.5 Opus',    provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-haiku-4-5',         name: 'Claude 4.5 Haiku',   provider: 'Anthropic', inputPer1M: 1.00,  outputPer1M: 5.00  },
  { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet',    provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  // ── OpenAI ───────────────────────────────────────────────────────────────────
  { id: 'gpt-5.4',                  name: 'GPT-5.4',            provider: 'OpenAI',    inputPer1M: 2.50,  outputPer1M: 15.00 },
  { id: 'gpt-5.4-mini',             name: 'GPT-5.4 Mini',       provider: 'OpenAI',    inputPer1M: 0.75,  outputPer1M: 4.50  },
  { id: 'gpt-5.4-nano',             name: 'GPT-5.4 Nano',       provider: 'OpenAI',    inputPer1M: 0.20,  outputPer1M: 1.25  },
  { id: 'gpt-5.3-codex',            name: 'GPT-5.3 Codex',      provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5.2',                  name: 'GPT-5.2',            provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5',                    name: 'GPT-5',              provider: 'OpenAI',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  { id: 'gpt-5-mini',               name: 'GPT-5 Mini',         provider: 'OpenAI',    inputPer1M: 0.25,  outputPer1M: 2.00  },
  // ── Google ───────────────────────────────────────────────────────────────────
  { id: 'gemini-3.1-pro',           name: 'Gemini 3.1 Pro',     provider: 'Google',    inputPer1M: 2.00,  outputPer1M: 12.00 },
  { id: 'gemini-3-pro',             name: 'Gemini 3 Pro',       provider: 'Google',    inputPer1M: 2.00,  outputPer1M: 12.00 },
  { id: 'gemini-3-flash',           name: 'Gemini 3 Flash',     provider: 'Google',    inputPer1M: 0.50,  outputPer1M: 3.00  },
  { id: 'gemini/gemini-2.5-flash',  name: 'Gemini 2.5 Flash',   provider: 'Google',    inputPer1M: 0.30,  outputPer1M: 2.50  },
  // ── Cursor ───────────────────────────────────────────────────────────────────
  { id: 'composer-2',               name: 'Composer 2',         provider: 'Cursor',    inputPer1M: 0.50,  outputPer1M: 2.50  },
  // ── xAI ──────────────────────────────────────────────────────────────────────
  { id: 'grok-4.20',                name: 'Grok 4.20',          provider: 'xAI',       inputPer1M: 2.00,  outputPer1M: 6.00  },
  // ── Moonshot ─────────────────────────────────────────────────────────────────
  { id: 'kimi-k2.5',                name: 'Kimi K2.5',          provider: 'Moonshot',  inputPer1M: 0.60,  outputPer1M: 3.00  },
];

// Maps LiteLLM registry IDs → CURSOR_MODELS IDs so the live fetch can update
// prices for models whose IDs differ between LiteLLM and Cursor's docs.
// Only include IDs confirmed present in the LiteLLM registry.
const LITELLM_TO_CURSOR_ID = {
  'claude-sonnet-4-6':        'claude-sonnet-4-6',
  'claude-opus-4-6':          'claude-opus-4-6',
  'claude-sonnet-4-5':        'claude-sonnet-4-5',
  'claude-opus-4-5':          'claude-opus-4-5',
  'claude-haiku-4-5':         'claude-haiku-4-5',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514',
  'gemini/gemini-2.5-flash':  'gemini/gemini-2.5-flash',
};

function fallback() {
  return { models: CURSOR_MODELS.map(m => ({ ...m })), source: 'cursor-docs', lastUpdated: Date.now() };
}

/**
 * Parse LiteLLM response and merge live prices into the base CURSOR_MODELS list.
 * Models not found in LiteLLM keep their hardcoded Cursor-docs price.
 */
function mergeLiteLLM(raw) {
  const modelMap = new Map(CURSOR_MODELS.map(m => [m.id, { ...m }]));

  for (const [liteLLMId, cursorId] of Object.entries(LITELLM_TO_CURSOR_ID)) {
    const entry = raw[liteLLMId];
    if (!entry) continue;
    const input  = Math.round((entry.input_cost_per_token  || 0) * 1_000_000 * 100) / 100;
    const output = Math.round((entry.output_cost_per_token || 0) * 1_000_000 * 100) / 100;
    if (input === 0 && output === 0) continue;
    const model = modelMap.get(cursorId);
    if (model) { model.inputPer1M = input; model.outputPer1M = output; }
  }

  return [...modelMap.values()];
}

function fetchFromLiteLLM() {
  return new Promise((resolve) => {
    const url = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const models = mergeLiteLLM(JSON.parse(body));
          resolve({ models, source: 'litellm', lastUpdated: Date.now() });
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

class PricingEngine {
  constructor(globalState) {
    this._state = globalState;
    this._refreshTimer = null;
    this._onUpdate = null;
  }

  /** Returns cached data or fallback — never null. */
  getCached() {
    const cached = this._state.get(CACHE_KEY);
    return cached || fallback();
  }

  /** Sets a callback that fires whenever pricing data is refreshed. */
  onUpdate(cb) {
    this._onUpdate = cb;
  }

  /**
   * Seed history from whatever data is available right now.
   * Called once on startup so the chart has at least today's prices immediately.
   */
  async seedHistory() {
    const data = this.getCached();
    await this._savePriceHistory(data);
  }

  /** Refreshes pricing: uses cache if still fresh, otherwise fetches. */
  async refresh(force = false) {
    const cached = this._state.get(CACHE_KEY);
    if (!force && cached && Date.now() - cached.lastUpdated < CACHE_TTL_MS) {
      // Still save a history snapshot even when serving from cache,
      // so the chart accumulates data points over multiple sessions.
      await this._savePriceHistory(cached);
      return cached;
    }

    const fetched = await fetchFromLiteLLM();
    const data = fetched || (cached ? { ...cached, stale: true } : fallback());

    await this._state.update(CACHE_KEY, data);
    await this._savePriceHistory(data);
    this._onUpdate?.(data);
    this._scheduleNext();
    return data;
  }

  /** Save a price snapshot to history. One snapshot per day max. */
  async _savePriceHistory(data) {
    if (!data?.models?.length) return;

    const history = this._state.get(HISTORY_KEY) || {};
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Only write once per day — prevents bloat from many cache-hit calls
    if (history[dateKey]) return;

    const snapshot = {};
    for (const model of data.models) {
      snapshot[model.id] = {
        input: model.inputPer1M,
        output: model.outputPer1M,
      };
    }

    history[dateKey] = snapshot;

    // Prune entries older than MAX_HISTORY_DAYS
    const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    for (const key of Object.keys(history)) {
      if (new Date(key).getTime() < cutoff) delete history[key];
    }

    await this._state.update(HISTORY_KEY, history);
  }

  /** Get price history for charting. Returns serialisable data for Chart.js */
  getPriceHistory(modelIds = null, days = 30) {
    const history = this._state.get(HISTORY_KEY) || {};
    const allDates = Object.keys(history).sort();

    // Filter to last N days
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const filteredDates = allDates.filter(d => new Date(d).getTime() >= cutoff);

    if (!filteredDates.length) return null;

    // Determine which model IDs to include
    const firstSnapshot = history[filteredDates[0]] || {};
    const resolvedIds = modelIds?.length ? modelIds : Object.keys(firstSnapshot);

    // Fixed palette — hex values work in canvas contexts
    const PALETTE = [
      '#4e9af1', '#f1c94e', '#4ef18a', '#f14e4e', '#b44ef1',
      '#f1874e', '#4ef1e8', '#f14eb0', '#8af14e', '#f1f14e',
    ];

    const datasets = resolvedIds.map((modelId, index) => {
      const model = CURSOR_MODELS.find(m => m.id === modelId);
      const color = PALETTE[index % PALETTE.length];

      return {
        label: model?.name || modelId,
        data: filteredDates.map(date => history[date]?.[modelId]?.input ?? null),
        borderColor: color,
        backgroundColor: color + '33', // 20% alpha
        tension: 0.3,
        fill: false,
        spanGaps: true,
        pointRadius: 3,
      };
    }).filter(d => d.data.some(v => v !== null));

    return { labels: filteredDates, datasets };
  }

  _scheduleNext() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this.refresh(true), CACHE_TTL_MS);
  }

  dispose() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
  }
}

module.exports = { PricingEngine };
