'use strict';

const https = require('https');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = 'pricingCache';
const HISTORY_KEY = 'pricingHistory';
const MAX_HISTORY_DAYS = 30; // Keep last 30 days of price history
const PRICING_SCHEMA_VERSION = 4;
const MIN_LIVE_MODEL_COUNT = 15;
const CURSOR_PRICING_URL = 'https://cursor.com/docs/models-and-pricing';
const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// ── Canonical Cursor model list ────────────────────────────────────────────────
// Last-known Cursor prices (per 1M tokens). Runtime refreshes now fetch Cursor's
// docs page first and only fall back to this list if the network/doc parse fails.
const CURSOR_MODELS = [
  // ── Anthropic ────────────────────────────────────────────────────────────────
  { id: 'claude-sonnet-5',            name: 'Claude Sonnet 5',           provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-4-sonnet',            name: 'Claude 4 Sonnet',           provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-sonnet-4-6',          name: 'Claude 4.6 Sonnet',         provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-4-5-sonnet',          name: 'Claude 4.5 Sonnet',         provider: 'Anthropic', inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'claude-opus-5',              name: 'Claude Opus 5',             provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-opus-4-8',            name: 'Claude Opus 4.8',           provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-fable-5-1',           name: 'Claude Fable 5.1',          provider: 'Anthropic', inputPer1M: 10.00, outputPer1M: 50.00 },
  { id: 'claude-fable-5',             name: 'Claude Fable 5',            provider: 'Anthropic', inputPer1M: 10.00, outputPer1M: 50.00 },
  { id: 'claude-opus-4-7',            name: 'Claude Opus 4.7',           provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-opus-4-7-fast',       name: 'Claude Opus 4.7 Fast',      provider: 'Anthropic', inputPer1M: 30.00, outputPer1M: 150.00 },
  { id: 'claude-4-6-opus',            name: 'Claude 4.6 Opus',           provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-4-5-opus',            name: 'Claude 4.5 Opus',           provider: 'Anthropic', inputPer1M: 5.00,  outputPer1M: 25.00 },
  { id: 'claude-4-5-haiku',           name: 'Claude 4.5 Haiku',          provider: 'Anthropic', inputPer1M: 1.00,  outputPer1M: 5.00 },
  { id: 'claude-4-sonnet-1m',         name: 'Claude 4 Sonnet 1M',        provider: 'Anthropic', inputPer1M: 6.00,  outputPer1M: 22.50 },
  // ── Google ───────────────────────────────────────────────────────────────────
  { id: 'gemini-3.1-pro',             name: 'Gemini 3.1 Pro',            provider: 'Google',    inputPer1M: 2.00,  outputPer1M: 12.00 },
  { id: 'gemini-3-pro',               name: 'Gemini 3 Pro',              provider: 'Google',    inputPer1M: 2.00,  outputPer1M: 12.00 },
  { id: 'gemini-3.8-flash',           name: 'Gemini 3.8 Flash',          provider: 'Google',    inputPer1M: 0.75,  outputPer1M: 3.50 },
  { id: 'gemini-3.7-flash',           name: 'Gemini 3.7 Flash',          provider: 'Google',    inputPer1M: 0.75,  outputPer1M: 3.50 },
  { id: 'gemini-3.6-flash',           name: 'Gemini 3.6 Flash',          provider: 'Google',    inputPer1M: 1.50,  outputPer1M: 7.50 },
  { id: 'gemini-3.5-flash',           name: 'Gemini 3.5 Flash',          provider: 'Google',    inputPer1M: 1.50,  outputPer1M: 9.00 },
  { id: 'gemini-3-flash',             name: 'Gemini 3 Flash',            provider: 'Google',    inputPer1M: 0.50,  outputPer1M: 3.00 },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', provider: 'Google',   inputPer1M: 2.00,  outputPer1M: 12.00 },
  { id: 'gemini-2.5-flash',           name: 'Gemini 2.5 Flash',          provider: 'Google',    inputPer1M: 0.30,  outputPer1M: 2.50 },
  // ── OpenAI ───────────────────────────────────────────────────────────────────
  { id: 'gpt-5.1',                    name: 'GPT-5.1',                   provider: 'OpenAI',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  { id: 'gpt-5-codex',                name: 'GPT-5 Codex',               provider: 'OpenAI',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  { id: 'gpt-5-mini',                 name: 'GPT-5 Mini',                provider: 'OpenAI',    inputPer1M: 0.25,  outputPer1M: 2.00 },
  { id: 'gpt-5-fast',                 name: 'GPT-5 Fast',                provider: 'OpenAI',    inputPer1M: 2.50,  outputPer1M: 20.00 },
  { id: 'gpt-5.2',                    name: 'GPT-5.2',                   provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5.2-codex',              name: 'GPT-5.2 Codex',             provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5.6-sol',                name: 'GPT-5.6 Sol',               provider: 'OpenAI',    inputPer1M: 5.00,  outputPer1M: 30.00 },
  { id: 'gpt-5.6-terra',              name: 'GPT-5.6 Terra',             provider: 'OpenAI',    inputPer1M: 2.50,  outputPer1M: 15.00 },
  { id: 'gpt-5.6-luna',               name: 'GPT-5.6 Luna',              provider: 'OpenAI',    inputPer1M: 1.00,  outputPer1M: 6.00 },
  { id: 'gpt-5.5',                    name: 'GPT-5.5',                   provider: 'OpenAI',    inputPer1M: 5.00,  outputPer1M: 30.00 },
  { id: 'gpt-5.4',                    name: 'GPT-5.4',                   provider: 'OpenAI',    inputPer1M: 2.50,  outputPer1M: 15.00 },
  { id: 'gpt-5.4-mini',               name: 'GPT-5.4 Mini',              provider: 'OpenAI',    inputPer1M: 0.75,  outputPer1M: 4.50 },
  { id: 'gpt-5.4-nano',               name: 'GPT-5.4 Nano',              provider: 'OpenAI',    inputPer1M: 0.20,  outputPer1M: 1.25 },
  { id: 'gpt-5.3-codex',              name: 'GPT-5.3 Codex',             provider: 'OpenAI',    inputPer1M: 1.75,  outputPer1M: 14.00 },
  { id: 'gpt-5.1-codex',              name: 'GPT-5.1 Codex',             provider: 'OpenAI',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  { id: 'gpt-5.1-codex-mini',         name: 'GPT-5.1 Codex Mini',        provider: 'OpenAI',    inputPer1M: 0.25,  outputPer1M: 2.00 },
  { id: 'gpt-5.1-codex-max',          name: 'GPT-5.1 Codex Max',         provider: 'OpenAI',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  // ── Cursor ───────────────────────────────────────────────────────────────────
  { id: 'grok-4.6',                   name: 'Grok 4.6',                  provider: 'Cursor',    inputPer1M: 2.00,  outputPer1M: 6.00 },
  { id: 'grok-4.5',                   name: 'Grok 4.5',                  provider: 'Cursor',    inputPer1M: 2.00,  outputPer1M: 6.00 },
  { id: 'composer-1',                 name: 'Composer 1',                provider: 'Cursor',    inputPer1M: 1.25,  outputPer1M: 10.00 },
  { id: 'composer-2.5',               name: 'Composer 2.5',              provider: 'Cursor',    inputPer1M: 0.50,  outputPer1M: 2.50 },
  // ── Other ────────────────────────────────────────────────────────────────────
  { id: 'kimi-k3',                    name: 'Kimi K3',                   provider: 'Moonshot',  inputPer1M: 3.00,  outputPer1M: 15.00 },
  { id: 'kimi-k2.7-code',             name: 'Kimi K2.7 Code',            provider: 'Moonshot',  inputPer1M: 0.95,  outputPer1M: 4.00 },
  { id: 'glm-5.2',                    name: 'GLM-5.2',                   provider: 'Z.ai',      inputPer1M: 1.40,  outputPer1M: 4.40 },
];

const CURSOR_DOC_MODEL_OVERRIDES = {
  'claude-4-6-sonnet':   'claude-sonnet-4-6',
  'claude-opus-4-7':     'claude-opus-4-7',
  'cursor-composer-2':   'composer-2.5',
  'cursor-composer-2-5': 'composer-2.5',
  'gemini-3-1-pro':      'gemini-3.1-pro',
  'gemini-3-5-flash':    'gemini-3.5-flash',
  'gemini-3-6-flash':    'gemini-3.6-flash',
  'gemini-3-7-flash':    'gemini-3.7-flash',
  'gemini-3-8-flash':    'gemini-3.8-flash',
  'gpt-5-1':             'gpt-5.1',
  'gpt-5-2':             'gpt-5.2',
  'gpt-5-3-codex':       'gpt-5.3-codex',
  'gpt-5-4':             'gpt-5.4',
  'gpt-5-5':             'gpt-5.5',
  'gpt-5-6-sol':         'gpt-5.6-sol',
  'gpt-5-6-terra':       'gpt-5.6-terra',
  'gpt-5-6-luna':        'gpt-5.6-luna',
  'grok-4-5':            'grok-4.5',
  'grok-4-6':            'grok-4.6',
};

const PROVIDER_LABELS = {
  anthropic: 'Anthropic',
  cursor:    'Cursor',
  google:    'Google',
  moonshot:  'Moonshot',
  openai:    'OpenAI',
  xai:       'xAI',
  'z.ai':    'Z.ai',
};

// Maps LiteLLM registry IDs → CURSOR_MODELS IDs so the live fetch can update
// prices for models whose IDs differ between LiteLLM and Cursor's docs.
// Only include IDs confirmed present in the LiteLLM registry.
const LITELLM_TO_CURSOR_ID = {
  'claude-sonnet-4-6':        'claude-sonnet-4-6',
};

function fallback() {
  return {
    schemaVersion: PRICING_SCHEMA_VERSION,
    models: CURSOR_MODELS.map(m => ({ ...m })),
    source: 'bundled',
    origin: 'local',
    lastUpdated: Date.now(),
  };
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
  // Use dotall (s) flag + simple (.*?) so the engine doesn't catastrophically
  // backtrack on the 300+ chunk URLs that now appear in the manifest.
  const manifests = [...normalized.matchAll(/[0-9a-f]+:I\[\d+,\[(.*?)\],"ModelsTable"\]/gs)];
  if (!manifests.length) return [];

  const urls = new Set();
  for (const manifest of manifests) {
    for (const match of manifest[1].matchAll(/"([^"]+?\.js\?dpl=[^"]+?)"/g)) {
      urls.add(new URL(match[1], CURSOR_PRICING_URL).toString());
    }
  }

  return [...urls];
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
  if (!html) return null;

  // The HTML table is only the featured/visible subset (about 8 models).
  // The full catalog, including "Show more models", lives in the ModelsTable JS chunk.
  const chunkUrls = extractModelsTableChunkUrls(html);
  const chunks = await Promise.all(chunkUrls.map(chunkUrl => fetchText(chunkUrl)));
  let models = [];
  let parseMethod = null;
  for (const js of chunks) {
    const parsed = parseCursorModelsChunk(js);
    if (parsed.length > models.length) {
      models = parsed;
      parseMethod = 'models-table';
    }
  }

  if (models.length < MIN_LIVE_MODEL_COUNT) {
    const htmlModels = parseCursorDocsPricing(html);
    if (htmlModels.length > models.length) {
      models = htmlModels;
      parseMethod = 'html-table';
    }
  }

  if (!models.length) return null;
  return {
    schemaVersion: PRICING_SCHEMA_VERSION,
    models: models.map(({ slug, ...model }) => model),
    source: 'cursor-docs-live',
    origin: 'website',
    parseMethod,
    lastUpdated: Date.now(),
  };
}

async function fetchFromLiteLLM() {
  const body = await fetchText(LITELLM_PRICING_URL);
  if (!body) return null;

  try {
    const models = mergeLiteLLM(JSON.parse(body));
    return {
      schemaVersion: PRICING_SCHEMA_VERSION,
      models,
      source: 'litellm',
      origin: 'website',
      lastUpdated: Date.now(),
    };
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
  if (cached.schemaVersion !== PRICING_SCHEMA_VERSION) return false;
  if ((cached.models?.length || 0) < MIN_LIVE_MODEL_COUNT) return false;

  // Pre-fix caches could have a fresh timestamp but still contain stale
  // hardcoded prices. Refresh once per day so installed users migrate quickly.
  if (!sameDay(cached.lastUpdated, Date.now())) return false;

  return Date.now() - cached.lastUpdated < CACHE_TTL_MS;
}

function persistablePricing(data) {
  const { origin, ...stored } = data || {};
  return stored;
}

function shouldNotifyUpdate(cached, data) {
  if (!cached) return true;
  if (cached.schemaVersion !== data.schemaVersion) return true;
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
    if (!cached) return fallback();
    return { ...cached, origin: 'cache' };
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
      const data = { ...cached, origin: 'cache' };
      await this._savePriceHistory(data);
      return data;
    }

    const fetched = await fetchLivePricing();
    const canReuseCached = cached?.schemaVersion === PRICING_SCHEMA_VERSION;
    const data = fetched
      || (canReuseCached ? { ...cached, stale: true, origin: 'cache' } : fallback());

    await this._state.update(CACHE_KEY, persistablePricing(data));
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

    // Determine which model IDs to include.
    // Use the most recent snapshot as the source of truth so newly-added
    // models appear in charts even if older snapshots didn't have them.
    const latestSnapshot = history[filteredDates[filteredDates.length - 1]] || {};
    const resolvedIds = modelIds?.length ? modelIds : Object.keys(latestSnapshot);

    // Fixed palette — hex values work in canvas contexts
    const PALETTE = [
      '#4e9af1', '#f1c94e', '#4ef18a', '#f14e4e', '#b44ef1',
      '#f1874e', '#4ef1e8', '#f14eb0', '#8af14e', '#f1f14e',
    ];

    const datasets = resolvedIds.map((modelId, index) => {
      const knownModels = this.getCached()?.models || CURSOR_MODELS;
      const model = knownModels.find(m => m.id === modelId);
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
