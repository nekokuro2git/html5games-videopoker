const cache = new Map();
export function playSound(name, enabled) {
  if (!enabled) return;
  try {
    let audio = cache.get(name);
    if (!audio) { audio = new Audio(new URL(`./assets/audio/${name}.mp3`, document.baseURI).href); audio.volume = 0.42; cache.set(name, audio); }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch { /* Audio availability does not block a round. */ }
}
export function setMusic(enabled) {
  try {
    let audio = cache.get('bgm');
    if (!audio) { audio = new Audio(new URL('./assets/audio/bgm.mp3', document.baseURI).href); audio.loop = true; audio.volume = 0.16; cache.set('bgm', audio); }
    if (enabled) audio.play().catch(() => {}); else audio.pause();
  } catch { /* Playback may require a user gesture. */ }
}
