# Production login outage — follow-ups

**Status 7 Nov 2026 — the "Unregistered API key" outage is fixed and verified in production. Three owner actions remain open.**

**Status update 8 Nov 2026 — the owner applied all four Auth URL / DNS configuration surfaces. Two residuals remain open (Vercel Production redeploy, `FROM_EMAIL` correction). Item 1 of the Trello card stays unticked until both clear.**

The owner reported:

- Supabase Auth **Site URL** changed `https://mataresit.co` → `https://mataresit.vercel.app`, with `https://mataresit.vercel.app/**` added to the redirect allow-list.
- Vercel Production `VITE_SITE_URL` set to the same origin (**redeploy not yet done**).
- Edge secret `SITE_URL` set to the same origin. There is no `FRONTEND_URL` secret — that is fine, see below.
- `mataresit.co` **retired**: removed from Vercel domains entirely.

Verified against the repo and live site by Hermes Agent:

- **Zero** references to the retired `.co` domain remain in the repo (the many `mataresit.com` strings were placeholders at the time; that domain was NXDOMAIN then but is owned as of 9 Nov 2026 — see `mataresit-com-cutover.md`). `index.html` canonical, `public/robots.txt` sitemap, `public/sitemap.xml` and the `APP_DOMAIN` fallback all already use `https://mataresit.vercel.app`.
- The live HTML canonical is `https://mataresit.vercel.app/` and no deployed JS chunk contains the dead `.co` domain. `src/lib/site-url.ts` defaults to the same origin, so **the pending redeploy does not block the interactive login test** — it only bakes the explicit `VITE_SITE_URL` into the bundle.
- `FRONTEND_URL` is not required: `supabase/functions/_shared/site-url.ts` `getFrontendUrl()` falls back to `SITE_URL`, and `normalizeSiteUrl()` strips trailing slashes, so `SITE_URL=https://mataresit.vercel.app/` is valid.
- **`FROM_EMAIL` is misconfigured.** It is currently set to a URL. `supabase/functions/send-email/index.ts` and `send-team-invitation-email/index.ts` pass it straight into Resend's `from` field, which requires a **verified sender email address**; a URL is rejected. The expected form is in `docs/BILLING_SYSTEM_DOCUMENTATION.md`: `FROM_EMAIL=Mataresit <noreply@your-verified-domain>`.

The registrar / DNS delegation step in the section below is superseded by retiring the domain. `https://mataresit.vercel.app/**` returning 404 is expected — it is a Supabase redirect allow-list glob, not a real page.

This runbook is documentation only. The outage fix was configuration (Vercel env + redeploy); no application source changed. The remaining work is tracked on the Trello card linked from this PR.

## What happened

On 4 Nov 2026 the Supabase project `mpmkbtsufihzdelrlszs` rotated its API keys: the publishable key `sb_publishable_HDuVNtY67…` was revoked and `sb_publishable_InGLUAFqu…` registered, but Vercel's `VITE_SUPABASE_ANON_KEY` still held the revoked key in all three environments.

`VITE_*` values are inlined into the JS bundle at build time, and Vercel applies environment-variable changes only to new deployments. Every deployed page therefore kept sending the dead key:

- email/password login → immediate `401 Unregistered API key` at the gateway;
- Google sign-in → the OAuth redirect completes, then token exchange fails (`/auth/v1/authorize` is not key-gated, so the failure surfaces late).

Severity: production outage, all sign-in methods down for roughly three days.

## Fixed and verified

- Registered publishable key deployed to Vercel **Production, Preview and Development**.
- The current production deployment was rebuilt from the same commit — no unreviewed code shipped.
- `.env.local` updated and hardened to mode `0600`.
- Live verification (7 Nov 2026): `https://mataresit.vercel.app` returns `200`; its JS chunks carry the registered key `sb_publishable_InGLUAFqu…` and **not** the revoked one; bundle points at `https://mpmkbtsufihzdelrlszs.supabase.co`.
- The autopilot run that performed the fix ended `completed-and-validated`, with code, security and architecture review all approved.

Users whose access tokens expired during the outage must sign in again. Everyone else recovers automatically on the next token refresh.

## Auth Site URL and DNS — where the fix lives

This is **not a code fix**. Four configuration surfaces:

1. **Supabase Dashboard → project `mpmkbtsufihzdelrlszs` → Authentication → URL Configuration.** Set **Site URL** to `https://mataresit.vercel.app` and add `https://mataresit.vercel.app/**` to the **Redirect URLs** allow-list. The Site URL is what generates fallback, email-confirmation and password-reset links; it currently points at `https://mataresit.co`, which does not resolve.
2. **Vercel → project → Settings → Environment Variables.** Production `VITE_SITE_URL=https://mataresit.vercel.app` (see `README.md` § Backend). Any change needs a redeploy.
3. **Supabase Edge Function secrets.** `SITE_URL` and `FRONTEND_URL` = `https://mataresit.vercel.app`, plus a verified `FROM_EMAIL` for Resend.
4. **Registrar / DNS host for `mataresit.co`.** As of 7 Nov 2026 both `mataresit.co` and `www.mataresit.co` are **NXDOMAIN**, with no NS or SOA records returned — no working delegation. The RDAP lookup did not return a registration record either, so confirm at the registrar whether the domain is still registered, then either restore its nameservers / Vercel records or retire the domain and keep `mataresit.vercel.app` as the canonical origin. If the domain is revived, update all four surfaces together (`README.md` § Backend).

> Do **not** change `supabase/config.toml` `[auth].site_url` for this. It is `http://localhost:5173` and configures the **local** stack only; hosted Auth URL settings are dashboard-managed.

## Interactive login test — owner action

The agent verified everything up to the gateway but could not perform interactive OAuth consent. Run in a fresh incognito / private window and report back:

- [ ] Email/password sign-in succeeds.
- [ ] Google sign-in completes consent and lands authenticated.
- [ ] Token refresh works (leave the tab open past token expiry, then reload).
- [ ] Password-reset and email-confirmation links point at the live origin — this is the dead-Site-URL symptom.
- [ ] A deep link with a `?next=`-style redirect survives the auth round trip.

## Credential cleanups — owner action

- [ ] Rotate the service-role credentials that remain in Git history. This is the **same owner-gated credential-history purge** listed as a blocker on PR #234 — one decision covers both. The purge runbook is tracked on PR #234's branch (`docs/runbooks/credential-history-purge.md`) and lands on `main` when that PR merges.
- [ ] Delete the stale `SERVICE_ROLE_KEY` and `VITE_SUPABASE_ANON_KEY` Edge Function secrets.
- [ ] Move production secrets out of `.env.local` into the platform secret store.

## Prevention

After any API-key rotation or revocation, update `VITE_SUPABASE_ANON_KEY` in every Vercel environment and **redeploy**, because `VITE_*` values are baked into the bundle. The rebuild/redeploy step is `docs/BILLING_DEPLOYMENT_GUIDE.md` § 5 "Frontend Integration"; a step-by-step rotation/redeploy/verify procedure is being added to that guide in PR #234 and lands with it.

## References

- Production origin: https://mataresit.vercel.app
- `README.md` § Backend — Site URL, redirect allow-list, `VITE_SITE_URL`, Edge Function secrets
- `docs/deployment/production-config.md` — `SITE_URL` / `FRONTEND_URL` values
- PR #234 — overlapping owner-gated credential-history purge blocker
