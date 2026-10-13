import { describe, expect, it } from 'vitest';
import { createOriginCheck } from '../../apps/server/src/origins';

describe('origin allowlist', () => {
  it('keeps exact origins and trims configuration whitespace', () => {
    const allowed = createOriginCheck('https://tanks.example, http://localhost:5173');
    expect(allowed('http://localhost:5173')).toBe(true);
    expect(allowed('http://localhost:5174')).toBe(false);
    expect(allowed('https://demo.chatgpt.site')).toBe(false);
  });
  it('allows HTTPS Sites subdomains only when opted in', () => {
    const allowed = createOriginCheck('https://*.chatgpt.site');
    expect(allowed('https://demo.chatgpt.site')).toBe(true);
    expect(allowed('https://preview.demo.chatgpt.site')).toBe(true);
    for (const origin of ['http://demo.chatgpt.site', 'https://chatgpt.site',
      'https://demo.chatgpt.site.evil.example', 'https://evilchatgpt.site', 'https://demo.chatgpt.sites',
      'https://demo.chatgpt.site:8443', 'https://demo.chatgpt.site/path',
      'https://user@demo.chatgpt.site', 'https://*.chatgpt.site', 'null']) {
      expect(allowed(origin), origin).toBe(false);
    }
  });
});
