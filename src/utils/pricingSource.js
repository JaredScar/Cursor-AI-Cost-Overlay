/**
 * Explains where the current pricing payload came from so the overlay
 * can distinguish a live website parse from local cache / bundled data.
 */
export function describePricingSource(pricing) {
  const source = pricing?.source;
  const origin = pricing?.origin;
  const stale = pricing?.stale === true;
  const parseMethod = pricing?.parseMethod;

  if (source === 'cursor-docs-live' && origin === 'website') {
    return {
      badge: 'Live',
      short: 'Cursor website',
      detail: parseMethod === 'html-table'
        ? 'Just parsed from the featured table on cursor.com/docs/models-and-pricing'
        : 'Just parsed from cursor.com/docs/models-and-pricing',
      kind: 'live',
    };
  }

  if (source === 'cursor-docs-live') {
    return {
      badge: stale ? 'Stale cache' : 'Cached',
      short: 'Local cache of Cursor website',
      detail: 'Previously parsed from cursor.com/docs/models-and-pricing and stored on this machine',
      kind: stale ? 'stale' : 'cache',
    };
  }

  if (source === 'litellm') {
    return {
      badge: origin === 'cache' ? 'Cached' : 'Fallback',
      short: origin === 'cache' ? 'Local cache of LiteLLM' : 'LiteLLM website',
      detail: origin === 'cache'
        ? 'Previously fetched from the LiteLLM registry and stored on this machine'
        : 'Fetched from the LiteLLM registry because Cursor’s pricing page could not be parsed',
      kind: origin === 'cache' ? 'cache' : 'fallback',
    };
  }

  return {
    badge: 'Local',
    short: 'Built-in fallback',
    detail: 'Bundled prices shipped with the extension. Cursor’s website was not used.',
    kind: 'local',
  };
}
