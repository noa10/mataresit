# Mataresit

A modern web application for automated receipt processing and expense management, powered by AI Vision technology.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Features

- 🤖 **AI-Powered Processing** - Automatic data extraction using Google Gemini
- 📱 **Modern UI** - Built with React, TypeScript, and Tailwind CSS
- 🔒 **Secure Authentication** - Powered by Supabase Auth
- 📊 **Analytics Dashboard** - Track expenses and generate reports
- 🌍 **Multi-language Support** - English and Malay localization
- 📱 **Mobile Responsive** - Works seamlessly on all devices

## Documentation

For detailed documentation, please visit the [docs](./docs) directory:

- [Development Guide](./docs/development/LOCAL_DEVELOPMENT_GUIDE.md)
- [Project Guidelines](./docs/development/MATARESIT_PROJECT_GUIDELINES.md)
- [API Documentation](./docs/api/)
- [Architecture Overview](./docs/architecture/)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Google Gemini 2.0 Flash Lite
- **Authentication**: Supabase Auth with Google OAuth
- **Payments**: Stripe integration

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Google Cloud account (for Gemini API)

### Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and configure your environment variables
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test:integration` - Run integration tests

## Project Structure

```
├── src/                 # Source code
├── docs/               # Documentation
├── scripts/            # Utility scripts
├── tests/              # Test files
├── debug/              # Debug utilities
├── supabase/           # Supabase configuration
└── public/             # Static assets
```

## Deployment

Mataresit uses **Vercel GitHub Integration** for automatic deployments:

- 🚀 **Production**: Automatic deployment on pushes to `main` branch
- 🔍 **Preview**: Automatic preview deployments for all pull requests
- 🔧 **CI/CD**: GitHub Actions handles testing and validation

For detailed deployment information, see [Deployment Documentation](./.github/docs/DEPLOYMENT.md).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions, please check the [documentation](./docs) or open an issue.

