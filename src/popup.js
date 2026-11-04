import { readSettings } from './settings.js';

async function initialize() {
  const settings = await readSettings();
  const status = document.getElementById('status');
  for (const key of ['enabled', 'highlightWater']) {
    const input = document.getElementById(key);
    input.checked = settings[key];
    input.addEventListener('change', async () => {
      try {
        await chrome.storage.local.set({ [key]: input.checked });
        status.textContent = 'Настройки сохранены';
      } catch {
        status.textContent = 'Не удалось сохранить настройки';
      }
    });
  }
}
initialize();
