# mataresit.com cutover — web origin and transactional email

**Status 9 Nov 2026 — cutover executed.** Nameservers moved to Vercel, certificates issued for apex and
`www`, Resend records published and resolving, Supabase URLs and SMTP configured, Production redeployed
with the new origin, repo references updated. Remaining: DMARC record, mailboxes, Search Console.

This runbook closes the `FROM_EMAIL` item on issue #238 and moves the production origin from
`https://mataresit.vercel.app` to `https://mataresit.com`. It also fixes a larger problem the
issue scoped out: **Supabase Auth currently cannot email anyone outside the project team**, so
password reset and email confirmation are broken for real users.

## Verified starting state

| Check | Result |
|---|---|
| Domain registration | `mataresit.com`, registered 9 Nov 2026 12:22 UTC, expires 9 Nov 2027, registrar WebCom/WebNic (Ezydomain reseller) |
| Registry delegation | `ns1.ezydomain.com`, `ns2.ezydomain.com` |
| Authoritative DNS | `ns1.ezydomain.com` answers **empty for the zone** — no A, MX, TXT or SOA is served |
| Vercel project | `mataresit.com` and `www.mataresit.com` assigned to project `mataresit`; intended nameservers `ns1/ns2.vercel-dns.com`; `www` set to 308 → apex |
| Resend | Last app send (27 Oct 2026, `team_invitation`) failed `403: The mataresit.co domain is not verified`. Earlier sends in May 2026 have provider message ids |
| Resend API key | **Present and working** — the 403 came from Resend's API, so `RESEND_API_KEY` is set. This is not the "mocked send" failure mode |
| Resend plan | Free = 3 domains, 3,000 emails/mo, 100/day. `bakaris.com` can stay verified alongside `mataresit.com` |
| Current auth mail | Supabase default SMTP: **team addresses only, 2 messages/hour** |
| Live site | `https://mataresit.vercel.app` 200; canonical and `og:url` still the `vercel.app` origin |

Because the registrar's own zone is empty, there is no existing mail or web DNS to migrate.
Nothing breaks by switching nameservers — the domain has never served anything.

## Target state

| Surface | Value |
|---|---|
| Canonical origin | `https://mataresit.com` (apex primary, `www` 308 → apex) |
| Fallback origin | `https://mataresit.vercel.app` (kept assigned, kept in the auth allow-list) |
| App mail `FROM_EMAIL` | `Mataresit <noreply@mataresit.com>` |
| Auth mail | Supabase custom SMTP via `smtp.resend.com`, sender `noreply@mataresit.com` |
| Edge secret `SITE_URL` | `https://mataresit.com` |
| Vercel `VITE_SITE_URL` (Production) | `https://mataresit.com` |

## Order of operations

Do these in order; the auth allow-list must be widened **before** the Site URL moves.

1. Registrar: point nameservers at Vercel.
2. Vercel: wait for valid configuration + certificate on both hostnames.
3. Resend: add `mataresit.com`, publish records, verify.
4. Supabase Auth: add the new origins to the redirect allow-list, then move Site URL.
5. Supabase Auth: enable custom SMTP and raise the email rate limit.
6. Supabase Edge secrets: `FROM_EMAIL`, `SITE_URL`, `VAPID_EMAIL`, `BILLING_ALERT_EMAILS`.
7. Vercel: set `VITE_SITE_URL`, redeploy Production.
8. Repo: replace the `vercel.app` origin in canonical/OG/sitemap/fallbacks; merge.
9. Stripe, Google, Search Console, mailboxes.
10. Verify end to end.

## 1. Registrar — delegate DNS to Vercel

In the Ezydomain/WebNic control panel, for `mataresit.com`:

- Nameservers: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Remove the `ezydomain.com` entries;
  do not mix providers.
- Enable registrar lock, auto-renew, and WHOIS privacy. Store the EPP/auth code with the account
  recovery details.
- If the panel refuses the change, check the domain is not in a pending-activation or
  KYC/document state — a new `.com` normally activates within minutes.

Verify from this box:

```bash
dig +short NS mataresit.com @1.1.1.1          # expect ns1/ns2.vercel-dns.com
dig +short A  mataresit.com @1.1.1.1          # expect a Vercel anycast address
npx vercel domains verify mataresit.com --non-interactive
npx vercel domains verify www.mataresit.com --non-interactive
```

Certificates are issued automatically once DNS resolves; `https://mataresit.com` should return
the app with a valid certificate, and `https://www.mataresit.com` a 308 to the apex.

## 2. Resend — verify the sending domain

Dashboard → Domains → Add Domain:

- Name: `mataresit.com`. Do **not** add `www` or a subdomain; the root is what the From address
  uses.
- Region: `ap-northeast-1` (Tokyo) is the closest to Malaysian users. Region affects send
  latency only, not deliverability.
- Leave open/click tracking **off** for transactional mail.

Resend prints the records. With Vercel DNS, add them under the domain's **Records** tab. The
exact DKIM value and the region-specific feedback host come from the dashboard; the shape is:

| Type | Name | Value | Notes |
|---|---|---|---|
| MX | `send` | `feedback-smtp.<region>.amazonses.com` | priority 10; bounce/Return-Path domain |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF for the Return-Path domain |
| TXT | `resend._domainkey` | `p=MIGf…` | DKIM, unique per domain |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@mataresit.com; fo=1` | start at `p=none` |

Notes:

- Do **not** create an SPF record at the apex for Resend. Resend's SPF lives on `send.`, which
  leaves the apex free for a mailbox provider later. Two SPF TXT records at one name break SPF.
- The From address does not have to be on `send.` — `noreply@mataresit.com` is correct; the
  Return-Path uses `send.mataresit.com`.
- `rua=` needs a mailbox that exists. Until `dmarc@mataresit.com` is real, point it at an address
  you read.
- Click **Verify DNS Records**. Status must read `verified` before any sender change. If it stays
  `pending` past ~10 minutes, re-check the record names — Vercel's form expects `send`, not
  `send.mataresit.com`.

Create a **Sending access** API key named `supabase-auth` for step 4, so the auth path can be
revoked independently of the app-mail key.

## 3. Supabase Auth — URLs, then SMTP

Project `mpmkbtsufihzdelrlszs` → Authentication.

**URL Configuration** (allow-list first, Site URL second):

- Redirect URLs: add `https://mataresit.com/**` and `https://www.mataresit.com/**`.
- Keep `https://mataresit.vercel.app/**` and the localhost entries for at least two weeks.
- Site URL: `https://mataresit.com`.

**Emails → SMTP Settings** — enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS) or `587` (STARTTLS) |
| Username | `resend` |
| Password | the `supabase-auth` Resend API key |
| Sender email | `noreply@mataresit.com` |
| Sender name | `Mataresit` |

Then Authentication → Rate Limits → raise **Emails per hour** from the post-SMTP default of 30
to something matching expected signups.

This is the fix for real-user password resets. Without custom SMTP, Supabase refuses to deliver
to any address that is not an organisation member, and caps sending at 2/hour — no amount of
Site URL or `FROM_EMAIL` work changes that.

Send a test from the SMTP panel to a Gmail address you can inspect, then run a real
"forgot password" from `https://mataresit.com/auth`.

## 4. Supabase Edge Function secrets

Project → Edge Functions → Secrets (or `supabase secrets set` after `supabase login`):

```
FROM_EMAIL=Mataresit <noreply@mataresit.com>
SITE_URL=https://mataresit.com
VAPID_EMAIL=mailto:admin@mataresit.com
BILLING_ALERT_EMAILS=finance@mataresit.com
```

- `FROM_EMAIL` must be `Name <local@domain>`. A URL or a bare hostname is rejected by Resend at
  send time, which is exactly how issue #238 happened.
- `FRONTEND_URL` is optional: `getFrontendUrl()` falls back to `SITE_URL`.
- `RESEND_API_KEY` is already set; rotate it only if you also update every caller.
- Secrets apply to the next invocation; no redeploy is required, but redeploy if the function
  source changed in the same window.

## 5. Vercel — origin switch

- Project `mataresit` → Settings → Environment Variables → Production:
  `VITE_SITE_URL=https://mataresit.com`.
- Redeploy Production. `VITE_*` is inlined at build time; saving the variable alone changes
  nothing.
- Leave `mataresit.vercel.app` assigned as the fallback. Do not remove it in the same change as
  the DNS cutover.

```bash
npx vercel env ls --project mataresit --environment production   # names only
npx vercel redeploy https://mataresit.vercel.app --environment production
```

## 6. Repo changes

Replace the `vercel.app` origin with `https://mataresit.com` in:

- `index.html` — canonical, `og:url`, `og:image`, `twitter:image`
- `public/robots.txt` — Sitemap line
- `public/sitemap.xml` — every `<loc>`
- `src/lib/site-url.ts` and `supabase/functions/_shared/site-url.ts` — `DEFAULT_SITE_URL`
- `src/utils/authErrorHandler.ts` — `RedirectUrlValidator.allowedHosts`
- `src/components/debug/AuthDebugger.tsx` — allowed-origin list
- `src/pages/TermsConditionsPage.tsx` — displayed site URL
- `scripts/monitoring/simple-performance-check.js`, `simple-security-check.js` — `appUrl` default
- `public/docs/api/swagger-ui.html`, `docs/api/swagger-ui.html`, `README.md`, `.env.example`

The legal pages already reference `support@`, `legal@`, `privacy@` and `dpo@mataresit.com`; those
addresses only start working once mailboxes exist (step 7).

## 7. Adjacent platforms

- **Stripe** — Dashboard → Settings → Business → website: `https://mataresit.com`. Checkout
  `success_url` / `cancel_url` come from `getFrontendUrl()`, so the Edge secret covers them. No
  Apple Pay domain registration is needed: the app uses hosted Checkout redirects, not Payment
  Request / Express Checkout.
- **Google Cloud OAuth** — the redirect URI stays `https://<ref>.supabase.co/auth/v1/callback`.
  Add `https://mataresit.com` as an authorised JavaScript origin only if One Tap / GIS is used.
- **Google Search Console** — add a Domain property, verify with the TXT record Vercel DNS hosts,
  submit `https://mataresit.com/sitemap.xml`.
- **Mailboxes** — `support@`, `legal@`, `privacy@`, `dpo@`, `dmarc@` are referenced in product
  copy. Either enable Resend receiving (3 free inboxes, MX at the apex), use registrar
  forwarding, or a mailbox provider. If a provider sets an apex MX and SPF, merge its include
  into that single apex SPF record.

## Verification

```bash
curl -sI https://mataresit.com | head -5                    # 200
curl -sI https://www.mataresit.com | grep -i "^HTTP\|^location"   # 308 -> apex
curl -s https://mataresit.com | grep -i "canonical\|og:url" # mataresit.com
dig +short TXT resend._domainkey.mataresit.com
dig +short TXT send.mataresit.com
dig +short MX  send.mataresit.com
dig +short TXT _dmarc.mataresit.com
```

Email checks, in order of proof strength:

1. Resend dashboard → Emails → the message shows **Delivered**, not just "sent".
2. Received headers show `spf=pass`, `dkim=pass header.d=mataresit.com`,
   `dmarc=pass` and `Return-Path: …@send.mataresit.com`.
3. The visible From is `Mataresit <noreply@mataresit.com>`.
4. `public.email_deliveries` gains a row with `status='sent'` and a non-null
   `provider_message_id` — a mocked send has no provider id.
5. A password reset requested from `https://mataresit.com/auth` arrives for a **non-team**
   address and its link host is `mataresit.com`.

```sql
select id, template_name, status, left(coalesce(error_message,''),160), provider_message_id, created_at
from public.email_deliveries order by created_at desc limit 5;
```

## Rollback

- Keep the `vercel.app` domain assignment and its Supabase allow-list entry: reverting Site URL
  and `VITE_SITE_URL` restores the previous origin without touching DNS.
- If certificate issuance or DNS fails, revert the registrar nameservers to the previous pair;
  nothing else in the stack depends on `mataresit.com` until the Site URL moves.
- Do not remove `mataresit.co`-era assumptions in the same change as the cutover.

## Pitfalls

- **Auth allow-list before Site URL.** Moving Site URL first rejects every redirect to the new
  host until the allow-list catches up.
- **`VITE_SITE_URL` is build-time.** Editing it without a redeploy leaves the old origin in the
  bundle; the page looks fine and links are wrong.
- **Resend `verified` is the only source of truth.** A resolving DNS record is not verification.
- **One SPF record per name.** Adding a second `v=spf1` TXT at the apex or at `send` invalidates
  both.
- **A missing API key can look like success.** `send-email` has a mocked path; always check for a
  provider message id.
- **The apex and `www` are separate Vercel domains.** Add both and set the redirect explicitly;
  Vercel's implicit redirect is not a substitute.
