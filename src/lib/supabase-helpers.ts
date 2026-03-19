/**
 * Wraps a Supabase promise (or thenable) with a timeout to prevent infinite loading states
 * on unstable mobile connections.
 */
export async function withTimeout<T>(
  promiseOrThenable: PromiseLike<T>,
  timeoutMs = 10000
): Promise<T> {
  // Supabase query builders are "thenable" but not real Promises.
  // Wrap to ensure Promise.race works correctly.
  const promise = Promise.resolve(promiseOrThenable);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.')),
      timeoutMs
    )
  );
  return Promise.race([promise, timeoutPromise]);
}
