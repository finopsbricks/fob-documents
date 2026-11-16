// @ts-check
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { clientFor } from '../_helpers.js';
import { formatField } from '../utils/format.js';

// The app stores the type it is sent. An extension not listed here goes up without one.
const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.eml': 'message/rfc822',
};

/** @param {string | undefined} raw */
export function parseDetails(raw) {
  if (!raw) return undefined;
  let details;
  try {
    details = JSON.parse(raw);
  } catch {
    throw new Error(`--details is not valid JSON: ${raw}`);
  }
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('--details must be a JSON object');
  return details;
}

export async function uploadDocumentHandler(argv) {
  const file_name = argv.name ?? basename(argv.file);
  const { document, duplicate_file } = await clientFor().documents.upload({
    file: readFileSync(argv.file),
    file_name,
    content_type: MIME_TYPES[extname(argv.file).toLowerCase()],
    channel: argv.channel,
    channel_ref: argv.channelRef,
    sender: argv.sender,
    received_at: argv.receivedAt,
    work_record_id: argv.workRecord,
    details: parseDetails(argv.details),
  });

  if (argv.json) {
    console.log(JSON.stringify({ data: document, duplicate_file }, null, 2));
    return;
  }

  console.log(duplicate_file
    ? `Already stored: ${document.id}. Recorded this arrival on it (${document.arrivals?.length ?? '?'} arrivals now).`
    : `Stored as ${document.id}.`);
  console.log([formatField('Status', document.status, 8), formatField('Type', document.doc_type, 8)].join('\n'));
}
