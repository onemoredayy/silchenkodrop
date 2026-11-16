"use client";

import { useEffect, useRef } from "react";

// Салют поверх всей страницы на несколько секунд. Перезапускается при смене fire.
export default function Fireworks({ fire, ms = 4000 }: { fire: number; ms?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const colors = ["#e0b43a", "#ffe08a", "#ff5fd2", "#5fd2ff", "#8fbf6a", "#ffffff", "#e0614a"];
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; size: number; confetti: boolean; rot: number };
    const ps: P[] = [];

    const burst = (x: number, y: number) => {
      const c = colors[(Math.random() * colors.length) | 0];
      const n = 70;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const sp = 2.5 + Math.random() * 4;
        ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 60 + Math.random() * 30, c: Math.random() < 0.2 ? "#fff" : c, size: 2.2, confetti: false, rot: 0 });
      }
    };
    const confetti = () => {
      for (let i = 0; i < 120; i++) {
        ps.push({
          x: Math.random() * W(),
          y: -20 - Math.random() * H() * 0.5,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 3,
          life: 0,
          max: 200,
          c: colors[(Math.random() * colors.length) | 0],
          size: 5 + Math.random() * 4,
          confetti: true,
          rot: Math.random() * 6,
        });
      }
    };

    const start = performance.now();
    let nextBurst = 0;
    let raf = 0;
    confetti();
    const frame = (now: number) => {
      const t = now - start;
      if (t < ms - 800 && t >= nextBurst) {
        burst(W() * (0.15 + Math.random() * 0.7), H() * (0.15 + Math.random() * 0.4));
        nextBurst = t + 220 + Math.random() * 280;
      }
      ctx.clearRect(0, 0, W(), H());
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life++;
        if (p.confetti) {
          p.vy = Math.min(p.vy + 0.02, 4);
          p.x += p.vx + Math.sin((p.life + i) / 10);
          p.y += p.vy;
          p.rot += 0.15;
        } else {
          p.vx *= 0.97;
          p.vy = p.vy * 0.97 + 0.06;
          p.x += p.vx;
          p.y += p.vy;
        }
        const alpha = Math.max(0, 1 - p.life / p.max) * (t > ms - 600 ? Math.max(0, (ms - t) / 600) : 1);
        if (alpha <= 0 || p.y > H() + 30) {
          ps.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.c;
        if (p.confetti) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (t < ms) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W(), H());
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, W(), H());
    };
  }, [fire, ms]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden />;
}
