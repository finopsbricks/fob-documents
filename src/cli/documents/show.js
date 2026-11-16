// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatTable, formatDate, formatSection } from '../utils/format.js';

export async function showDocumentHandler(argv) {
  const document = await clientFor().documents.get(argv.id);

  if (argv.json) {
    console.log(JSON.stringify(document, null, 2));
    return;
  }

  const w = 12;
  console.log(
    [
      formatField('ID', document.id, w),
      formatField('File', `${document.file_name} (${document.mime_type}, ${document.file_size} bytes)`, w),
      formatField('Type', document.doc_type, w),
      formatField('Status', document.status, w),
      formatField('Number', document.object_number, w),
      formatField('SHA-256', document.sha256, w),
      formatField('Parent', document.parent_document_id, w),
      formatField('Verified', document.verified_at ? `${formatDate(document.verified_at)} by ${document.verified_by}` : null, w),
      formatField('Created', formatDate(document.created_at), w),
      formatField('Updated', formatDate(document.updated_at), w),
    ].join('\n'),
  );

  console.log(formatSection('Arrivals'));
  console.log(
    formatTable(
      ['RECEIVED', 'CHANNEL', 'SENDER', 'FILE', 'REF'],
      (document.arrivals ?? []).map((a) => [formatDate(a.received_at ?? a.created_at), a.channel, a.sender ?? '', a.file_name, a.channel_ref ?? '']),
    ),
  );

  for (const [title, value] of [['Classification', document.classification], ['Extraction', document.extraction], ['Extracted data', document.extracted_data]]) {
    if (value) {
      console.log(formatSection(title));
      console.log(JSON.stringify(value, null, 2));
    }
  }
}
