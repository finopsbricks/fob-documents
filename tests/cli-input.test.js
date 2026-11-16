import { describe, it, expect } from '@jest/globals';
import { buildUpdate } from '../src/cli/documents/edit.js';
import { parseDetails } from '../src/cli/documents/upload.js';

describe('edit flags → PUT body', () => {
  it('maps only the flags given', () => {
    const body = buildUpdate(
      { type: 'vendor_invoice', status: 'extracted', number: 'INV-001', extractedData: 'x.json', extraction: '{"station":"AP8"}' },
      () => '{"total":11800}',
    );
    expect(body).toEqual({
      doc_type: 'vendor_invoice',
      status: 'extracted',
      object_number: 'INV-001',
      extracted_data: { total: 11800 },
      extraction: { station: 'AP8' },
    });
  });

  it('refuses an edit with nothing to change', () => {
    expect(() => buildUpdate({})).toThrow('Nothing to change');
  });

  it.each([
    [{ extractedData: 'x.json' }, () => '[1,2]', '--extracted-data must be a JSON object'],
    [{ classification: '{oops' }, () => '', '--classification is not valid JSON'],
  ])('refuses bad JSON in %j', (argv, readFile, message) => {
    expect(() => buildUpdate(argv, readFile)).toThrow(message);
  });
});

describe('upload --details', () => {
  it('parses a JSON object', () => {
    expect(parseDetails('{"subject":"Invoice 001"}')).toEqual({ subject: 'Invoice 001' });
    expect(parseDetails(undefined)).toBeUndefined();
  });

  it.each(['[1]', 'nope'])('refuses %s', (raw) => {
    expect(() => parseDetails(raw)).toThrow('--details');
  });
});
