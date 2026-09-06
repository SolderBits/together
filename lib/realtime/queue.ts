/**
 * Serialises async work so read-modify-write cycles can't interleave.
 *
 * Every room update reads the current document, merges a patch and writes it
 * back. Without this, two updates fired in the same tick both read the same
 * base and the second silently discards the first — which is exactly what
 * happens when someone clicks two controls quickly.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    // Keep the chain alive even if one task rejects.
    this.tail = next.catch(() => undefined);
    return next;
  }
}
