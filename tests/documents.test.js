import { describe, it, expect } from '@jest/globals';
import { buildDocuments } from '../src/resources/documents.js';

function stubCtx(responses = {}) {
  const calls = [];
  const record = (method) => async (...args) => {
    calls.push([method, ...args]);
    return responses[method] ?? { data: { id: 'doc1' } };
  };
  return {
    calls,
    ctx: { get: record('get'), post: record('post'), put: record('put'), getBinary: record('getBinary'), getAll: record('getAll') },
  };
}

describe('documents resource', () => {
  it('lists with the filters as query params', async () => {
    const { calls, ctx } = stubCtx();
    await buildDocuments(ctx).list({ status: 'extracted', doc_type: 'vendor_invoice' });
    expect(calls).toEqual([['get', '/api/v1/documents', { searchParams: { status: 'extracted', doc_type: 'vendor_invoice' } }]]);
  });

  it('gets one document, unwrapping the envelope', async () => {
    const { calls, ctx } = stubCtx();
    const document = await buildDocuments(ctx).get('a/b');
    expect(calls).toEqual([['get', '/api/v1/documents/a%2Fb']]);
    expect(document).toEqual({ id: 'doc1' });
  });

  it('finds by sha256 with a one-row lookup, or returns null', async () => {
    const found = stubCtx({ get: { data: [{ id: 'doc9' }] } });
    expect(await buildDocuments(found.ctx).findBySha256('abc')).toEqual({ id: 'doc9' });
    expect(found.calls).toEqual([['get', '/api/v1/documents', { searchParams: { sha256: 'abc', limit: 1 } }]]);
    const missing = stubCtx({ get: { data: [] } });
    expect(await buildDocuments(missing.ctx).findBySha256('abc')).toBeNull();
  });

  it('uploads multipart with the file and only the arrival fields given', async () => {
    // Arrange
    const { calls, ctx } = stubCtx({ post: { data: { id: 'doc1' }, duplicate_file: true } });

    // Act
    const result = await buildDocuments(ctx).upload({
      file: Buffer.from('%PDF-1.4 hello'),
      file_name: 'INV-001.pdf',
      content_type: 'application/pdf',
      channel: 'email',
      sender: 'billing@vendor.example',
      channel_ref: undefined,
      details: { subject: 'Invoice 001' },
    });

    // Assert
    expect(result).toEqual({ document: { id: 'doc1' }, duplicate_file: true });
    const [method, path, form] = calls[0];
    expect([method, path]).toEqual(['post', '/api/v1/documents']);
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()].sort()).toEqual(['channel', 'details', 'file', 'sender']);
    expect(form.get('details')).toBe('{"subject":"Invoice 001"}');
    const file = form.get('file');
    expect(file.name).toBe('INV-001.pdf');
    expect(file.type).toBe('application/pdf');
    expect(await file.text()).toBe('%PDF-1.4 hello');
  });

  it('reports duplicate_file false for a new document', async () => {
    const { ctx } = stubCtx({ post: { data: { id: 'doc2' }, duplicate_file: false } });
    const result = await buildDocuments(ctx).upload({ file: Buffer.from('x'), file_name: 'x.pdf', channel: 'api' });
    expect(result.duplicate_file).toBe(false);
  });

  it('updates with a PUT carrying only the fields given', async () => {
    const { calls, ctx } = stubCtx();
    await buildDocuments(ctx).update('doc1', { status: 'extracted', object_number: 'INV-001' });
    expect(calls).toEqual([['put', '/api/v1/documents/doc1', { status: 'extracted', object_number: 'INV-001' }]]);
  });

  it('downloads the bytes and reads the file name from the response', async () => {
    const { calls, ctx } = stubCtx({
      getBinary: { bytes: Buffer.from('x'), content_type: 'application/pdf', content_disposition: "attachment; filename*=UTF-8''INV%20001.pdf" },
    });
    const file = await buildDocuments(ctx).download('doc1');
    expect(calls).toEqual([['getBinary', '/api/v1/documents/doc1/file']]);
    expect(file).toEqual({ bytes: Buffer.from('x'), content_type: 'application/pdf', file_name: 'INV 001.pdf' });
  });
});
