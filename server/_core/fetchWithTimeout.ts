/**
 * fetch wrapper that aborts after `timeoutMs`. Use on any external API call
 * where a hung connection would silently burn time / tokens. Bare `fetch()`
 * has no built-in timeout, so without this a stalled response can sit open
 * for hours until the OS finally drops the socket.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; label?: string } = {},
): Promise<Response> {
  const { timeoutMs = 600_000, label = "fetch", signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Forward an external signal if the caller provided one
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err: any) {
    if (controller.signal.aborted && (!externalSignal || !externalSignal.aborted)) {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
