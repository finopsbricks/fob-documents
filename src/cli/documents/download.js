// @ts-check
import { existsSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { clientFor } from '../_helpers.js';

export async function downloadDocumentHandler(argv) {
  const { bytes, file_name } = await clientFor().documents.download(argv.id);
  // basename() keeps a stored name like "../x" from writing outside the folder.
  const output = argv.output ?? basename(file_name || `${argv.id}.bin`);
  if (existsSync(output) && !argv.force) {
    throw new Error(`${output} already exists. Pass --force to overwrite it, or -o to choose another path.`);
  }
  writeFileSync(output, bytes);
  console.log(`Saved ${output} (${bytes.length} bytes).`);
}
