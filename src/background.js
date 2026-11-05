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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'explain-selection') return;
  explain(message.prompt).then(sendResponse);
  return true;
});
