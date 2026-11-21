import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchChatId } from './history';

afterEach(() => vi.unstubAllGlobals());

describe('search chat identifiers', () => {
  it('uses a cryptographic UUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000000' });
    expect(createSearchChatId()).toBe('chat_00000000-0000-4000-8000-000000000000');
  });

  it('uses cryptographic random bytes when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xab);
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    expect(createSearchChatId()).toBe(`chat_${'ab'.repeat(16)}`);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it.each([undefined, {}])('fails closed without cryptographic randomness (%s)', (crypto) => {
    vi.stubGlobal('crypto', crypto);
    expect(() => createSearchChatId()).toThrow('Secure random number generation is unavailable');
  });
});
