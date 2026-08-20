(() => {
  const nativeFetch = window.fetch.bind(window);
  const PIN_KEY = 'cyberStoryAiPin';
  let pinRequired = false;
  let policyReady = false;

  const healthPromise = (async () => {
    if (location.protocol === 'file:') { policyReady = true; return; }
    try {
      const res = await nativeFetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      pinRequired = Boolean(data.pinRequired);
    } catch {
      pinRequired = false;
    } finally {
      policyReady = true;
    }
  })();

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input?.url || String(input));
    const isAiCall = url.includes('/api/story-help') || url.includes('/api/image-finish');
    if (!isAiCall) return nativeFetch(input, init);

    if (!policyReady) await healthPromise;
    if (!pinRequired) return nativeFetch(input, init);

    let pin = sessionStorage.getItem(PIN_KEY) || '';
    if (!pin) pin = prompt('AI補助を使うためのスタッフPINを入力してください') || '';
    if (!pin) {
      return new Response(JSON.stringify({ error: 'AI補助をキャンセルしました' }), {
        status: 499,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const headers = new Headers(init.headers || {});
    headers.set('x-ai-pin', pin);
    const response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401) {
      sessionStorage.removeItem(PIN_KEY);
      alert('スタッフPINが違います。もう一度AIボタンを押してください。');
    } else {
      sessionStorage.setItem(PIN_KEY, pin);
    }
    return response;
  };
})();
