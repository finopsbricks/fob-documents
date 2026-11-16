// @ts-check
import { clientFor, resolveListScope } from '../_helpers.js';
import { formatTable, formatDate, formatPaginationHint } from '../utils/format.js';

export async function listDocumentsHandler(argv) {
  const client = clientFor();
  const searchParams = {
    doc_type: argv.type,
    status: argv.status,
    object_number: argv.number,
    sha256: argv.sha256,
    created_at_from: argv.from,
    created_at_to: argv.to,
    sort_by: argv.sortBy,
    sort_order: argv.sortOrder,
  };

  const { rows, pageContext, truncated } = await resolveListScope(argv, {
    list: client.documents.list,
    getAll: client.documents.getAll,
    searchParams,
  });

  if (argv.json) {
    console.log(JSON.stringify({ data: rows, page_context: pageContext }, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log('(no documents)');
    return;
  }

  console.log(
    formatTable(
      ['ID', 'CREATED', 'TYPE', 'STATUS', 'NUMBER', 'FILE'],
      rows.map((d) => [d.id, formatDate(d.created_at), d.doc_type, d.status, d.object_number ?? '', (d.file_name ?? '').slice(0, 40)]),
    ),
  );
  const hint = formatPaginationHint(pageContext);
  if (hint) console.log(`\n${hint}`);
  if (truncated) console.log('\n(stopped at the row limit; narrow the filters)');
}
