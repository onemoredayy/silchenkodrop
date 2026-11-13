// Звук пука при «пук-прокрутке»: файл public/sounds/fart.mp3
let audio: HTMLAudioElement | null = null;

export function playFart(volume = 0.8) {
  if (typeof window === "undefined") return;
  audio ??= new Audio("/sounds/fart.mp3");
  audio.volume = volume;
  audio.currentTime = 0;
  // браузер может запретить звук без клика — тогда просто молчим
  audio.play().catch(() => {});
}
