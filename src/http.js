// @ts-check
/**
 * Documents API transport.
 *
 * PURE: credentials come from the `credentials` argument only. This module never reads
 * `process.env` or the CLI config file; callers resolve credentials their own way (the CLI
 * from its profiles, workers from their own env) and inject them
 * (engineering-standards `no-ambient-configuration`).
 *
 * The base URL is origin-only (https://documents.finopsbricks.com); the /api/v1 prefix is
 * carried in the paths the resource layer passes.
 */

/** Row ceiling for auto-paginated fetches (`getAll`). */
export const MAX_ALL_ROWS = 15000;

/** An error returned by the documents API, with its machine-readable code and HTTP status. */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number, details?: object }} [opts]
   */
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details ?? null;
  }
}

/** Origin the client talks to when the caller doesn't supply `api_url`. */
export const DEFAULT_API_URL = 'https://documents.finopsbricks.com';

/**
 * @typedef {{ api_url?: string, api_key?: string, api_secret?: string }} Credentials
 */

/** @param {Credentials} [credentials] */
function resolveCreds(credentials) {
  const api_url = credentials?.api_url ?? DEFAULT_API_URL;
  const api_key = credentials?.api_key;
  const api_secret = credentials?.api_secret;
  if (!api_key || !api_secret) {
    throw new ApiError(
      'Missing documents credentials: pass { api_key, api_secret } to fobDocuments() ' +
        `(api_url optional, defaults to ${DEFAULT_API_URL}).`,
      { code: 'NO_CREDENTIALS' },
    );
  }
  return { api_url, api_key, api_secret };
}

/**
 * @param {string} base_url
 * @param {string} path
 * @param {Record<string, any>} [search_params]
 */
function buildUrl(base_url, path, search_params) {
  const base = base_url.endsWith('/') ? base_url : base_url + '/';
  const url = new URL(path.replace(/^\//, ''), base);
  for (const [key, value] of Object.entries(search_params ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * Throws ApiError for a non-2xx response, reading the `{ error }` envelope when there is one.
 * @param {Response} response
 * @param {any} body
 */
function assertOk(response, body) {
  if (response.ok) return;
  throw new ApiError(body?.error?.message || `${response.status} ${response.statusText}`, {
    code: body?.error?.code || 'HTTP_ERROR',
    status: response.status,
    details: body?.error?.details,
  });
}

/** @param {Response} response */
async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(`Invalid JSON response (status ${response.status}): ${text.slice(0, 200)}`, {
      code: 'INVALID_RESPONSE',
      status: response.status,
    });
  }
}

/**
 * @typedef {object} RequestOptions
 * @property {Credentials} [credentials]
 * @property {Record<string, any>} [searchParams] query params; undefined/null/'' values are dropped
 */

/**
 * @param {string} method
 * @param {string} path
 * @param {any} body - JSON-serialised, or sent as is when it's FormData
 * @param {RequestOptions} [options]
 */
async function apiRequest(method, path, body, { credentials, searchParams } = {}) {
  const creds = resolveCreds(credentials);
  /** @type {Record<string, string>} */
  const headers = { 'api-key': creds.api_key, 'api-secret': creds.api_secret, accept: 'application/json' };
  /** @type {RequestInit} */
  const init = { method, headers };
  if (body instanceof FormData) {
    init.body = body; // fetch sets the multipart boundary
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(buildUrl(creds.api_url, path, searchParams), init);
  const json = await readJson(response);
  assertOk(response, json);
  return json;
}

/** @param {string} path @param {RequestOptions} [options] */
export function apiGet(path, options) {
  return apiRequest('GET', path, undefined, options);
}

/** @param {string} path @param {any} body @param {RequestOptions} [options] */
export function apiPost(path, body, options) {
  return apiRequest('POST', path, body ?? {}, options);
}

/** @param {string} path @param {any} body @param {RequestOptions} [options] */
export function apiPut(path, body, options) {
  return apiRequest('PUT', path, body ?? {}, options);
}

/**
 * GET a binary body. Returns the bytes and the response headers that describe them.
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<{ bytes: Buffer, content_type: string | null, content_disposition: string | null }>}
 */
export async function apiGetBinary(path, { credentials } = {}) {
  const creds = resolveCreds(credentials);
  const response = await fetch(buildUrl(creds.api_url, path), {
    headers: { 'api-key': creds.api_key, 'api-secret': creds.api_secret },
  });
  if (!response.ok) assertOk(response, await readJson(response).catch(() => null));
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    content_type: response.headers.get('content-type'),
    content_disposition: response.headers.get('content-disposition'),
  };
}

/**
 * Auto-paginating GET: walks `page_context.has_more`, concatenating each page's `data`.
 * Ignores `page`/`limit` in `searchParams`. Caps at `maxRows` and reports `truncated`
 * rather than silently stopping.
 * @param {string} path
 * @param {RequestOptions} [options]
 * @param {{ maxRows?: number, pageSize?: number }} [paging]
 * @returns {Promise<{ data: any[], page_context: object|null, truncated: boolean }>}
 */
export async function apiGetAll(path, options = {}, { maxRows = MAX_ALL_ROWS, pageSize = 500 } = {}) {
  const base_params = { ...(options.searchParams ?? {}) };
  delete base_params.page;
  delete base_params.limit;
  const all = [];
  let page = 1;
  let page_context = null;
  let truncated = false;
  while (true) {
    const result = await apiGet(path, { ...options, searchParams: { ...base_params, page, limit: pageSize } });
    const rows = result?.data ?? [];
    page_context = result?.page_context ?? null;
    if (all.length + rows.length > maxRows) {
      all.push(...rows.slice(0, maxRows - all.length));
      truncated = true;
      break;
    }
    all.push(...rows);
    if (!page_context?.has_more) break;
    page += 1;
  }
  return { data: all, page_context, truncated };
}

/**
 * Bind credentials once; the returned transport's methods no longer take them.
 * @param {Credentials} [credentials]
 */
export function createTransport(credentials) {
  return {
    /** @param {string} path @param {RequestOptions} [options] */
    get: (path, options) => apiGet(path, { ...options, credentials }),
    /** @param {string} path @param {any} body @param {RequestOptions} [options] */
    post: (path, body, options) => apiPost(path, body, { ...options, credentials }),
    /** @param {string} path @param {any} body @param {RequestOptions} [options] */
    put: (path, body, options) => apiPut(path, body, { ...options, credentials }),
    /** @param {string} path */
    getBinary: (path) => apiGetBinary(path, { credentials }),
    /** @param {string} path @param {RequestOptions} [options] @param {{ maxRows?: number, pageSize?: number }} [paging] */
    getAll: (path, options, paging) => apiGetAll(path, { ...options, credentials }, paging),
  };
}
