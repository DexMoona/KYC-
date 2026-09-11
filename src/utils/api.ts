/**
 * Production-grade fetch client with timeout and automatic retry backoff.
 */
export async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 12000,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: any = null;
  let delay = 300; // start with 300ms delay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => {
      try {
        controller.abort(new Error('Request timeout'));
      } catch (e) {
        controller.abort();
      }
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`Server responded with HTTP ${response.status} (${response.statusText || 'Error'})`);
      }
      return response;
    } catch (err: any) {
      clearTimeout(id);
      lastError = err;

      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout') || err.message?.includes('signal');
      const errMessage = isTimeout ? 'Request timed out' : err.message || 'Network connectivity error';
      console.warn(`[API Attempt ${attempt + 1}/${maxRetries} Failed] ${url}: ${errMessage}`);

      if (attempt < maxRetries - 1) {
        // Wait with exponential backoff and small jitter
        const sleepTime = delay + Math.floor(Math.random() * 100);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        delay *= 2; // double the delay
      }
    }
  }

  const finalMessage = lastError?.message && !lastError.message.includes('aborted') && !lastError.message.includes('signal')
    ? lastError.message
    : `Unable to connect to live server. Please try again.`;

  throw new Error(finalMessage);
}
