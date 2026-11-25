import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StripeProvider, useStripe } from '@/contexts/StripeContext';

const mocks = vi.hoisted(() => ({ user: { id: 'one' } as { id: string } | null, query: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/config/stripe', () => ({ STRIPE_PUBLIC_KEY: '' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => ({ overrideTypes: mocks.query }) }) }) }) } }));

function Consumer() {
  const { subscriptionData, refreshSubscription } = useStripe();
  return <><span>{subscriptionData?.tier ?? 'unavailable'}</span><button onClick={() => void refreshSubscription()}>refresh</button></>;
}
const profile = { subscription_tier: 'pro', subscription_status: 'active', billing_interval: 'monthly' };

describe('Stripe subscription availability', () => {
  beforeEach(() => { mocks.user = { id: 'one' }; mocks.query.mockReset(); });

  it('keeps the last known subscription when a refresh fails', async () => {
    mocks.query.mockResolvedValueOnce({ data: profile, error: null }).mockResolvedValueOnce({ data: null, error: { code: '42703' } });
    render(<StripeProvider><Consumer /></StripeProvider>);
    await screen.findByText('pro');
    await act(async () => { screen.getByText('refresh').click(); });
    // A failed refresh must not cost a paying account its entitlements; the
    // last known value stays until a definitive answer replaces it.
    expect(screen.getByText('pro')).toBeTruthy();
  });

  it('clears previously loaded data once the account has no profile row', async () => {
    mocks.query.mockResolvedValueOnce({ data: profile, error: null }).mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    render(<StripeProvider><Consumer /></StripeProvider>);
    await screen.findByText('pro');
    await act(async () => { screen.getByText('refresh').click(); });
    await waitFor(() => expect(screen.getByText('unavailable')).toBeTruthy());
  });

  it('does not treat a missing profile as an active free subscription', async () => {
    mocks.query.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    render(<StripeProvider><Consumer /></StripeProvider>);
    await waitFor(() => expect(mocks.query).toHaveBeenCalled());
    expect(screen.queryByText('free')).toBeNull();
  });

  it('does not expose a previous account or accept its late response', async () => {
    let resolveFirst: (value: unknown) => void;
    mocks.query.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce({ data: null, error: { code: '42703' } });
    const view = render(<StripeProvider><Consumer /></StripeProvider>);
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    mocks.user = { id: 'two' };
    view.rerender(<StripeProvider><Consumer /></StripeProvider>);
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(2));
    await act(async () => resolveFirst({ data: profile, error: null }));
    expect(screen.getByText('unavailable')).toBeTruthy();
  });
});
