import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PricingPage from '@/pages/PricingPage';

const downgradeSubscription = vi.hoisted(() => vi.fn());
const createCheckoutSession = vi.hoisted(() => vi.fn());
const refreshSubscription = vi.hoisted(() => vi.fn());
const subscription = vi.hoisted(() => ({ data: { tier: 'max', status: 'active', billingInterval: 'monthly' } as { tier: string; status: string; billingInterval: string } | null, loading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user_1' } }) }));
vi.mock('@/contexts/StripeContext', () => ({
  useStripe: () => ({
    downgradeSubscription,
    createCheckoutSession,
    refreshSubscription,
    subscriptionData: subscription.data,
    subscriptionLoading: subscription.loading,
    isLoading: false,
  }),
}));
vi.mock('@/contexts/LanguageContext', () => {
  const t = (key: string, options?: { returnObjects?: boolean }) => {
    if (options?.returnObjects) return [];
    return key;
  };
  return { usePricingTranslation: () => ({ t }), useHomepageTranslation: () => ({ t }) };
});
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('@/components/marketing/MarketingHeader', () => ({ MarketingHeader: () => null }));
vi.mock('@/components/marketing/MarketingFooter', () => ({ MarketingFooter: () => null }));
vi.mock('@/components/marketing/MarketingCtaBand', () => ({ MarketingCtaBand: () => null }));

describe('pricing downgrade', () => {
  beforeEach(() => {
    downgradeSubscription.mockReset().mockResolvedValue(undefined);
    createCheckoutSession.mockReset();
    refreshSubscription.mockReset();
    subscription.data = { tier: 'max', status: 'active', billingInterval: 'monthly' };
    subscription.loading = false;
  });

  it('blocks checkout and current-plan claims if subscription details could not be loaded', () => {
    subscription.data = null;
    render(<MemoryRouter><PricingPage /></MemoryRouter>);
    expect(screen.getByText('page.subscriptionUnavailable')).toBeInTheDocument();
    expect(screen.queryByText('page.current')).not.toBeInTheDocument();
    const paidButton = screen.getByRole('button', { name: 'page.plans.pro.cta' });
    expect(paidButton).toBeDisabled();
    fireEvent.click(paidButton);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'page.subscriptionRetry' }));
    expect(refreshSubscription).toHaveBeenCalledOnce();
  });

  it.each(['monthly', 'annual'] as const)('passes the selected %s interval to the downgrade', async (interval) => {
    render(<MemoryRouter><PricingPage /></MemoryRouter>);
    if (interval === 'annual') fireEvent.click(screen.getByRole('button', { name: /page.hero.annual/ }));
    fireEvent.click(screen.getByRole('button', { name: 'page.plans.pro.cta' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'page.downgrade.confirm' }));
    await waitFor(() => expect(downgradeSubscription).toHaveBeenCalledWith('pro', false, interval));
  });
});
