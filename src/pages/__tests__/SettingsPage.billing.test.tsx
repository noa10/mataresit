import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/pages/SettingsPage';
import { BillingPreferences } from '@/components/settings/BillingPreferences';

const mocks = vi.hoisted(() => ({ subscriptionData: null as null | { tier: string; status: string } }));
vi.mock('@/contexts/StripeContext', () => ({ useStripe: () => ({ subscriptionData: mocks.subscriptionData, createPortalSession: vi.fn(), refreshSubscription: vi.fn(), isLoading: false }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'one' } }) }));
vi.mock('@/contexts/LanguageContext', () => {
  const t = (key: string) => key;
  return { useDashboardTranslation: () => ({ t }), useSettingsTranslation: () => ({ t }), useLanguage: () => ({ language: 'en', changeLanguage: vi.fn() }) };
});
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: { mode: 'light' }, setMode: vi.fn() }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ limits: null, usage: null, isLoading: false, getCurrentTier: () => 'free', isFeatureAvailable: () => false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  functions: { invoke: vi.fn().mockResolvedValue({ data: { health: null }, error: null }) },
  from: () => ({ select: () => ({ eq: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }) }),
} }));
vi.mock('@/components/dashboard/ApiKeyManagement', () => ({ default: () => null }));
vi.mock('@/components/categories/CategoryManager', () => ({ CategoryManager: () => null }));
vi.mock('@/components/payers/PayerManager', () => ({ PayerManager: () => null }));
vi.mock('@/components/settings/NotificationPreferences', () => ({ NotificationPreferences: () => null }));
vi.mock('@/components/SubscriptionLimitsDisplay', () => ({ default: () => null }));

Element.prototype.scrollIntoView = vi.fn();

describe('unavailable billing data', () => {
  it('does not display a plan, status, or billing actions in Settings', async () => {
    render(<MemoryRouter initialEntries={['/settings?tab=plan']}><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('workspace.settings.subscriptionUnavailable')).toBeTruthy());
    expect(screen.queryByText('workspace.settings.freePlan')).toBeNull();
    expect(screen.queryByText('workspace.settings.active')).toBeNull();
    expect(screen.queryByText('workspace.settings.upgrade')).toBeNull();
    expect(screen.queryByText('workspace.settings.billingPortal')).toBeNull();
  });

  it('does not present paid controls or a free fallback in billing preferences', async () => {
    render(<BillingPreferences />);
    await waitFor(() => expect(screen.getByText('billingPreferences.subscriptionUnavailable')).toBeTruthy());
    expect(screen.queryByText('billingPreferences.current.freePlan')).toBeNull();
    expect(screen.queryByText('billingPreferences.current.autoRenewal')).toBeNull();
    expect(screen.queryByRole('tab', { name: /billingPreferences.tabs.payment/ })).toBeNull();
  });
});
