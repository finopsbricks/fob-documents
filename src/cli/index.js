/**
 * CLI entry point. Three-level command tree:
 *
 *   fob-documents <resource> <action> [target] [options]
 *
 * Credentials come from ~/.fob/fob-documents/config.yml; `config` manages them. Every command
 * is a thin wrapper over src/resources/, so the CLI and the importable client can't disagree
 * about what an endpoint does.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Command } from 'commander';

import { setOrgOverride } from './config-store.js';
import { safe, configureTreeHelp } from './_helpers.js';
import { buildConfigCommand } from './config/index.js';
import { buildDocumentsCommand } from './documents/index.js';

function packageVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')).version;
}

/** @param {string[]} argv */
export function run(argv) {
  const program = new Command();

  program
    .name('fob-documents')
    .description('Finance documents: upload, list, read, classify and download them')
    .usage('<resource> <action> [target] [options]')
    .version(packageVersion(), '-v, --version', 'Show version number')
    .option('--profile, --org <name>', 'Use a specific configured profile for this command')
    .hook('preAction', (thisCommand) => {
      const { org } = thisCommand.opts();
      if (org) setOrgOverride(org);
    });

  program
    .command('getting-started')
    .description('Print setup instructions')
    .action(safe(gettingStartedHandler));

  program
    .addCommand(buildConfigCommand())
    .addCommand(buildDocumentsCommand())
    .allowUnknownOption(false)
    .showHelpAfterError();

  configureTreeHelp(program);

  program.parse(argv, { from: 'user' });
}

function gettingStartedHandler() {
  console.log(`fob-documents — the documents CLI

1. Add a profile
     fob-documents config add mycompany
   You will be prompted for the API key and secret. Create them under
   Settings → API keys in documents.finopsbricks.com.

2. Upload a document, saying how it arrived
     fob-documents documents upload INV-001.pdf --channel email \\
       --sender billing@vendor.example --received-at 2026-11-15T10:00:00Z
   The same file uploaded again is not stored twice: you get the existing
   document back, and the new arrival is recorded on it.

3. List and read
     fob-documents documents list --status received
     fob-documents documents show <id>

4. Record what a line worked out
     fob-documents documents edit <id> --type vendor_invoice --status extracted \\
       --number INV-001 --extracted-data extraction.json
   Once a person verifies a document in the app, edits are refused until
   they unlock it.

5. Get the file back
     fob-documents documents download <id>
`);
}
