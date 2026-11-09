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
