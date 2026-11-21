import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlogSEO } from './BlogSEO';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import type { Post } from '@/types/blog';

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
vi.mock('@/lib/i18n-seo', () => ({
  seoUtils: { initializeSEO: vi.fn() },
  LANGUAGE_SEO_CONFIGS: {
    en: { locale: 'en_US', direction: 'ltr', language: 'English' },
    ms: { locale: 'ms_MY', direction: 'ltr', language: 'Malay' },
  },
}));

const post: Post = {
  id: '1', slug: 'example', title: 'Example', status: 'published',
  author_id: 'author', created_at: '2026-01-01', updated_at: '2026-01-01',
};
const malicious = `"><img src=x onerror=alert(1)>`;

function LanguageSelector() {
  const { changeLanguage } = useLanguage();
  return (
    <select aria-label="Language" onChange={(event) => void changeLanguage(event.target.value as 'en' | 'ms')}>
      <option value="en">English</option>
      <option value="ms">Malay</option>
      <option value={malicious}>Injected</option>
    </select>
  );
}

function renderSEO() {
  return render(
    <HelmetProvider><LanguageProvider><LanguageSelector /><BlogSEO post={post} /></LanguageProvider></HelmetProvider>,
  );
}

afterEach(() => { cleanup(); mocks.changeLanguage.mockClear(); });

describe('blog canonical URLs', () => {
  it('uses the expected paths for supported languages', async () => {
    const { getByLabelText } = renderSEO();
    await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/blog/example`));
    fireEvent.change(getByLabelText('Language'), { target: { value: 'ms' } });
    await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/ms/blog/example`));
  });

  it('rejects a hostile selector value before it reaches the canonical URL', async () => {
    const { getByLabelText } = renderSEO();
    fireEvent.change(getByLabelText('Language'), { target: { value: malicious } });
    await waitFor(() => expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/blog/example`));
    expect(mocks.changeLanguage).not.toHaveBeenCalled();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
