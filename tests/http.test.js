import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { createTransport, ApiError, DEFAULT_API_URL } from '../src/http.js';

const creds = { api_key: 'k1', api_secret: 's1' };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** @param {Response | (() => Response)} response - a function when the test makes several calls */
function mockFetch(response) {
  const fetch = jest.fn(async () => (typeof response === 'function' ? response() : response));
  globalThis.fetch = fetch;
  return fetch;
}

describe('transport', () => {
  it('sends the api-key and api-secret headers to the default origin', async () => {
    const fetch = mockFetch(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await createTransport(creds).get('/api/v1/documents', { searchParams: { status: 'received', sha256: undefined } });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(`${DEFAULT_API_URL}/api/v1/documents?status=received`);
    expect(init.headers).toMatchObject({ 'api-key': 'k1', 'api-secret': 's1' });
  });

  it('sends JSON for a PUT and FormData untouched for a POST', async () => {
    const fetch = mockFetch(() => new Response('{"data":{}}', { status: 200 }));
    const t = createTransport({ ...creds, api_url: 'http://localhost:4010' });
    await t.put('/api/v1/documents/d1', { status: 'extracted' });
    const form = new FormData();
    form.append('channel', 'api');
    await t.post('/api/v1/documents', form);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: '{"status":"extracted"}', headers: { 'content-type': 'application/json' } });
    expect(fetch.mock.calls[1][1].body).toBe(form);
    expect(fetch.mock.calls[1][1].headers['content-type']).toBeUndefined();
  });

  it('turns an error envelope into an ApiError with code and status', async () => {
    mockFetch(new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Document d1 is verified' } }), { status: 409 }));
    const attempt = createTransport(creds).put('/api/v1/documents/d1', {});
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ code: 'CONFLICT', status: 409, message: 'Document d1 is verified' });
  });

  it('returns binary bodies with their headers', async () => {
    mockFetch(new Response(Buffer.from('%PDF'), { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': "attachment; filename*=UTF-8''a.pdf" } }));
    const file = await createTransport(creds).getBinary('/api/v1/documents/d1/file');
    expect(file.bytes.toString()).toBe('%PDF');
    expect(file.content_type).toBe('application/pdf');
  });

  it('refuses to call without credentials', async () => {
    await expect(createTransport({}).get('/api/v1/documents')).rejects.toMatchObject({ code: 'NO_CREDENTIALS' });
  });
});
