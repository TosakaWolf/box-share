const DEEPWIKI_QUERY_API = 'https://api.devin.ai/ada/query';
const DEEPWIKI_SEARCH_BASE = 'https://deepwiki.com/search/';
const QUERY_SOURCE = 'ada.deepwiki_public';
const DEFAULT_REPO = 'MaaAssistantArknights/MaaAssistantArknights';
const ALLOWED_MODES = new Set(['fast', 'deep', 'codemap']);

export const API_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
};

type DeepWikiRequestBody = {
  mode?: string;
  user_query?: string;
  question?: string;
  keywords?: unknown;
  repo_names?: unknown;
  repoName?: string;
  additional_context?: string;
  query_id?: string;
  queryId?: string;
  attached_context?: unknown;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...API_CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function buildRedirectUrl(queryId: string, mode: string): string {
  return `${DEEPWIKI_SEARCH_BASE}${encodeURIComponent(queryId)}?mode=${encodeURIComponent(mode)}`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getRepoNames(body: DeepWikiRequestBody): string[] {
  if (Array.isArray(body.repo_names)) {
    const repoNames = body.repo_names
      .map(normalizeString)
      .filter(repoName => repoName && repoName.includes('/'));

    if (repoNames.length > 0) return repoNames;
  }

  const repoName = normalizeString(body.repoName);
  if (repoName && repoName.includes('/')) return [repoName];

  return [DEFAULT_REPO];
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...API_CORS_HEADERS,
      'allow': 'POST, OPTIONS',
      'cache-control': 'no-store'
    }
  });
}

export async function handleDeepWikiAsk(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: DeepWikiRequestBody;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const question = normalizeString(body.user_query || body.question);
  const mode = ALLOWED_MODES.has(body.mode || '') ? (body.mode as string) : 'fast';
  const queryId = normalizeString(body.query_id || body.queryId);
  const repoNames = getRepoNames(body);

  if (!question) {
    return json({ error: 'question is required' }, 400);
  }

  if (!queryId) {
    return json({ error: 'query_id is required' }, 400);
  }

  const payload = {
    mode,
    user_query: question,
    keywords: Array.isArray(body.keywords) ? body.keywords : [],
    repo_names: repoNames,
    additional_context: normalizeString(body.additional_context),
    query_id: queryId,
    use_notes: false,
    attached_context: body.attached_context,
    generate_summary: false,
    source: QUERY_SOURCE
  };

  try {
    const response = await fetch(DEEPWIKI_QUERY_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      return json({
        error: 'DeepWiki query failed',
        status: response.status,
        detail: responseText
      }, 502);
    }

    return json({
      queryId,
      mode,
      repoNames,
      redirectUrl: buildRedirectUrl(queryId, mode)
    });
  } catch (error) {
    return json({
      error: 'DeepWiki request failed',
      detail: error instanceof Error ? error.message : String(error)
    }, 502);
  }
}
