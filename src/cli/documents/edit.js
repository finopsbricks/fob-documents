// @ts-check
import { readFileSync } from 'node:fs';
import { clientFor } from '../_helpers.js';
import { formatField } from '../utils/format.js';

/**
 * @param {string} flag
 * @param {string} raw
 */
function parseJsonObject(flag, raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${flag} is not valid JSON`);
  }
  if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error(`${flag} must be a JSON object`);
  return value;
}

/** Build the PUT body from the flags given; only those fields change. */
export function buildUpdate(argv, readFile = (p) => readFileSync(p === '-' ? 0 : p, 'utf8')) {
  const data = {};
  if (argv.type) data.doc_type = argv.type;
  if (argv.status) data.status = argv.status;
  if (argv.number !== undefined) data.object_number = argv.number;
  if (argv.parent) data.parent_document_id = argv.parent;
  if (argv.extractedData) data.extracted_data = parseJsonObject('--extracted-data', readFile(argv.extractedData));
  if (argv.classification) data.classification = parseJsonObject('--classification', argv.classification);
  if (argv.extraction) data.extraction = parseJsonObject('--extraction', argv.extraction);
  if (!Object.keys(data).length) {
    throw new Error('Nothing to change: pass at least one of --type, --status, --number, --extracted-data, --classification, --extraction, --parent');
  }
  return data;
}

export async function editDocumentHandler(argv) {
  const document = await clientFor().documents.update(argv.id, buildUpdate(argv));

  if (argv.json) {
    console.log(JSON.stringify(document, null, 2));
    return;
  }
  console.log(`Updated ${document.id}.`);
  console.log(
    [formatField('Type', document.doc_type, 8), formatField('Status', document.status, 8), formatField('Number', document.object_number, 8)].join('\n'),
  );
}
