import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { EXT_TYPE, UPLOAD_DIR } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// Старые ссылки на картинки (/api/uploads/<хеш>.png): сначала база, потом папка uploads/
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const m = /^([a-f0-9]{20})(\.(png|jpg|webp|gif|avif))$/.exec(params.name);
  if (!m) return new Response("Not found", { status: 404 });
  const headers = { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
  const img = await prisma.upload.findUnique({ where: { id: m[1] } });
  if (img) return new Response(new Uint8Array(img.data), { headers: { ...headers, "Content-Type": img.type } });
  for (const dir of [UPLOAD_DIR, "/opt/silchenkodrop/uploads"]) {
    try {
      const buf = await readFile(path.join(dir, params.name));
      return new Response(new Uint8Array(buf), { headers: { ...headers, "Content-Type": EXT_TYPE[m[2]] } });
    } catch {}
  }
  return new Response("Not found", { status: 404 });
}
