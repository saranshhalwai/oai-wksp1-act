const sitesPattern = 'https://*.chatgpt.site';

export function createOriginCheck(allowlist: string): (origin: string) => boolean {
  const entries = new Set(allowlist.split(',').map(entry => entry.trim()).filter(Boolean));
  return origin => {
    if (origin !== sitesPattern && entries.has(origin)) return true;
    if (!entries.has(sitesPattern)) return false;
    try {
      const url = new URL(origin);
      return url.origin === origin && url.protocol === 'https:' && !url.port &&
        url.hostname.endsWith('.chatgpt.site') &&
        url.hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
    } catch {
      return false;
    }
  };
}
