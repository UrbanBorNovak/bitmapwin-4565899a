/** Esplora serves a block's transactions 25 at a time. */
export const PAGE_SIZE = 25;

export type PageLoader = (start: number, attempt: number) => Promise<number[]>;

export type PageResult = {
  /** values in block order, only up to the first page that could not be read */
  values: number[];
  complete: boolean;
  failedPages: number;
  /** every page read so far (null = not yet), to resume from on the next try */
  pages: Array<number[] | null>;
};

/**
 * Read every page of a block (no cap), a few at a time, re-trying pages that
 * failed in later rounds. A page counts only when it has exactly the expected
 * number of transactions. Values after the first missing page are dropped so
 * transaction positions are never shifted; `complete` is true only when every
 * transaction was read.
 */
export async function collectPages(
  txCount: number,
  load: PageLoader,
  opts: { concurrency: number; rounds: number; deadline: number; now?: () => number; resume?: Array<number[] | null> },
): Promise<PageResult> {
  const now = opts.now ?? Date.now;
  const pages = Math.ceil(txCount / PAGE_SIZE);
  const results: Array<number[] | null> =
    opts.resume && opts.resume.length === pages ? opts.resume.slice() : new Array(pages).fill(null);
  const expected = (i: number) => Math.min(PAGE_SIZE, txCount - i * PAGE_SIZE);

  for (let round = 0; round < opts.rounds; round++) {
    const todo = results.flatMap((r, i) => (r ? [] : [i]));
    if (todo.length === 0 || now() >= opts.deadline) break;
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        if (now() >= opts.deadline) return;
        const index = todo[cursor++];
        if (index === undefined) return;
        try {
          // A page still loading at the deadline is abandoned, never waited on.
          const left = opts.deadline - now();
          const page = await Promise.race([
            load(index * PAGE_SIZE, round),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("page deadline")), Math.max(0, left))),
          ]);
          if (page.length === expected(index)) results[index] = page;
        } catch {
          /* retried next round */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency, todo.length) }, () => worker()));
  }

  const values: number[] = [];
  let failedPages = 0;
  let gap = false;
  for (const page of results) {
    if (!page) {
      failedPages++;
      gap = true;
    } else if (!gap) values.push(...page);
  }
  return { values, complete: failedPages === 0 && values.length === txCount, failedPages, pages: results };
}
