// @ts-check
/**
 * The `documents` resource: every documents endpoint, defined once.
 *
 * The app stores each file once per organization (by SHA-256). Uploading bytes it already
 * holds returns the existing document with `duplicate_file: true` and still records the new
 * arrival, so a line can always upload what it received without keeping its own registry.
 */

/** @typedef {ReturnType<import('../http.js').createTransport>} Transport */

/**
 * @typedef {object} UploadInput
 * @property {Buffer | Uint8Array | Blob} file - the bytes
 * @property {string} file_name
 * @property {string} [content_type] - e.g. application/pdf (sent as the file's type)
 * @property {'email' | 'whatsapp' | 'drive' | 'upload' | 'api'} channel - how it arrived
 * @property {string} [channel_ref] - the channel's id: email Message-ID, WhatsApp message id, Drive file id
 * @property {string} [sender] - email address, phone number or user
 * @property {string} [received_at] - when the channel received it, ISO 8601 instant
 * @property {string} [work_record_id] - the orchestrator run uploading it
 * @property {Record<string, any>} [details] - anything else from the channel (subject, caption)
 */

/**
 * @typedef {object} DocumentUpdate
 * @property {string} [doc_type]
 * @property {string} [status] - forward only; `verified` is set by a person in the app
 * @property {string | null} [object_number]
 * @property {Record<string, any> | null} [extracted_data]
 * @property {Record<string, any> | null} [classification] - e.g. { work_record_id, station, confidence, model, at }
 * @property {Record<string, any> | null} [extraction]
 * @property {string | null} [parent_document_id]
 */

const unwrap = (/** @type {any} */ r) => r?.data ?? null;
const path_for = (/** @type {string} */ id) => `/api/v1/documents/${encodeURIComponent(id)}`;

/** @param {Transport} ctx */
export function buildDocuments(ctx) {
  return {
    /**
     * One page of documents. Filters: doc_type, status, object_number, sha256,
     * created_at_from, created_at_to (ISO instants); sort_by, sort_order; page, limit.
     * @param {Record<string, any>} [params]
     */
    list: (params = {}) => ctx.get('/api/v1/documents', { searchParams: params }),

    /**
     * Every matching document, walking pagination. Capped at MAX_ALL_ROWS.
     * @param {Record<string, any>} [params]
     */
    getAll: async (params = {}) => (await ctx.getAll('/api/v1/documents', { searchParams: params })).data,

    /**
     * One document with its arrivals.
     * @param {string} id
     */
    get: (id) => ctx.get(path_for(id)).then(unwrap),

    /**
     * The document with these exact bytes, or null. A lookup only: to record that a file
     * arrived, `upload` it, even when this finds it.
     * @param {string} sha256 - hex
     */
    findBySha256: async (sha256) => (await ctx.get('/api/v1/documents', { searchParams: { sha256, limit: 1 } }))?.data?.[0] ?? null,

    /**
     * Upload a file and record its arrival.
     * @param {UploadInput} input
     * @returns {Promise<{ document: any, duplicate_file: boolean }>}
     */
    upload: async ({ file, file_name, content_type, channel, details, ...arrival }) => {
      const form = new FormData();
      const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)], content_type ? { type: content_type } : {});
      form.append('file', blob, file_name);
      form.append('channel', channel);
      for (const [key, value] of Object.entries(arrival)) {
        if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
      }
      if (details) form.append('details', JSON.stringify(details));
      const result = await ctx.post('/api/v1/documents', form);
      return { document: result?.data ?? null, duplicate_file: Boolean(result?.duplicate_file) };
    },

    /**
     * Partial update: only the fields sent change. Refused with 409 (ApiError code
     * CONFLICT) once a person has verified the document.
     * @param {string} id
     * @param {DocumentUpdate} data
     */
    update: (id, data) => ctx.put(path_for(id), data).then(unwrap),

    /**
     * The stored bytes.
     * @param {string} id
     * @returns {Promise<{ bytes: Buffer, content_type: string | null, file_name: string | null }>}
     */
    download: async (id) => {
      const { bytes, content_type, content_disposition } = await ctx.getBinary(`${path_for(id)}/file`);
      const match = /filename\*=UTF-8''([^;]+)/i.exec(content_disposition ?? '');
      return { bytes, content_type, file_name: match ? decodeURIComponent(match[1]) : null };
    },
  };
}
