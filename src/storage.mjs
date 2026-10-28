import { newGame, validateSave } from './engine.mjs';
export const SAVE_KEY = 'videopoker.save.v1';
export const SETTINGS_KEY = 'videopoker.settings.v1';
export const DEFAULT_SETTINGS = { language: 'en', sound: true, music: false, autoHold: true, fast: false };
export function loadGame(storage) {
  try { const value = JSON.parse(storage.getItem(SAVE_KEY)); return validateSave(value) ? value : newGame(); }
  catch { return newGame(); }
}
export function saveGame(storage, state) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function loadSettings(storage) {
  try {
    const value = JSON.parse(storage.getItem(SETTINGS_KEY));
    return { language: 'en', ...Object.fromEntries(['sound', 'music', 'autoHold', 'fast'].map(k => [k, typeof value?.[k] === 'boolean' ? value[k] : DEFAULT_SETTINGS[k]])) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(storage, settings) {
  try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}
