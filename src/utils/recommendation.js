/**
 * Calculates an "effective cost" per 1M tokens based on a typical code
 * completion workload: ~70% input, ~30% output.
 */
export function effectiveCost(model) {
  return model.inputPer1M * 0.7 + model.outputPer1M * 0.3;
}

/**
 * Returns models sorted from cheapest to most expensive (effective cost).
 * Filters out hidden models if visibleModels set is provided.
 */
export function sortedModels(models, visibleModels = null) {
  if (!models?.length) return [];

  const visible = visibleModels
    ? models.filter((m) => visibleModels.includes(m.id))
    : models;

  return [...visible].sort((a, b) => effectiveCost(a) - effectiveCost(b));
}

/**
 * Returns the cheapest model (best value).
 */
export function getBestModel(models, visibleModels = null) {
  const sorted = sortedModels(models, visibleModels);
  return sorted[0] || null;
}

/**
 * Returns the most expensive model (worst value).
 */
export function getWorstModel(models, visibleModels = null) {
  const sorted = sortedModels(models, visibleModels);
  return sorted[sorted.length - 1] || null;
}

/**
 * Returns what percentage cheaper `model` is vs the most expensive option.
 * 0 = same price, 100 = free.
 */
export function savingsVsMax(model, models, visibleModels = null) {
  const worst = getWorstModel(models, visibleModels);
  if (!worst || effectiveCost(worst) === 0) return 0;
  const saving = 1 - effectiveCost(model) / effectiveCost(worst);
  return Math.round(saving * 100);
}

/**
 * Assigns a colour tier to each model:
 *   green  — bottom third (cheapest)
 *   yellow — middle third
 *   red    — top third (most expensive)
 */
export function modelTier(model, models) {
  const sorted = sortedModels(models);
  const idx = sorted.findIndex((m) => m.id === model.id);
  if (idx === -1) return 'yellow';
  const third = sorted.length / 3;
  if (idx < third) return 'green';
  if (idx < third * 2) return 'yellow';
  return 'red';
}

/**
 * Formats a per-1M price as a human-readable string.
 * E.g. 0.075 → "$0.08/M", 15 → "$15.00/M"
 */
export function formatPrice(perMillion) {
  if (perMillion < 0.01) return `$${perMillion.toFixed(4)}/M`;
  if (perMillion < 1) return `$${perMillion.toFixed(3)}/M`;
  return `$${perMillion.toFixed(2)}/M`;
}

/**
 * Formats the effective (blended) cost per 1M tokens.
 */
export function formatEffectiveCost(model) {
  return formatPrice(effectiveCost(model));
}

/**
 * Human-readable relative timestamp.
 */
export function formatLastUpdated(timestamp) {
  if (!timestamp) return 'never';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
