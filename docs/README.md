# Mataresit documentation

This directory contains user guides, technical references, implementation notes, and operational material for Mataresit.

The [root README](../README.md) is the canonical product and setup overview. Use the source code and current configuration as the source of truth when an older document conflicts with it.

The current temporary hosted frontend is [https://mataresit.vercel.app](https://mataresit.vercel.app); update this reference when the final canonical domain is selected.

## Start here

- [Root README](../README.md) — product overview, architecture, setup, deployment model, and contribution guidance
- [GitHub automation overview](../.github/workflows/README.md) — active CI, security, monitoring, and Supabase validation workflows
- [User guides](./user-guides/README.md) — historical and task-oriented product documentation
- [Architecture notes](./architecture/) — design and implementation references
- [API specification](./api/openapi.yaml) — draft external API contract; verify the deployment URL and versioning before using it
- [Supabase Edge Functions](../supabase/functions/) — server-side processing, search, billing, and notification functions
- [Tests](../tests/) — unit, integration, end-to-end, alerting, and queue suites

## Documentation areas

| Area | Location | Notes |
| --- | --- | --- |
| User onboarding | `user-guides/en/onboarding/` | Product walkthroughs; some content predates the current UI |
| Core features | `user-guides/en/core-features/` | Receipt capture, search, reporting, and platform notes |
| Team workflows | `user-guides/en/team-collaboration/` | Teams, roles, claims, and collaboration |
| AI and localization | `user-guides/en/ai-intelligence/` | Search, Malaysian business context, and notifications |
| Development | `development/` | Local setup and project conventions; review environment-safety notes before use |
| Architecture | `architecture/` | Receipt-processing and system design references |
| API | `api/` | External API specification and integration notes |
| Deployment and operations | `deployment/`, `monitoring/`, `troubleshooting/` | Maintainer and operational material |

## Documentation status

The documentation tree contains material written for multiple versions of Mataresit, including references to the former Paperless Maverick name and older deployment approaches. Those references are retained for historical context until they are reviewed and updated.

When adding or changing documentation:

- Use `Mataresit` consistently for the current product.
- Link to existing files and verify the target exists.
- Do not publish credentials, production data, or private infrastructure details.
- Mark experimental or plan-dependent features clearly.
- Update both English and Bahasa Malaysia translations when changing user-facing product copy.
