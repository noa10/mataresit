# Mataresit

<p align="center">
  <img src="./public/mataresit-icon.png" alt="Mataresit Logo" width="120">
</p>

<p align="center">
  <strong>AI-Powered Receipt Processing & Expense Management</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## What is Mataresit?

Mataresit is a modern, AI-powered web application that automates receipt processing and expense management. Using advanced AI Vision technology (Google Gemini), it extracts data from receipt images instantly, eliminating manual data entry and helping businesses and individuals track expenses effortlessly.

### Key Benefits

- ⏱️ **Save 5+ hours per week** - No more manual receipt entry
- 🎯 **99% accuracy** - AI-powered data extraction with confidence scoring
- 🔍 **Smart search** - Find any receipt instantly with semantic search
- 💰 **Maximize tax deductions** - Never miss a deductible expense
- 👥 **Team collaboration** - Share and manage expenses with your team
- 🔒 **Bank-grade security** - Your data is encrypted and secure

## Features

### AI-Powered Receipt Processing

- 🤖 **Intelligent Data Extraction** - Google Gemini 2.0 Flash Lite analyzes receipt images and extracts merchant, date, total, items, and more
- 📸 **Batch Upload** - Process multiple receipts simultaneously
- 🎯 **Confidence Scoring** - Visual indicators highlight fields that need verification
- ✏️ **Smart Verification** - Side-by-side image and data editor with AI suggestions

### Advanced Analytics & Reporting

- 📊 **Expense Dashboard** - Visual insights into spending patterns
- 📈 **Trend Analysis** - Track spending over time with interactive charts
- 📑 **Automated Reports** - Generate daily, weekly, or monthly PDF reports
- 📤 **Export Options** - Export to PDF, Excel (CSV), or JSON

### Smart Search & Organization

- 🔍 **Semantic Search** - Search by description, merchant, or content meaning
- 🏷️ **Auto-Categorization** - AI suggests expense categories automatically
- 📁 **Custom Categories** - Create and manage your own category system
- 🏢 **Merchant Normalization** - Standardizes merchant names automatically

### Team Collaboration

- 👥 **Team Management** - Create teams and invite members
- 🔐 **Role-Based Access** - Admin, manager, and member permissions
- 📝 **Claims Workflow** - Submit and approve expense claims
- 📧 **Email Notifications** - Real-time alerts for team activities

### Multi-Language & Accessibility

- 🌍 **Bilingual Support** - English and Malay (Bahasa Malaysia) interfaces
- 📱 **Mobile Responsive** - Works seamlessly on desktop, tablet, and mobile
- 🌓 **Dark/Light Mode** - Comfortable viewing in any environment
- ♿ **Accessibility** - WCAG-compliant design

### Security & Compliance

- 🔒 **Supabase Auth** - Secure authentication with Google OAuth support
- 🛡️ **Row Level Security** - Data isolation at the database level
- 🔐 **Encrypted Storage** - All data encrypted at rest and in transit
- ✅ **GDPR Ready** - Privacy-compliant data handling

### Admin & Monitoring

- 🎛️ **Admin Dashboard** - User management and system analytics
- 📡 **Real-time Monitoring** - System health and performance metrics
- 🚨 **Alert System** - Configurable notifications for critical events
- 📈 **Usage Analytics** - Track API quotas and system usage

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + Radix UI + Framer Motion |
| **State Management** | TanStack Query (React Query) |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **AI/ML** | Google Gemini 2.0 Flash Lite + Groq (Llama 4 Scout) |
| **Authentication** | Supabase Auth + Google OAuth 2.0 |
| **Payments** | Stripe (Subscriptions & One-time) |
| **Testing** | Vitest + Playwright |
| **Deployment** | Vercel + GitHub Actions CI/CD |

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account (free tier works)
- **Google Cloud** account (for Gemini API - free tier available)
- **Stripe** account (for payments - test mode for development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mataresit.git
cd mataresit

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key

# Optional: Disable real-time features in development
# VITE_DISABLE_REALTIME=false

# Backend secrets are configured in Supabase Edge Functions (not in .env.local)
# Example: GROQ_API_KEY
```

See [.env.example](./.env.example) for the complete list of configuration options.

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run preview          # Preview production build locally

# Code Quality
npm run lint             # Run ESLint

# Testing
npm run test             # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests
```

## Project Structure

```
mataresit/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (auth, language, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions and configurations
│   ├── pages/          # Route pages
│   ├── services/       # API and business logic services
│   └── types/          # TypeScript type definitions
├── docs/               # Comprehensive documentation
├── scripts/            # Build and utility scripts
├── tests/              # Test suites
├── supabase/           # Supabase configuration and migrations
└── public/             # Static assets
```

## Documentation

We maintain extensive documentation for developers, administrators, and end users:

### For Users
- [5-Minute Quick Start](./docs/user-guides/en/onboarding/quick-start-5min.md)
- [New User Guide](./docs/user-guides/en/onboarding/new-user-guide.md)
- [Core Features Guide](./docs/user-guides/en/core-features/)
- [Team Collaboration](./docs/user-guides/en/team-collaboration/)

### For Developers
- [Local Development Guide](./docs/development/LOCAL_DEVELOPMENT_GUIDE.md)
- [Project Guidelines](./docs/development/MATARESIT_PROJECT_GUIDELINES.md)
- [Architecture Overview](./docs/architecture/)
- [API Reference](./docs/api/)

### For Administrators
- [Deployment Guide](./.github/docs/DEPLOYMENT.md)
- [Monitoring Setup](./docs/MONITORING_SETUP_GUIDE.md)
- [Troubleshooting Guide](./docs/troubleshooting/)
- [Security Implementation](./docs/SECURITY_IMPLEMENTATION.md)

### Complete Documentation Index
📚 [View Full Documentation Index](./docs/DOCUMENTATION_INDEX.md)

## Deployment

Mataresit is optimized for **Vercel** deployment with automatic CI/CD:

- 🚀 **Production**: Auto-deploy on pushes to `main` branch
- 🔍 **Preview**: Automatic preview deployments for pull requests
- 🔧 **CI/CD**: GitHub Actions run tests, linting, and security scans

### Deployment Checklist

1. Set up Supabase project with required tables and RLS policies
2. Configure environment variables in Vercel
3. Set up Stripe webhooks
4. Configure Google OAuth credentials
5. Deploy and verify

See [Deployment Documentation](./.github/docs/DEPLOYMENT.md) for detailed instructions.

## Pricing

Mataresit offers flexible pricing for individuals and teams:

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/month | 50 receipts/month, basic features |
| **Pro** | $9/month | Unlimited receipts, team features, analytics |
| **Max** | $29/month | Everything in Pro + priority support, API access |

See [Pricing Page](./src/pages/PricingPage.tsx) or visit our [live demo](https://mataresit.com/pricing) for full details.

## Contributing

We welcome contributions from the community!

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details on our code of conduct and development process.

## Support

- 📖 [Documentation](./docs)
- 🐛 [Issue Tracker](../../issues)
- 💬 [Discussions](../../discussions)
- 📧 Email: support@mataresit.com

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI Vision capabilities
- [Supabase](https://supabase.com/) for backend infrastructure
- [Vercel](https://vercel.com/) for hosting and deployment
- [Stripe](https://stripe.com/) for payment processing
- [Radix UI](https://www.radix-ui.com/) for accessible components

---

<p align="center">
  Made with ❤️ for efficient expense management
</p>
