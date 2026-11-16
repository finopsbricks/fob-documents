# fob-documents

Client and CLI for [documents.finopsbricks.com](https://documents.finopsbricks.com), the
system of record for finance documents: vendor invoices, credit and debit notes, purchase
orders, goods receipts, payment advices, receipts and contracts.

Two things in one package. Import the client in a worker or agent; run the CLI from a
terminal. Both call the same resource layer in `src/resources/`, so they can't drift.

## Install

```bash
npm install -g @finopsbricks/fob-documents
```

## The model in one line

A **document** is one file in an organization, stored once by its SHA-256, with its type,
number, extracted data and every **arrival** (each time it was received, and through which
channel).

Upload whatever you receive. Bytes the organization already holds don't make a second
document: you get the existing one back with `duplicate_file: true`, and the new arrival is
recorded on it. You don't need your own "have I seen this file?" registry.

## CLI

```bash
fob-documents config add mycompany          # prompts for the API key and secret
fob-documents getting-started               # the steps below, in the terminal
```

Create API keys in the app under **Settings › API keys**.

### Upload

```bash
fob-documents documents upload INV-001.pdf --channel email \
  --sender billing@vendor.example --channel-ref '<abc@mail.example>' \
  --received-at 2026-11-15T10:00:00Z --details '{"subject":"Invoice 001"}'
```

`--channel` is one of `email`, `whatsapp`, `drive`, `upload`, `api`.

### Find and read

```bash
fob-documents documents list --status received
fob-documents documents list --type vendor_invoice --number INV-001
fob-documents documents list --from 2026-11-01T00:00:00Z --all --json
fob-documents documents show <id>
fob-documents documents download <id> -o invoice.pdf
```

Dates for `--from` / `--to` are instants with seconds and a zone (`2026-11-01T00:00:00Z`).

### Record what a line worked out

```bash
fob-documents documents edit <id> --type vendor_invoice --status extracted \
  --number INV-001 --extracted-data extraction.json \
  --extraction '{"work_record_id":"wr_123","station":"AP8","confidence":0.93}'
```

Only the flags you pass change. Status moves forward only (`received` → `classified` →
`extracted`); `verified` is set by a person in the app. A verified document refuses edits
until a person unlocks it.

## Library

```js
import { fobDocuments, ApiError } from '@finopsbricks/fob-documents';

const docs = fobDocuments({ api_key, api_secret }); // api_url optional

const { document, duplicate_file } = await docs.documents.upload({
  file: bytes,                     // Buffer, Uint8Array or Blob
  file_name: 'INV-001.pdf',
  content_type: 'application/pdf',
  channel: 'email',
  channel_ref: message_id,
  sender: 'billing@vendor.example',
  received_at: '2026-11-15T10:00:00Z',
  work_record_id,
});

await docs.documents.update(document.id, {
  doc_type: 'vendor_invoice',
  status: 'extracted',
  object_number: 'INV-001',
  extracted_data: { /* … */ },
  extraction: { work_record_id, station: 'AP8', confidence: 0.93 },
});
```

| Method | Does |
|---|---|
| `list(params)` | One page: `{ data, page_context }`. Filters `doc_type`, `status`, `object_number`, `sha256`, `created_at_from`, `created_at_to`; `sort_by`, `sort_order`, `page`, `limit` |
| `getAll(params)` | Every match across pages (capped at 15,000) |
| `get(id)` | One document with its `arrivals` |
| `findBySha256(hex)` | The document with these exact bytes, or `null`. A lookup only: still `upload` a file you received, so its arrival is recorded |
| `upload(input)` | `{ document, duplicate_file }` |
| `update(id, data)` | Partial update; the updated document |
| `download(id)` | `{ bytes, content_type, file_name }` |

Multi-tenant workers construct one client per organization.

## Errors

API errors throw `ApiError` with `code`, `status` and `message`, for example
`CONFLICT` / `409` when a document is verified, `VALIDATION_ERROR` / `400` for a bad field.
The CLI prints `Error [CODE]: message` and exits 1. Set `FOB_DEBUG=1` for the stack.

## Configuration

Profiles live in `~/.fob/fob-documents/config.yml` (mode `0600`). Override the folder with
`FOB_DOCUMENTS_CONFIG_DIR`. `--profile <name>` picks a profile for one command.

```bash
fob-documents config list
fob-documents config use <name>
fob-documents config current
fob-documents config remove <name>
```

The client never reads environment variables or the config file itself: pass credentials to
`fobDocuments()`.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
