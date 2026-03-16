export const SKILL_ID = 'mataresit-skill';
export const SKILL_VERSION = '0.1.0';

export const REQUIRED_ENV_VARS = Object.freeze([
  'MATARESIT_API_BASE_URL',
  'MATARESIT_API_KEY',
  'MATARESIT_SUPABASE_ACCESS_TOKEN',
]);

export const SUPPORTED_FLOWS = Object.freeze([
  'quick-receipt',
  'receipt-lookup',
  'claims',
  'profile',
  'categories',
  'gamification',
  'team-insights',
]);

export const ROUTE_CATALOG = Object.freeze({
  quickReceipt: Object.freeze({ method: 'POST', path: '/receipts/quick', scopes: ['receipts:write'] }),
  receiptsList: Object.freeze({ method: 'GET', path: '/receipts', scopes: ['receipts:read'] }),
  receiptDetail: Object.freeze({ method: 'GET', path: '/receipts/:receiptId', scopes: ['receipts:read'] }),
  receiptSearch: Object.freeze({ method: 'POST', path: '/search', scopes: ['search:read'] }),
  claimsList: Object.freeze({ method: 'GET', path: '/claims', scopes: ['claims:read'] }),
  claimCreate: Object.freeze({ method: 'POST', path: '/claims', scopes: ['claims:write'] }),
  claimUpdate: Object.freeze({ method: 'PATCH', path: '/claims/:claimId', scopes: ['claims:write'] }),
  profile: Object.freeze({ method: 'GET', path: '/me', scopes: ['profile:read'] }),
  categories: Object.freeze({ method: 'GET', path: '/categories', scopes: ['categories:read'] }),
  analyticsSummary: Object.freeze({ method: 'GET', path: '/analytics/summary', scopes: ['analytics:read'] }),
  analyticsCategories: Object.freeze({ method: 'GET', path: '/analytics/categories', scopes: ['analytics:read'] }),
  gamificationProfile: Object.freeze({ method: 'GET', path: '/gamification/profile', scopes: ['gamification:read'] }),
  gamificationLeaderboard: Object.freeze({ method: 'GET', path: '/gamification/leaderboard', scopes: ['gamification:read'] }),
  teamsList: Object.freeze({ method: 'GET', path: '/teams', scopes: ['teams:read'] }),
  teamStats: Object.freeze({ method: 'GET', path: '/teams/:teamId/stats', scopes: ['teams:read'] }),
});

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const DEFAULT_LEADERBOARD_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 5;
const TEAM_NAME_STOP_WORDS = ['claim', 'claims', 'category', 'categories', 'spending', 'expense', 'expenses', 'stats'];
const FALLBACK_EXAMPLES = Object.freeze([
  'Add a receipt from Quick Stop for RM 12.50',
  'How much did I spend this month?',
  'Find my Starbucks receipt from last month',
  'Create a claim "Client travel" for RM 82.40 for team Finance',
  'Submit claim 11111111-1111-4111-8111-111111111111',
  'Show my profile',
  'List my categories',
  'What is my XP and level?',
  'Show the Malaysia leaderboard for deductible spending',
  'How is team Finance spending this month?',
]);

function getDefaultEnv() {
  return typeof process === 'undefined' ? {} : process.env;
}

export function normalizeApiBaseUrl(apiBaseUrl) {
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.trim().length === 0) {
    throw new Error('MATARESIT_API_BASE_URL must be a non-empty string');
  }

  return apiBaseUrl.trim().replace(/\/+$/, '');
}

export function resolveSkillConfig(env = getDefaultEnv()) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env?.[name]?.trim?.());

  if (missing.length > 0) {
    throw new Error(`Missing required Mataresit skill environment variables: ${missing.join(', ')}`);
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(env.MATARESIT_API_BASE_URL),
    apiKey: env.MATARESIT_API_KEY.trim(),
    accessToken: env.MATARESIT_SUPABASE_ACCESS_TOKEN.trim(),
  };
}

export function buildAuthHeaders(config) {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    'X-API-Key': config.apiKey,
    'Content-Type': 'application/json',
  };
}

export function applyQuickReceiptDefaults(payload = {}) {
  return {
    ...payload,
    date: payload.date ?? toIsoDate(new Date()),
    currency: payload.currency ?? 'MYR',
    status: payload.status ?? 'unreviewed',
  };
}

function interpolatePath(pathTemplate, pathParams = {}) {
  return pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_match, key) => {
    const value = pathParams[key];

    if (value === undefined || value === null || String(value).trim().length === 0) {
      throw new Error(`Missing required path parameter '${key}'`);
    }

    return encodeURIComponent(String(value).trim());
  });
}

async function parseApiResponse(response) {
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : null;
  const message = payload?.message ?? payload?.error?.message ?? response.statusText ?? 'Request failed';

  return {
    ok: response.ok,
    status: response.status,
    payload,
    data: payload?.data ?? null,
    message,
  };
}

export function createApiClient(config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required to create the Mataresit skill API client');
  }

  return {
    async call(routeKey, options = {}) {
      const route = ROUTE_CATALOG[routeKey];

      if (!route) {
        throw new Error(`Unknown Mataresit route key: ${routeKey}`);
      }

      const resolvedPath = interpolatePath(route.path, options.pathParams);
      const url = new URL(resolvedPath.replace(/^\/+/, ''), `${config.apiBaseUrl}/`);

      for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined && value !== null && String(value).trim().length > 0) {
          url.searchParams.set(key, String(value));
        }
      }

      const requestBody = routeKey === 'quickReceipt'
        ? applyQuickReceiptDefaults(options.body ?? {})
        : options.body;

      return fetchImpl(url.toString(), {
        method: route.method,
        headers: {
          ...buildAuthHeaders(config),
          ...(options.headers ?? {}),
        },
        body: route.method === 'GET' || requestBody === undefined
          ? undefined
          : JSON.stringify(requestBody),
      });
    },

    async request(routeKey, options = {}) {
      const response = await this.call(routeKey, options);
      return parseApiResponse(response);
    },
  };
}

export function extractMessageText(event = {}) {
  const candidates = [
    event.message,
    event.input,
    event.text,
    event.prompt,
    event.content,
    event.message?.text,
    event.message?.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return '';
}

export function detectIntent(message) {
  const input = typeof message === 'string' ? message.trim() : '';
  const normalized = input.toLowerCase();
  const claimId = extractUuid(input);
  const amount = extractAmount(input);
  const dateRange = extractDateRange(input);
  const teamHint = extractTeamHint(input);

  if (isQuickReceiptPrompt(normalized)) {
    return {
      name: 'quick-receipt',
      merchant: extractMerchant(input),
      amount,
      date: extractExplicitIsoDate(input),
    };
  }

  if (isClaimPrompt(normalized)) {
    if (/\bsubmit\b/.test(normalized)) {
      return { name: 'claim-submit', claimId };
    }

    if (/\b(update|edit|change|rename|set)\b/.test(normalized)) {
      return {
        name: 'claim-update',
        claimId,
        title: extractClaimTitle(input),
        amount,
        description: extractDescription(input),
        priority: extractPriority(input),
        status: extractClaimStatus(input),
      };
    }

    if (/\b(show|list|find|status)\b/.test(normalized)) {
      return {
        name: 'claim-list',
        status: extractClaimStatus(input),
      };
    }

    return {
      name: 'claim-create',
      title: extractClaimTitle(input),
      amount,
      description: extractDescription(input),
      priority: extractPriority(input),
      category: extractCategory(input),
      teamHint,
    };
  }

  if (isLeaderboardPrompt(normalized)) {
    return {
      name: 'leaderboard',
      metric: extractLeaderboardMetric(input),
      limit: extractLeaderboardLimit(input),
      countryCode: extractCountryCode(input),
    };
  }

  if (isGamificationPrompt(normalized)) {
    return { name: 'gamification-profile' };
  }

  if (isTeamSpendingPrompt(normalized)) {
    return {
      name: 'team-spending',
      teamHint,
    };
  }

  if (isSpendingByCategoryPrompt(normalized)) {
    return {
      name: 'spending-categories',
      dateRange,
    };
  }

  if (isSpendingPrompt(normalized)) {
    return {
      name: 'spending-summary',
      dateRange,
    };
  }

  if (isReceiptPrompt(normalized)) {
    return {
      name: 'receipt-lookup',
      receiptId: extractUuid(input),
      merchant: extractReceiptMerchant(input),
      dateRange,
      status: extractReceiptStatus(input),
      searchMode: /\b(find|search|lookup)\b/.test(normalized),
    };
  }

  if (isProfilePrompt(normalized)) {
    return { name: 'profile' };
  }

  if (isCategoryPrompt(normalized)) {
    return {
      name: 'categories',
      teamHint,
    };
  }

  return { name: 'fallback' };
}

export function buildFallbackReply(input, reason = 'unsupported', extraText = null) {
  const text = extraText ?? [
    'I can help with quick receipt entry, spending summaries, receipt lookup, claim creation or submission, profile checks, categories, XP and leaderboard questions, and team spending.',
    `Try one of these:\n- ${FALLBACK_EXAMPLES.join('\n- ')}`,
  ].join('\n\n');

  return buildReply({
    status: 'fallback',
    intent: 'fallback',
    kind: 'chat',
    input,
    reason,
    text,
    routeKeys: [],
    data: null,
  });
}

function buildReply({
  status,
  intent,
  kind = 'chat',
  input = null,
  text,
  routeKeys = [],
  data = null,
  reason = null,
}) {
  return {
    status,
    kind,
    intent,
    input,
    text,
    reason,
    routeKeys,
    data,
    supportedFlows: [...SUPPORTED_FLOWS],
  };
}

function buildErrorReply(input, intent, routeKeys, message, data = null) {
  return buildReply({
    status: 'error',
    intent,
    kind: 'chat',
    input,
    text: message,
    routeKeys,
    data,
  });
}

function formatApiError(result, fallbackLabel) {
  if (result.status === 403 && /analytics features require/i.test(result.message)) {
    return 'I could not complete that spending query because the analytics endpoint requires a Pro or Max subscription.';
  }

  if (result.status === 404) {
    return `I could not find ${fallbackLabel}.`;
  }

  return `I could not complete that request: ${result.message}.`;
}

function formatCurrency(amount, currency = 'MYR') {
  const numericValue = Number(amount ?? 0);

  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: currency || 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function toIsoDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function startOfWeek(date) {
  const day = date.getUTCDay();
  const delta = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - delta);
  return start;
}

function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isQuickReceiptPrompt(text) {
  return /\b(add|log|save|record|create|capture)\b/.test(text) && /\breceipt\b/.test(text);
}

function isClaimPrompt(text) {
  return /\bclaims?\b/.test(text);
}

function isProfilePrompt(text) {
  return /\b(profile|account|subscription|plan|connected)\b/.test(text);
}

function isCategoryPrompt(text) {
  return /\bcategories\b|\bcategory list\b|\bshow categories\b/.test(text);
}

function isGamificationPrompt(text) {
  return /\b(xp|level|badge|badges|streak|gamification)\b/.test(text);
}

function isLeaderboardPrompt(text) {
  return /\bleaderboard\b|\branking\b|\btop\s+\d+\b/.test(text);
}

function isTeamSpendingPrompt(text) {
  return /\bteam\b/.test(text) && /\b(spend|spent|spending|expense|expenses|stats?)\b/.test(text);
}

function isSpendingByCategoryPrompt(text) {
  return /\b(spend|spent|spending|expense|expenses)\b/.test(text) && /\bcategories\b|\bcategory\s+breakdown\b|\bby category\b/.test(text);
}

function isSpendingPrompt(text) {
  return /\b(spend|spent|spending|expense|expenses|analytics)\b/.test(text);
}

function isReceiptPrompt(text) {
  return (/(\breceipt\b|\breceipts\b)/.test(text) && /\b(find|show|list|lookup|search|recent|latest|status|from|at|merchant|id)\b/.test(text))
    || UUID_PATTERN.test(text);
}

function extractAmount(text) {
  const match = text.match(/(?:rm|myr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    ?? text.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rm|myr)/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractUuid(text) {
  return text.match(UUID_PATTERN)?.[0] ?? null;
}

function extractQuotedText(text) {
  return text.match(/["“”']([^"“”']{3,})["“”']/)?.[1]?.trim() ?? null;
}

function extractClaimTitle(text) {
  const quoted = extractQuotedText(text);
  if (quoted) {
    return quoted;
  }

  const match = text.match(/claim(?:\s+titled|\s+called)?\s+([A-Za-z0-9&().,'\-\s]{3,}?)\s+(?:for|worth|amounting)/i);
  return match?.[1]?.trim() ?? null;
}

function extractDescription(text) {
  const match = text.match(/description\s+["“”']?([^"“”']+?)(?:["“”']?$|\s+priority\b|\s+for\s+team\b)/i);
  return match?.[1]?.trim() ?? null;
}

function extractPriority(text) {
  return text.match(/\b(low|medium|high|urgent)\b/i)?.[1]?.toLowerCase() ?? null;
}

function extractClaimStatus(text) {
  return text.match(/\b(draft|submitted|under_review|approved|rejected|paid)\b/i)?.[1]?.toLowerCase() ?? null;
}

function extractCategory(text) {
  return text.match(/category\s+["“”']?([A-Za-z0-9&().\-\s]{2,})/i)?.[1]?.trim() ?? null;
}

function extractMerchant(text) {
  const match = text.match(/(?:receipt\s+from|receipt\s+at|from|at)\s+([A-Za-z0-9&().,'\-\s]{2,}?)(?=\s+(?:for|worth|today|yesterday|on)\b|$)/i);
  return match?.[1]?.trim() ?? null;
}

function extractReceiptMerchant(text) {
  const match = text.match(/(?:receipt(?:s)?\s+from|receipt(?:s)?\s+at|from|at)\s+([A-Za-z0-9&().,'\-\s]{2,}?)(?=\s+(?:this|last|on|status|for\s+rm|for\s+myr|$))/i);
  return match?.[1]?.trim() ?? null;
}

function extractTeamHint(text) {
  const match = text.match(/team\s+["“”']?([A-Za-z0-9&().,'\-\s]{2,}?)(?=$|\s+(?:for|with|spending|expenses|stats|claim|claims|categories))/i);
  const candidate = match?.[1]?.trim();

  if (!candidate) {
    return null;
  }

  const normalized = candidate.toLowerCase();
  if (TEAM_NAME_STOP_WORDS.includes(normalized)) {
    return null;
  }

  return candidate;
}

function extractReceiptStatus(text) {
  return text.match(/\b(unreviewed|reviewed|synced|draft|submitted|approved|rejected|paid)\b/i)?.[1]?.toLowerCase() ?? null;
}

function extractExplicitIsoDate(text) {
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  if (/\byesterday\b/i.test(text)) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return toIsoDate(date);
  }

  if (/\btoday\b/i.test(text)) {
    return toIsoDate(new Date());
  }

  return null;
}

function extractDateRange(text) {
  const now = new Date();

  if (/\blast month\b/i.test(text)) {
    const reference = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return { startDate: toIsoDate(startOfMonth(reference)), endDate: toIsoDate(endOfMonth(reference)) };
  }

  if (/\bthis month\b/i.test(text)) {
    return { startDate: toIsoDate(startOfMonth(now)), endDate: toIsoDate(endOfMonth(now)) };
  }

  if (/\blast week\b/i.test(text)) {
    const reference = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
    return { startDate: toIsoDate(startOfWeek(reference)), endDate: toIsoDate(endOfWeek(reference)) };
  }

  if (/\bthis week\b/i.test(text)) {
    return { startDate: toIsoDate(startOfWeek(now)), endDate: toIsoDate(endOfWeek(now)) };
  }

  if (/\btoday\b/i.test(text)) {
    const today = toIsoDate(now);
    return { startDate: today, endDate: today };
  }

  if (/\byesterday\b/i.test(text)) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const iso = toIsoDate(date);
    return { startDate: iso, endDate: iso };
  }

  return null;
}

function extractLeaderboardMetric(text) {
  const normalized = text.toLowerCase();

  if (normalized.includes('deductible')) {
    return 'deductible_total';
  }

  if (normalized.includes('receipt')) {
    return 'monthly_receipts';
  }

  return 'weekly_xp';
}

function extractLeaderboardLimit(text) {
  const match = text.match(/\btop\s+(\d{1,2})\b/i);
  if (!match) {
    return DEFAULT_LEADERBOARD_LIMIT;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10) : DEFAULT_LEADERBOARD_LIMIT;
}

function extractCountryCode(text) {
  if (/\bmalaysia\b/i.test(text)) {
    return 'MY';
  }

  if (/\bsingapore\b/i.test(text)) {
    return 'SG';
  }

  return text.match(/country\s+code\s+([A-Za-z]{2})/i)?.[1]?.toUpperCase() ?? null;
}

function matchTeamByHint(teams, teamHint) {
  const normalizedHint = teamHint.toLowerCase();

  return teams.find((team) => team.name?.toLowerCase() === normalizedHint)
    ?? teams.find((team) => team.name?.toLowerCase().includes(normalizedHint));
}

async function resolveTeamForPrompt(skill, input, teamHint, purpose) {
  const result = await skill.apiClient.request('teamsList');

  if (!result.ok) {
    return {
      reply: buildErrorReply(input, 'team-resolution', ['teamsList'], formatApiError(result, 'your teams'), result.payload),
    };
  }

  const teams = Array.isArray(result.data?.teams) ? result.data.teams : [];

  if (teams.length === 0) {
    return {
      reply: buildFallbackReply(
        input,
        'missing-team',
        `I could not find any teams on your account, so I cannot ${purpose} yet. If you meant a personal flow, try a non-team prompt instead.`,
      ),
    };
  }

  if (teamHint) {
    const team = matchTeamByHint(teams, teamHint);

    if (!team) {
      const teamNames = teams.map((entry) => entry.name).filter(Boolean).join(', ');
      return {
        reply: buildFallbackReply(
          input,
          'unknown-team',
          `I could not match "${teamHint}" to one of your teams. Available teams: ${teamNames}.`,
        ),
      };
    }

    return { team, routeKeys: ['teamsList'] };
  }

  if (teams.length === 1) {
    return { team: teams[0], routeKeys: ['teamsList'] };
  }

  const teamNames = teams.map((entry) => entry.name).filter(Boolean).join(', ');
  return {
    reply: buildFallbackReply(
      input,
      'ambiguous-team',
      `I can help with ${purpose}, but I need the team name because you have multiple teams: ${teamNames}.`,
    ),
  };
}

function formatReceiptLine(receipt) {
  return `- ${receipt.merchant || 'Unknown merchant'} — ${formatCurrency(receipt.total, receipt.currency || 'MYR')} on ${formatDate(receipt.date)}`;
}

function formatClaimLine(claim) {
  return `- ${claim.title || 'Untitled claim'} — ${formatCurrency(claim.amount, claim.currency || 'MYR')} (${claim.status || 'draft'})`;
}

function formatLeaderboardValue(entry) {
  if (entry.metric === 'deductible_total') {
    return formatCurrency(entry.value, 'MYR');
  }

  if (entry.metric === 'monthly_receipts') {
    return `${entry.value} receipts`;
  }

  return `${entry.value} XP`;
}

async function handleQuickReceipt(skill, input, intent) {
  if (!intent.merchant || intent.amount === null) {
    return buildFallbackReply(
      input,
      'missing-fields',
      'To save a quick receipt, tell me both the merchant and amount, for example: "Add a receipt from Quick Stop for RM 12.50".',
    );
  }

  const body = {
    merchant: intent.merchant,
    total: intent.amount,
    ...(intent.date ? { date: intent.date } : {}),
  };
  const result = await skill.apiClient.request('quickReceipt', { body });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['quickReceipt'], formatApiError(result, 'that receipt'), result.payload);
  }

  const receipt = result.data ?? {};
  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['quickReceipt'],
    data: result.payload,
    text: [
      `Saved your receipt for ${formatCurrency(receipt.total ?? intent.amount, receipt.currency ?? 'MYR')} at ${receipt.merchant ?? intent.merchant}.`,
      `Date: ${formatDate(receipt.date ?? body.date ?? toIsoDate(new Date()))}.`,
      `Status: ${(receipt.status ?? 'unreviewed').replace(/_/g, ' ')}.`,
    ].join(' '),
  });
}

async function handleSpendingSummary(skill, input, intent, routeKey) {
  const query = {
    start_date: intent.dateRange?.startDate,
    end_date: intent.dateRange?.endDate,
    currency: 'MYR',
  };
  const result = await skill.apiClient.request(routeKey, { query });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, [routeKey], formatApiError(result, 'that spending summary'), result.payload);
  }

  if (routeKey === 'analyticsCategories') {
    const categories = Array.isArray(result.data?.categories) ? result.data.categories : [];

    if (categories.length === 0) {
      return buildReply({
        status: 'success',
        intent: intent.name,
        input,
        routeKeys: [routeKey],
        data: result.payload,
        text: 'I did not find any category spending for that period.',
      });
    }

    const topCategories = categories.slice(0, 3).map((entry) => (
      `- ${entry.category}: ${formatCurrency(entry.amount, 'MYR')} across ${entry.count} receipts`
    )).join('\n');

    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: [routeKey],
      data: result.payload,
      text: [
        `Here is your category breakdown for ${result.data?.period ?? 'the selected period'}:`,
        `Total: ${formatCurrency(result.data?.totalAmount, 'MYR')} across ${result.data?.totalReceipts ?? 0} receipts.`,
        topCategories,
      ].join('\n'),
    });
  }

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: [routeKey],
    data: result.payload,
    text: [
      `You spent ${formatCurrency(result.data?.totalAmount, result.data?.currency ?? 'MYR')} across ${result.data?.totalReceipts ?? 0} receipts for ${result.data?.period ?? 'the selected period'}.`,
      `Average receipt: ${formatCurrency(result.data?.averageAmount, result.data?.currency ?? 'MYR')}.`,
      result.data?.previousPeriodChange
        ? `Change versus the previous period: ${formatCurrency(result.data.previousPeriodChange.amount, result.data?.currency ?? 'MYR')} (${Number(result.data.previousPeriodChange.percentage ?? 0).toFixed(1)}%).`
        : null,
    ].filter(Boolean).join(' '),
  });
}

async function handleReceiptLookup(skill, input, intent) {
  if (intent.receiptId) {
    const result = await skill.apiClient.request('receiptDetail', {
      pathParams: { receiptId: intent.receiptId },
    });

    if (!result.ok) {
      return buildErrorReply(input, intent.name, ['receiptDetail'], formatApiError(result, 'that receipt'), result.payload);
    }

    const receipt = result.data ?? {};
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: ['receiptDetail'],
      data: result.payload,
      text: [
        `Receipt ${receipt.id ?? intent.receiptId}: ${receipt.merchant || 'Unknown merchant'} for ${formatCurrency(receipt.total, receipt.currency || 'MYR')}.`,
        `Date: ${formatDate(receipt.date)}.`,
        receipt.status ? `Status: ${receipt.status.replace(/_/g, ' ')}.` : null,
      ].filter(Boolean).join(' '),
    });
  }

  if (intent.searchMode && !intent.merchant && !intent.dateRange && !intent.status) {
    const result = await skill.apiClient.request('receiptSearch', {
      body: {
        query: input,
        sources: ['receipts'],
        limit: SEARCH_RESULT_LIMIT,
      },
    });

    if (!result.ok) {
      return buildErrorReply(input, intent.name, ['receiptSearch'], formatApiError(result, 'matching receipts'), result.payload);
    }

    const results = Array.isArray(result.data?.results) ? result.data.results : [];

    if (results.length === 0) {
      return buildReply({
        status: 'success',
        intent: intent.name,
        input,
        routeKeys: ['receiptSearch'],
        data: result.payload,
        text: 'I could not find any matching receipts for that search.',
      });
    }

    const lines = results.slice(0, 3).map((entry) => `- ${entry.title || 'Untitled result'}${entry.highlights?.[0] ? ` — ${entry.highlights[0]}` : ''}`);
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: ['receiptSearch'],
      data: result.payload,
      text: `I found these receipt search matches:\n${lines.join('\n')}`,
    });
  }

  const result = await skill.apiClient.request('receiptsList', {
    query: {
      merchant: intent.merchant,
      status: intent.status,
      start_date: intent.dateRange?.startDate,
      end_date: intent.dateRange?.endDate,
      limit: SEARCH_RESULT_LIMIT,
    },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['receiptsList'], formatApiError(result, 'matching receipts'), result.payload);
  }

  const receipts = Array.isArray(result.data?.receipts) ? result.data.receipts : [];

  if (receipts.length === 0) {
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: ['receiptsList'],
      data: result.payload,
      text: 'I could not find any receipts that match that request.',
    });
  }

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['receiptsList'],
    data: result.payload,
    text: `Here are the closest receipt matches:\n${receipts.slice(0, 5).map(formatReceiptLine).join('\n')}`,
  });
}

async function handleClaimCreate(skill, input, intent) {
  if (!intent.title || intent.amount === null) {
    return buildFallbackReply(
      input,
      'missing-claim-fields',
      'To create a claim, tell me the claim title, amount, and team, for example: Create a claim "Client travel" for RM 82.40 for team Finance.',
    );
  }

  const teamResolution = await resolveTeamForPrompt(skill, input, intent.teamHint, 'create that claim');
  if (teamResolution.reply) {
    return teamResolution.reply;
  }

  const routeKeys = [...(teamResolution.routeKeys ?? []), 'claimCreate'];
  const result = await skill.apiClient.request('claimCreate', {
    body: {
      teamId: teamResolution.team.id,
      title: intent.title,
      amount: intent.amount,
      currency: 'MYR',
      description: intent.description,
      priority: intent.priority,
      category: intent.category,
    },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, routeKeys, formatApiError(result, 'that claim'), result.payload);
  }

  const claim = result.data ?? {};
  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys,
    data: result.payload,
    text: `Created claim "${claim.title ?? intent.title}" for ${formatCurrency(claim.amount ?? intent.amount, claim.currency ?? 'MYR')} under team ${teamResolution.team.name}. Current status: ${claim.status ?? 'draft'}.`,
  });
}

async function handleClaimUpdate(skill, input, intent, submitOnly = false) {
  if (!intent.claimId) {
    return buildFallbackReply(
      input,
      'missing-claim-id',
      `Please include the claim ID so I can ${submitOnly ? 'submit' : 'update'} it safely.`,
    );
  }

  const body = submitOnly
    ? { status: 'submitted' }
    : {
        ...(intent.title ? { title: intent.title } : {}),
        ...(intent.amount !== null ? { amount: intent.amount } : {}),
        ...(intent.description ? { description: intent.description } : {}),
        ...(intent.priority ? { priority: intent.priority } : {}),
        ...(intent.status ? { status: intent.status } : {}),
      };

  if (!submitOnly && Object.keys(body).length === 0) {
    return buildFallbackReply(
      input,
      'missing-claim-update',
      'Tell me what to change on the claim, such as a new title, amount, description, or status.',
    );
  }

  const result = await skill.apiClient.request('claimUpdate', {
    pathParams: { claimId: intent.claimId },
    body,
  });

  if (!result.ok) {
    return buildErrorReply(input, submitOnly ? 'claim-submit' : intent.name, ['claimUpdate'], formatApiError(result, 'that claim'), result.payload);
  }

  const claim = result.data ?? {};
  return buildReply({
    status: 'success',
    intent: submitOnly ? 'claim-submit' : intent.name,
    input,
    routeKeys: ['claimUpdate'],
    data: result.payload,
    text: submitOnly
      ? `Submitted claim "${claim.title ?? intent.claimId}". New status: ${claim.status ?? 'submitted'}.`
      : `Updated claim "${claim.title ?? intent.claimId}". Current status: ${claim.status ?? 'draft'}.`,
  });
}

async function handleClaimList(skill, input, intent) {
  const result = await skill.apiClient.request('claimsList', {
    query: {
      status: intent.status,
      limit: SEARCH_RESULT_LIMIT,
    },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['claimsList'], formatApiError(result, 'matching claims'), result.payload);
  }

  const claims = Array.isArray(result.data?.claims) ? result.data.claims : [];

  if (claims.length === 0) {
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: ['claimsList'],
      data: result.payload,
      text: 'I could not find any claims that match that request.',
    });
  }

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['claimsList'],
    data: result.payload,
    text: `Here are the latest matching claims:\n${claims.slice(0, 5).map(formatClaimLine).join('\n')}`,
  });
}

async function handleProfile(skill, input, intent) {
  const result = await skill.apiClient.request('profile');

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['profile'], formatApiError(result, 'your profile'), result.payload);
  }

  const user = result.data?.user ?? {};
  const subscription = result.data?.subscription ?? {};
  const teams = Array.isArray(result.data?.teams) ? result.data.teams : [];
  const teamNames = teams.map((entry) => entry.team?.name).filter(Boolean);

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['profile'],
    data: result.payload,
    text: [
      `${user.displayName ?? user.email ?? 'Your account'} is connected as ${user.email ?? 'unknown email'}.`,
      `Plan: ${subscription.tier ?? 'free'} (${subscription.status ?? 'active'}).`,
      `Preferred currency: ${user.preferredCurrency ?? 'MYR'}.`,
      `Receipts used this month: ${subscription.receiptsUsedThisMonth ?? 0}.`,
      teamNames.length > 0 ? `Teams: ${teamNames.join(', ')}.` : 'No team memberships found.',
    ].join(' '),
  });
}

async function handleCategories(skill, input, intent) {
  let teamResolution = null;
  const routeKeys = [];
  let teamId = null;

  if (intent.teamHint) {
    teamResolution = await resolveTeamForPrompt(skill, input, intent.teamHint, 'look up those categories');
    if (teamResolution.reply) {
      return teamResolution.reply;
    }

    teamId = teamResolution.team.id;
    routeKeys.push(...(teamResolution.routeKeys ?? []));
  }

  const result = await skill.apiClient.request('categories', {
    query: { team_id: teamId },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, [...routeKeys, 'categories'], formatApiError(result, 'those categories'), result.payload);
  }

  const categories = Array.isArray(result.data?.categories) ? result.data.categories : [];

  if (categories.length === 0) {
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: [...routeKeys, 'categories'],
      data: result.payload,
      text: teamResolution?.team?.name
        ? `I did not find any categories for team ${teamResolution.team.name}.`
        : 'I did not find any categories yet.',
    });
  }

  const lines = categories.slice(0, 10).map((category) => (
    `- ${category.name} (${category.receiptCount} receipts${category.isTeamCategory ? ', team category' : ''})`
  ));

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: [...routeKeys, 'categories'],
    data: result.payload,
    text: `Here are your ${teamResolution?.team?.name ? `${teamResolution.team.name} ` : ''}categories:\n${lines.join('\n')}`,
  });
}

async function handleGamificationProfile(skill, input, intent) {
  const result = await skill.apiClient.request('gamificationProfile');

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['gamificationProfile'], formatApiError(result, 'your XP profile'), result.payload);
  }

  const profile = result.data?.profile ?? {};
  const badgeSummary = result.data?.badgeSummary ?? {};

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['gamificationProfile'],
    data: result.payload,
    text: [
      `You are level ${profile.currentLevel ?? 1} with ${profile.totalXp ?? 0} XP.`,
      `Progress to next level: ${Number(profile.progressPercent ?? 0).toFixed(1)}%.`,
      `Login streak: ${profile.loginStreakDays ?? 0} days. Scan streak: ${profile.scanStreakDays ?? 0} days.`,
      `Badges unlocked: ${badgeSummary.totalUnlocked ?? 0}.`,
    ].join(' '),
  });
}

async function handleLeaderboard(skill, input, intent) {
  const result = await skill.apiClient.request('gamificationLeaderboard', {
    query: {
      metric: intent.metric,
      limit: intent.limit,
      country_code: intent.countryCode,
    },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, ['gamificationLeaderboard'], formatApiError(result, 'that leaderboard'), result.payload);
  }

  const entries = Array.isArray(result.data?.entries) ? result.data.entries : [];

  if (entries.length === 0) {
    return buildReply({
      status: 'success',
      intent: intent.name,
      input,
      routeKeys: ['gamificationLeaderboard'],
      data: result.payload,
      text: 'I could not find any leaderboard entries for that request.',
    });
  }

  const lines = entries.slice(0, intent.limit ?? DEFAULT_LEADERBOARD_LIMIT).map((entry) => (
    `- #${entry.rank} ${entry.displayName}: ${formatLeaderboardValue(entry)}${entry.isCurrentUser ? ' (you)' : ''}`
  )).join('\n');
  const viewerEntry = result.data?.viewerEntry;

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: ['gamificationLeaderboard'],
    data: result.payload,
    text: [
      `Leaderboard metric: ${intent.metric.replace(/_/g, ' ')}${intent.countryCode ? ` in ${intent.countryCode}` : ''}.`,
      lines,
      viewerEntry ? `Your current rank is #${viewerEntry.rank} with ${formatLeaderboardValue(viewerEntry)}.` : null,
    ].filter(Boolean).join('\n'),
  });
}

async function handleTeamSpending(skill, input, intent) {
  const teamResolution = await resolveTeamForPrompt(skill, input, intent.teamHint, 'answer that team spending question');
  if (teamResolution.reply) {
    return teamResolution.reply;
  }

  const result = await skill.apiClient.request('teamStats', {
    pathParams: { teamId: teamResolution.team.id },
  });

  if (!result.ok) {
    return buildErrorReply(input, intent.name, [...(teamResolution.routeKeys ?? []), 'teamStats'], formatApiError(result, 'that team spending summary'), result.payload);
  }

  const stats = result.data ?? {};
  const recentActivity = Array.isArray(stats.recentActivity) ? stats.recentActivity.slice(0, 2) : [];

  return buildReply({
    status: 'success',
    intent: intent.name,
    input,
    routeKeys: [...(teamResolution.routeKeys ?? []), 'teamStats'],
    data: result.payload,
    text: [
      `${teamResolution.team.name} has ${stats.totalReceipts ?? 0} receipts worth ${formatCurrency(stats.totalAmount, stats.currency || 'MYR')}.`,
      `Claims: ${stats.totalClaims ?? 0}. Active members: ${stats.activeMembers ?? 0}.`,
      recentActivity.length > 0 ? `Recent activity:\n${recentActivity.map((entry) => `- ${entry.description}`).join('\n')}` : null,
    ].filter(Boolean).join(' '),
  });
}

export async function handleSkillEvent(event = {}, { apiClient } = {}) {
  const input = extractMessageText(event);

  if (!input) {
    return buildFallbackReply('', 'missing-message', 'Please send a message so I can help with receipts, spending, claims, profile checks, categories, XP, leaderboards, or team spending.');
  }

  const intent = detectIntent(input);

  switch (intent.name) {
    case 'quick-receipt':
      return handleQuickReceipt({ apiClient }, input, intent);
    case 'spending-summary':
      return handleSpendingSummary({ apiClient }, input, intent, 'analyticsSummary');
    case 'spending-categories':
      return handleSpendingSummary({ apiClient }, input, intent, 'analyticsCategories');
    case 'receipt-lookup':
      return handleReceiptLookup({ apiClient }, input, intent);
    case 'claim-create':
      return handleClaimCreate({ apiClient }, input, intent);
    case 'claim-update':
      return handleClaimUpdate({ apiClient }, input, intent, false);
    case 'claim-submit':
      return handleClaimUpdate({ apiClient }, input, intent, true);
    case 'claim-list':
      return handleClaimList({ apiClient }, input, intent);
    case 'profile':
      return handleProfile({ apiClient }, input, intent);
    case 'categories':
      return handleCategories({ apiClient }, input, intent);
    case 'gamification-profile':
      return handleGamificationProfile({ apiClient }, input, intent);
    case 'leaderboard':
      return handleLeaderboard({ apiClient }, input, intent);
    case 'team-spending':
      return handleTeamSpending({ apiClient }, input, intent);
    default:
      return buildFallbackReply(input);
  }
}

export function createMataresitSkill({ env = getDefaultEnv(), fetchImpl = globalThis.fetch } = {}) {
  const config = resolveSkillConfig(env);
  const apiClient = createApiClient(config, fetchImpl);

  return {
    id: SKILL_ID,
    version: SKILL_VERSION,
    description: 'OpenClaw skill for Mataresit external API v1 chat flows.',
    requiredEnvVars: [...REQUIRED_ENV_VARS],
    supportedFlows: [...SUPPORTED_FLOWS],
    routes: ROUTE_CATALOG,
    config,
    apiClient,
    async handle(event = {}) {
      return handleSkillEvent(event, { apiClient });
    },
  };
}

export default createMataresitSkill;