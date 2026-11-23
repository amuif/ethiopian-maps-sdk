import { Data, Effect } from 'effect';

export class ServiceError extends Data.TaggedError('ServiceError')<{
  url: string;
  status?: number;
  message: string;
}> {}

/** GET/POST JSON with a timeout; non-2xx and network failures become ServiceError. */
export const fetchJson = <T>(url: string, init: RequestInit = {}, timeoutMs = 15_000) =>
  Effect.tryPromise({
    try: async (signal) => {
      // Honour both the caller's signal and the Effect interruption signal
      const res = await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal });
      if (!res.ok) throw new ServiceError({ url, status: res.status, message: await res.text().catch(() => res.statusText) });
      return (await res.json()) as T;
    },
    catch: (e) => (e instanceof ServiceError ? e : new ServiceError({ url, message: String(e) })),
  }).pipe(
    Effect.timeoutOrElse({
      duration: timeoutMs,
      orElse: () => Effect.fail(new ServiceError({ url, message: `timed out after ${timeoutMs} ms` })),
    })
  );

export const trimBase = (u: string) => u.replace(/\/+$/, '');
