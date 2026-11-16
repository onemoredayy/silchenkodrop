import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Картинки, загруженные в админке, лежат в папке uploads/ рядом с сайтом
// (не в git, обновления сайта их не трогают) и отдаются через /api/uploads/<имя>.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export const MAX_BYTES = 8 * 1024 * 1024;

export const TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};
export const EXT_TYPE = Object.fromEntries(Object.entries(TYPES).map(([t, e]) => [e, t]));

// Определяем формат по первым байтам — не верим ни расширению, ни заголовкам
function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (b.toString("ascii", 4, 12).startsWith("ftypavi")) return "image/avif";
  return null;
}

export async function saveImage(buf: Buffer): Promise<string> {
  if (buf.length > MAX_BYTES) throw new Error("Картинка больше 8 МБ");
  const type = sniff(buf);
  if (!type) throw new Error("Это не картинка (подходят PNG, JPG, WEBP, GIF, AVIF)");
  const name = createHash("sha1").update(buf).digest("hex").slice(0, 20) + TYPES[type];
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return `/api/uploads/${name}`;
}

async function download(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: {
      // некоторые сайты не отдают картинки «роботам»
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "image/avif,image/webp,image/*,text/html;q=0.8,*/*;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`сайт ответил ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error("Картинка больше 8 МБ");
  return { type: res.headers.get("content-type") || "", buf: Buffer.from(await res.arrayBuffer()), url: res.url };
}

// Ссылка на картинку ИЛИ на страницу с картинкой (Pinterest, Steam, ВК и т.п.):
// скачиваем к себе. Со страницы берём главную картинку (og:image).
export async function importImage(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Это не ссылка");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Ссылка должна начинаться с http:// или https://");
  // не даём ходить по внутренним адресам сервера
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/.test(url.hostname)) throw new Error("Недопустимый адрес");

  const first = await download(url.toString());
  if (sniff(first.buf)) return saveImage(first.buf);
  if (first.type.includes("html")) {
    const html = first.buf.toString("utf8");
    const m =
      html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (m) {
      const img = new URL(m[1].replace(/&amp;/g, "&"), first.url).toString();
      const second = await download(img);
      if (sniff(second.buf)) return saveImage(second.buf);
    }
    throw new Error("По ссылке страница, а не картинка, и картинку на ней найти не удалось");
  }
  throw new Error("По ссылке не картинка");
}
