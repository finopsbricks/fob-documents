# 0001 — The client is `@finopsbricks/fob-documents`, a 2-in-1 lib + CLI. Not a `lib-worker-*` package.

- **Status:** Accepted — 2026-11-16
- **Reversibility:** Two-way door (cheap to reverse before anyone depends on it)
- **Scope:** how workers, agents and people reach documents.finopsbricks.com
- **Builds on:** documents.finopsbricks.com decision 0001 (system of record only; lines write through its API)

## Decision

One package, `@finopsbricks/fob-documents`, is both the importable client (`fobDocuments()`)
and the `fob-documents` CLI over the same functions. It follows the `fob-<tool>` family:
commander, `<resource> <action>` grammar, profiles in `~/.fob/fob-documents/config.yml`, and
a pure transport that takes credentials as an argument.

`upload` always sends the file, even when the app already holds those bytes.

## Why

- **The factories already use this shape.** Stations reach statements through `@fob/stm`
  (`factory-alex/src/steps/SI1__upload_statement/SI1_01_upload_statement.js`), and the
  newest clients (`fob-lgr`, `fob-txn`, `fob-snap`) are commander 2-in-1s.
- **Prototype in the terminal, ship in a station, with the same function.** The CLI calls
  `src/resources/documents.js`, the same code a station imports.
- **Why not `lib-worker-*`:** the fde-handbook (`implementation/architecture/system-of-record-integration.md`)
  still names `@fob/lib-worker-*` packages per system of record. No current factory station
  uses that for a new app, and it has no CLI face.
- **Why upload always sends the bytes:** the app records an arrival (channel, sender,
  message id) only when a file is posted. Skipping the upload when `findBySha256` finds the
  file would drop the arrival, which the app keeps on purpose (its decision 0003). The plan
  first said to check `?sha256=` before uploading; that would have lost data.
- **Strongest opposing case:** `engineering-standards/cli/` still shows yargs. The family
  moved to commander without a note saying so; following the code over the note keeps this
  client copyable from its siblings. The standard should be updated (proposal).

## Honest costs

- Every arrival re-sends the bytes, up to 12 MB each. Judged acceptable at invoice sizes.

## Revisit when

- A line uploads files large or frequent enough that re-sending them matters (then the API
  needs an "arrival for existing sha256" endpoint, not a client-side skip).

## Review

## Related

- `documents.finopsbricks.com/docs/wip/documents-app-v1.md` (Phase 5)
