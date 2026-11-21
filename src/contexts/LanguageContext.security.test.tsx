import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { LanguageProvider, useLanguage } from './LanguageContext';

const mocks = vi.hoisted(() => ({ changeLanguage: vi.fn(async () => true) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, ready: true, i18n: { on: vi.fn(), off: vi.fn() } }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/i18n', () => ({
  getCurrentLanguage: () => 'en',
  isLanguageSupported: (value: string) => value === 'en' || value === 'ms',
  changeLanguage: mocks.changeLanguage,
}));

const wrapper = ({ children }: { children: ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;

beforeEach(() => mocks.changeLanguage.mockClear());

describe('language context input validation', () => {
  it.each([`"><img src=x onerror=alert(1)>`, 'ms/../../attacker', 'en-US', ''])(
    'rejects unsupported language %s before changing application state', async (value) => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    let success: boolean | undefined;
    await act(async () => { success = await result.current.changeLanguage(value as 'en'); });
    expect(success).toBe(false);
    expect(result.current.language).toBe('en');
    expect(mocks.changeLanguage).not.toHaveBeenCalled();
  });

  it('continues to accept supported languages', async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    await act(async () => { expect(await result.current.changeLanguage('ms')).toBe(true); });
    expect(mocks.changeLanguage).toHaveBeenCalledWith('ms');
    expect(result.current.language).toBe('ms');
    await act(async () => { expect(await result.current.changeLanguage('en')).toBe(true); });
    expect(result.current.language).toBe('en');
  });
});
