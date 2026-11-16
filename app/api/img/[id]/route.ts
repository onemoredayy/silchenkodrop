import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Отдаёт картинку, загруженную в админке
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.[a-z]+$/, ""); // на всякий случай терпим расширение
  if (!/^[a-f0-9]{20}$/.test(id)) return new Response("Not found", { status: 404 });
  const img = await prisma.upload.findUnique({ where: { id } });
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable", // id = хеш содержимого
      "X-Content-Type-Options": "nosniff",
    },
  });
}
