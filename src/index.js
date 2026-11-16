// @ts-check
/**
 * @finopsbricks/fob-documents: the importable client for documents.finopsbricks.com.
 *
 * Construct a client with credentials bound once, then call the `documents` namespace:
 *
 *   import { fobDocuments } from '@finopsbricks/fob-documents';
 *   const docs = fobDocuments({ api_key, api_secret });   // api_url optional
 *
 *   const { document, duplicate_file } = await docs.documents.upload({
 *     file: bytes, file_name: 'INV-001.pdf', content_type: 'application/pdf',
 *     channel: 'email', sender: 'billing@vendor.example', channel_ref: message_id,
 *   });
 *   await docs.documents.update(document.id, {
 *     doc_type: 'vendor_invoice', status: 'extracted', object_number: 'INV-001',
 *     extracted_data: { ... }, extraction: { work_record_id, station: 'AP8', confidence: 0.93 },
 *   });
 *
 * The `fob-documents` CLI builds the same client and calls these same functions, so the CLI
 * and the library can't drift: every endpoint is defined once, in src/resources/.
 *
 * Multi-tenant workers construct one client per org.
 */

import { createTransport } from './http.js';
import { buildDocuments } from './resources/documents.js';

export { ApiError, DEFAULT_API_URL, MAX_ALL_ROWS } from './http.js';

/**
 * Build a documents client with credentials bound.
 * @param {{ api_key: string, api_secret: string, api_url?: string }} [credentials]
 */
export function fobDocuments(credentials) {
  return { documents: buildDocuments(createTransport(credentials)) };
}

export default fobDocuments;
