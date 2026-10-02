const PAGE_SIZE = 1000;

type PageResult<Row, ErrorType> = {
  data: Row[] | null;
  error: ErrorType | null;
};

type PageableQuery<Row, ErrorType> = {
  range(from: number, to: number): PromiseLike<PageResult<Row, ErrorType>>;
};

/** Recupera tutte le righe oltre il limite predefinito di 1000 di PostgREST. */
export async function fetchAllSupabaseRows<Row, ErrorType>(
  query: PageableQuery<Row, ErrorType>
): Promise<PageResult<Row, ErrorType>> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) return { data: null, error };

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}
