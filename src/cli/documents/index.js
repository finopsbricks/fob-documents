/**
 * Subtree builder for `fob-documents documents <action>`.
 */

import { Command, Option } from 'commander';

import { safe, listOptions, jsonOption } from '../_helpers.js';
import { listDocumentsHandler } from './list.js';
import { showDocumentHandler } from './show.js';
import { uploadDocumentHandler } from './upload.js';
import { editDocumentHandler } from './edit.js';
import { downloadDocumentHandler } from './download.js';

export const DOC_TYPES = [
  'unclassified', 'vendor_invoice', 'credit_note', 'debit_note', 'purchase_order',
  'goods_receipt', 'payment_advice', 'receipt', 'contract', 'other',
];
export const STATUSES = ['received', 'classified', 'extracted', 'verified'];
export const CHANNELS = ['email', 'whatsapp', 'drive', 'upload', 'api'];

export function buildDocumentsCommand() {
  const documents = new Command('documents').alias('d').description('Documents and the files behind them');

  listOptions(documents.command('list').description('List documents, newest first'))
    .addOption(new Option('--type <doc_type>', 'Filter by document type').choices(DOC_TYPES))
    .addOption(new Option('--status <status>', 'Filter by status').choices(STATUSES))
    .option('--number <object_number>', 'Filter by the document\'s own number, e.g. an invoice number')
    .option('--sha256 <hex>', 'Find the document with these exact bytes')
    .option('--from <instant>', 'Created at or after, e.g. 2026-11-01T00:00:00Z')
    .option('--to <instant>', 'Created at or before, e.g. 2026-11-30T23:59:59Z')
    .addOption(new Option('--sort-by <column>', 'Sort column').choices(['created_at', 'updated_at']))
    .addOption(new Option('--sort-order <order>', 'Sort order').choices(['ASC', 'DESC']))
    .action(safe(listDocumentsHandler));

  jsonOption(
    documents.command('show').description('Show one document with its arrivals and extracted data').argument('<id>', 'Document ID'),
  ).action(safe(showDocumentHandler));

  jsonOption(
    documents
      .command('upload')
      .description('Upload a file and record how it arrived. The same bytes again return the existing document')
      .argument('<file>', 'Path to the file')
      .addOption(new Option('--channel <channel>', 'How it arrived').choices(CHANNELS).makeOptionMandatory())
      .option('--channel-ref <ref>', 'The channel\'s own id: email Message-ID, WhatsApp message id, Drive file id')
      .option('--sender <who>', 'Email address, phone number or user it came from')
      .option('--received-at <instant>', 'When the channel received it, e.g. 2026-11-15T10:00:00Z')
      .option('--work-record <id>', 'The orchestrator run uploading it')
      .option('--details <json>', 'Anything else from the channel, as a JSON object, e.g. \'{"subject":"Invoice 001"}\'')
      .option('--name <file_name>', 'File name to store (default: the file\'s own name)'),
  ).action(safe(uploadDocumentHandler));

  jsonOption(
    documents
      .command('edit')
      .description('Change a document\'s type, status, number or data. Only the fields given change')
      .argument('<id>', 'Document ID')
      .addOption(new Option('--type <doc_type>', 'Document type').choices(DOC_TYPES))
      .addOption(new Option('--status <status>', 'Status (forward only; verified is set in the app)').choices(['classified', 'extracted']))
      .option('--number <object_number>', 'The document\'s own number as printed')
      .option('--extracted-data <file>', 'JSON file with the extracted data; \'-\' reads stdin')
      .option('--classification <json>', 'Who classified it, as JSON, e.g. \'{"station":"AP1","confidence":0.97}\'')
      .option('--extraction <json>', 'Who extracted it, as JSON')
      .option('--parent <id>', 'The bundle document this one was split out of'),
  ).action(safe(editDocumentHandler));

  documents
    .command('download')
    .description('Save the document\'s file')
    .argument('<id>', 'Document ID')
    .option('-o, --output <path>', 'Where to save it (default: its file name, in this folder)')
    .option('--force', 'Overwrite the output file if it exists')
    .action(safe(downloadDocumentHandler));

  return documents;
}
