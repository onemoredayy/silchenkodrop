import { createHash } from "crypto";
import path from "path";
import { prisma } from "./prisma";

// Картинки, загруженные в админке, лежат в базе (таблица Upload) и отдаются через /api/img/<id>.
// Старые ссылки /api/uploads/<имя> тоже работают.
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
  const id = createHash("sha1").update(buf).digest("hex").slice(0, 20);
  // храним в базе — не зависит от папок на сервере и переживает любые обновления
  await prisma.upload.upsert({ where: { id }, update: {}, create: { id, type, data: buf } });
  return `/api/img/${id}`;
}
