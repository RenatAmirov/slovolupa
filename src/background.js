async function explain(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) return { error: 'Выделите текст для объяснения.' };
  if (new TextEncoder().encode(prompt).length > 240_000) {
    return { error: 'Выделение слишком длинное. Выберите фрагмент поменьше.' };
  }
  try {
    const response = await fetch('http://127.0.0.1:4174/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });
    return await response.json();
  } catch {
    return { error: 'Помощник объяснений не ответил. Запустите Start-Explanation.ps1 из папки расширения и попробуйте снова.' };
  }
}

async function synthesizeSpeech(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Нет текста для озвучивания.' };
  try {
    const response = await fetch('http://127.0.0.1:4174/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });
    return await response.json();
  } catch {
    return { error: 'Помощник озвучки не ответил. Запустите Start-Explanation.ps1 и проверьте ключ Yandex SpeechKit.' };
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

async function fetchSpeechAudio(url) {
  let endpoint;
  try {
    endpoint = new URL(url);
    if (endpoint.origin !== 'http://127.0.0.1:4174' || !/^\/audio\/[0-9a-f-]{36}$/u.test(endpoint.pathname)) throw new Error();
  } catch {
    return { error: 'Помощник вернул некорректный адрес аудио.' };
  }
  try {
    const response = await fetch(endpoint, { redirect: 'error', signal: AbortSignal.timeout(90_000) });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      return { error: details.error || `Помощник озвучки вернул ошибку ${response.status}.` };
    }
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > 12 * 1024 * 1024) return { error: 'Помощник вернул аудио недопустимого размера.' };
    return { audio: arrayBufferToBase64(buffer), contentType };
  } catch {
    return { error: 'Не удалось получить аудио от локального помощника.' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'explain-selection') return;
  explain(message.prompt).then(sendResponse);
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'synthesize-speech') return;
  synthesizeSpeech(message.text).then(sendResponse);
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'fetch-speech-audio') return;
  fetchSpeechAudio(message.url).then(sendResponse);
  return true;
});
