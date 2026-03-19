/**
 * Wraps a Supabase promise with a timeout to prevent infinite loading states
 * on unstable mobile connections.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 10000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.')),
      timeoutMs
    )
  );
  return Promise.race([promise, timeoutPromise]);
}
