// Барабан под прокрутку топ-дропа: файл public/sounds/baraban.mp3 (~10 c, в конце затухает)
let audio: HTMLAudioElement | null = null;
let fade: ReturnType<typeof setInterval> | undefined;

function get() {
  if (typeof window === "undefined") return null;
  audio ??= new Audio("/sounds/baraban.mp3");
  audio.preload = "auto";
  return audio;
}

// Вызывать прямо в обработчике клика: телефоны разрешают звук только после нажатия.
// Тихо запускаем и сразу ставим на паузу — дальше play() сработает и после ответа сервера.
export function primeBaraban() {
  const a = get();
  if (!a || !a.paused) return;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });
}

export function playBaraban(volume = 0.85) {
  const a = get();
  if (!a) return;
  clearInterval(fade);
  a.muted = false;
  a.volume = volume;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// Быстро гасим, чтобы не наложилось на фанфары
export function stopBaraban() {
  const a = audio;
  if (!a || a.paused) return;
  clearInterval(fade);
  fade = setInterval(() => {
    if (a.volume > 0.08) a.volume = Math.max(0, a.volume - 0.08);
    else {
      clearInterval(fade);
      a.pause();
    }
  }, 30);
}
