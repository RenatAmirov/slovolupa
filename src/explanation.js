export function explanationPrompt(text) {
  return `Ты гуру текущей темы, доктор наук, профессор. Напиши пост о тексте "${text}". Объясните популярно, доходчиво, с живыми примерами из повседневной жизни, физики, философии, литературы, математики; смысл текста, чтобы аудитория постигла суть этого текста. Аудитория — школьники 8 класс. Тон — дружеский.`;
}

export async function requestExplanation(prompt) {
  if (!globalThis.chrome?.runtime?.id) {
    throw new Error('Для объяснения откройте Словолупу как расширение Chrome.');
  }
  const response = await chrome.runtime.sendMessage({ type: 'explain-selection', prompt });
  if (!response?.text) throw new Error(response?.error || 'Не удалось получить объяснение.');
  return response.text;
}
