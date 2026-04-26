'use strict';

const https = require('https');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = 'pricingCache';
const HISTORY_KEY = 'pricingHistory';
const MAX_HISTORY_DAYS = 30; // Keep last 30 days of price history
const CURSOR_PRICING_URL = 'https://cursor.com/docs/models-and-pricing';
const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// ── Canonical Cursor model list ────────────────────────────────────────────────
// Last-known Cursor prices (per 1M tokens). Runtime refreshes now fetch Cursor's
// docs page first and only fall back to this list if the network/doc parse fails.
const CURSOR_MODELS = [
  // ── Anthropic ────────────────────────────────────────────────────────────────
  { id: 'claude-sonnet-4-6',        name: 'Claude 4.6 Sonnet',  provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-opus-4-7',          name: 'Claude 4.7 Opus',    provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  // ── OpenAI ───────────────────────────────────────────────────────────────────
  { id: 'gpt-5.3-codex',            name: 'GPT-5.3 Codex',      provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5.5',                  name: 'GPT-5.5',            provider: 'OpenAI',    inputPer1M: 5.00,  outputPer1M: 30.00 },
  // ── Google ───────────────────────────────────────────────────────────────────
  { id: 'gemini-3.1-pro',           name: 'Gemini 3.1 Pro',     provider: 'Google',    inputPer1M: 2.00,  outputPer1M: 12.00 },
  // ── Cursor ───────────────────────────────────────────────────────────────────
  { id: 'composer-2',               name: 'Composer 2',         provider: 'Cursor',    inputPer1M: 0.50,  outputPer1M: 2.50  },
  // ── xAI ──────────────────────────────────────────────────────────────────────
  { id: 'grok-4.20',                name: 'Grok 4.20',          provider: 'xAI',       inputPer1M: 2.00,  outputPer1M: 6.00  },
];

const CURSOR_DOC_MODEL_OVERRIDES = {
  'claude-4-6-sonnet': 'claude-sonnet-4-6',
  'claude-opus-4-7': 'claude-opus-4-7',
  'cursor-composer-2': 'composer-2',
  'gemini-3-1-pro': 'gemini-3.1-pro',
  'gpt-5-3-codex': 'gpt-5.3-codex',
  'gpt-5-5': 'gpt-5.5',
  'grok-4-20': 'grok-4.20',
};

const PROVIDER_LABELS = {
  anthropic: 'Anthropic',
  cursor: 'Cursor',
  google: 'Google',
  openai: 'OpenAI',
  xai: 'xAI',
};

// Maps LiteLLM registry IDs → CURSOR_MODELS IDs so the live fetch can update
// prices for models whose IDs differ between LiteLLM and Cursor's docs.
// Only include IDs confirmed present in the LiteLLM registry.
const LITELLM_TO_CURSOR_ID = {
  'claude-sonnet-4-6':        'claude-sonnet-4-6',
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

function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value) {
  return htmlDecode(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parsePrice(value) {
  const match = stripTags(value).match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function idFromCursorDocsSlug(slug) {
  return CURSOR_DOC_MODEL_OVERRIDES[slug] || slug;
}

function providerFromCell(cell) {
  const providerMatch = String(cell || '').match(/providers\/([a-z0-9-]+)(?:[-.]|\.svg)/i);
  const key = providerMatch?.[1]?.replace(/-(dark|light)$/i, '').toLowerCase();
  if (key && PROVIDER_LABELS[key]) return PROVIDER_LABELS[key];

  const name = stripTags(cell).toLowerCase();
  if (name.includes('claude')) return 'Anthropic';
  if (name.includes('gpt')) return 'OpenAI';
  if (name.includes('gemini')) return 'Google';
  if (name.includes('grok')) return 'xAI';
  if (name.includes('composer')) return 'Cursor';
  return 'Unknown';
}

function parseCursorDocsPricing(html) {
  if (!html) return [];

  const headingIndex = html.indexOf('id="model-pricing"');
  if (headingIndex === -1) return [];

  const tableStart = html.indexOf('<table', headingIndex);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart === -1 || tableEnd === -1) return [];

  const tableHtml = html.slice(tableStart, tableEnd + '</table>'.length);
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const models = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
    if (cells.length < 5) continue;

    const link = cells[0].match(/href="(?:https:\/\/cursor\.com)?\/docs\/models\/([^"#?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const slug = link?.[1];
    const name = stripTags(link?.[2] || cells[0]);
    const input = parsePrice(cells[1]);
    const output = parsePrice(cells[4]);

    if (!slug || !name || input === null || output === null) continue;

    models.push({
      id: idFromCursorDocsSlug(slug),
      name,
      provider: providerFromCell(cells[0]),
      inputPer1M: input,
      outputPer1M: output,
    });
  }

  return models;
}

function extractModelsTableChunkUrls(html) {
  const normalized = String(html || '').replace(/\\"/g, '"').replace(/\\u0026/g, '&');
  const manifest = normalized.match(/\d+:I\[\d+,\[(.*?)\],"ModelsTable"\]/s);
  if (!manifest) return [];

  return [...manifest[1].matchAll(/"([^"]+?\.js\?dpl=[^"]+?)"/g)]
    .map(match => new URL(match[1], CURSOR_PRICING_URL).toString());
}

function parseChunkNumber(block, key) {
  const match = block.match(new RegExp(`${key}:(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))`));
  return match ? Number(match[1]) : null;
}

function parseChunkString(block, key) {
  const match = block.match(new RegExp(`${key}:"([^"]*)"`));
  return match?.[1] || null;
}

function parseCursorModelsChunk(js) {
  if (!js) return [];

  const models = [];
  const modelRegex = /\{id:"([^"]+)",slug:"([^"]+)"([\s\S]*?)(?=\},\{id:"[^"]+",slug:"|\];|$)/g;

  for (const match of js.matchAll(modelRegex)) {
    const [, id, slug, block] = match;
    const hiddenMatch = block.match(/hidden:!(\d)/);
    const hidden = hiddenMatch ? hiddenMatch[1] === '0' : false;
    if (hidden) continue;

    const name = parseChunkString(block, 'name');
    const provider = parseChunkString(block, 'provider');
    const input = parseChunkNumber(block, 'uncachedInput') ?? parseChunkNumber(block, 'tokenInput');
    const output = parseChunkNumber(block, 'output') ?? parseChunkNumber(block, 'tokenOutput');

    if (!name || !provider || input === null || output === null) continue;

    models.push({
      id: idFromCursorDocsSlug(id),
      name,
      provider,
      inputPer1M: input,
      outputPer1M: output,
      slug,
    });
  }

  return models;
}

function fetchText(url, timeout = 8000, redirectsRemaining = 3) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const req = https.get(url, {
      timeout,
      headers: { 'User-Agent': 'Cursor-AI-Cost-Overlay/1.0' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsRemaining > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        fetchText(nextUrl, timeout, redirectsRemaining - 1).then(done);
        return;
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        done(null);
        return;
      }

      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => done(body));
    });
    req.on('error', () => done(null));
    req.on('timeout', () => { req.destroy(); done(null); });
  });
}

async function fetchFromCursorDocs() {
  const html = await fetchText(CURSOR_PRICING_URL);
  let models = parseCursorDocsPricing(html);

  if (!models.length) {
    const chunkUrls = extractModelsTableChunkUrls(html);
    const chunks = await Promise.all(chunkUrls.map(chunkUrl => fetchText(chunkUrl)));
    for (const js of chunks) {
      models = parseCursorModelsChunk(js);
      if (models.length) break;
    }
  }

  if (!models.length) return null;
  return { models: models.map(({ slug, ...model }) => model), source: 'cursor-docs-live', lastUpdated: Date.now() };
}

async function fetchFromLiteLLM() {
  const body = await fetchText(LITELLM_PRICING_URL);
  if (!body) return null;

  try {
    const models = mergeLiteLLM(JSON.parse(body));
    return { models, source: 'litellm', lastUpdated: Date.now() };
  } catch {
    return null;
  }
}

async function fetchLivePricing() {
  const cursorDocs = await fetchFromCursorDocs();
  if (cursorDocs) return cursorDocs;

  return fetchFromLiteLLM();
}

function sameDay(a, b) {
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function historySnapshotMatches(snapshot, data) {
  if (!snapshot || !data?.models?.length) return false;
  return data.models.every((model) => (
    snapshot[model.id]?.input === model.inputPer1M &&
    snapshot[model.id]?.output === model.outputPer1M
  ));
}

async function saveLatestHistorySnapshot(state, data) {
  if (!data?.models?.length) return;

  const history = state.get(HISTORY_KEY) || {};
  const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

  await state.update(HISTORY_KEY, history);
}

function isFreshCache(cached) {
  if (!cached?.lastUpdated) return false;

  // Pre-fix caches could have a fresh timestamp but still contain stale
  // hardcoded prices. Refresh once per day so installed users migrate quickly.
  if (!sameDay(cached.lastUpdated, Date.now())) return false;

  return Date.now() - cached.lastUpdated < CACHE_TTL_MS;
}

function shouldNotifyUpdate(cached, data) {
  if (!cached) return true;
  if (cached.source !== data.source) return true;
  if (cached.models?.length !== data.models?.length) return true;

  const byId = new Map((cached.models || []).map(model => [model.id, model]));
  return data.models.some((model) => {
    const previous = byId.get(model.id);
    return !previous ||
      previous.name !== model.name ||
      previous.inputPer1M !== model.inputPer1M ||
      previous.outputPer1M !== model.outputPer1M;
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

  /** Refreshes pricing: uses today's cache if still fresh, otherwise fetches. */
  async refresh(force = false) {
    const cached = this._state.get(CACHE_KEY);
    if (!force && cached && isFreshCache(cached)) {
      // Still save a history snapshot even when serving from cache,
      // so the chart accumulates data points over multiple sessions.
      await this._savePriceHistory(cached);
      return cached;
    }

    const fetched = await fetchLivePricing();
    const data = fetched || (cached ? { ...cached, stale: true } : fallback());

    await this._state.update(CACHE_KEY, data);
    await this._savePriceHistory(data);
    if (force || shouldNotifyUpdate(cached, data)) this._onUpdate?.(data);
    this._scheduleNext();
    return data;
  }

  /** Save a price snapshot to history. One snapshot per day max. */
  async _savePriceHistory(data) {
    if (!data?.models?.length) return;

    const history = this._state.get(HISTORY_KEY) || {};
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Write once per day unless live prices changed during the day.
    if (historySnapshotMatches(history[dateKey], data)) return;

    await saveLatestHistorySnapshot(this._state, data);
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

module.exports = { PricingEngine, parseCursorDocsPricing, extractModelsTableChunkUrls, parseCursorModelsChunk };
