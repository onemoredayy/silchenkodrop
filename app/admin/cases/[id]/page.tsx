import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { validateChances } from "@/lib/rng";
import { recalcCasePrice } from "@/lib/market";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const RARITY_LABEL: Record<string, string> = {
  COMMON: "Обычный",
  UNCOMMON: "Необычный",
  RARE: "Редкий",
  MYTHICAL: "Мифический",
  LEGENDARY: "Легендарный",
  ANCIENT: "Древний",
};

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0400-\u04FF]+/g, "-")
      .replace(/^-+|-+$/g, "") || "case"
  );
}

async function saveInfo(formData: FormData) {
  "use server";
  await requireAdmin();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();
  if (!name) throw new Error("Название обязательно");

  if (id === "new") {
    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const created = await prisma.case.create({
      data: { name, description, image, slug, price: 1, isActive: false },
    });
    revalidatePath("/admin/cases");
    redirect(`/admin/cases/${created.id}`);
  } else {
    await prisma.case.update({ where: { id }, data: { name, description, image } });
    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${id}`);
  }
}

async function deleteCase(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  try {
    await prisma.case.delete({ where: { id } });
  } catch {
    throw new Error("Нельзя удалить: по кейсу уже есть открытия");
  }
  revalidatePath("/admin/cases");
  redirect("/admin/cases");
}

async function addCaseItem(formData: FormData) {
  "use server";
  await requireAdmin();
  const caseId = String(formData.get("caseId"));
  const itemId = String(formData.get("itemId"));
  if (!itemId) return;

  await prisma.caseItem.upsert({
    where: { caseId_itemId: { caseId, itemId } },
    update: {},
    create: { caseId, itemId, dropChance: 1 },
  });
  await recalcCasePrice(caseId);
  revalidatePath(`/admin/cases/${caseId}`);
}

async function removeCaseItem(formData: FormData) {
  "use server";
  await requireAdmin();
  const caseId = String(formData.get("caseId"));
  const itemId = String(formData.get("itemId"));
  await prisma.caseItem.delete({ where: { caseId_itemId: { caseId, itemId } } });
  await recalcCasePrice(caseId);
  revalidatePath(`/admin/cases/${caseId}`);
}

async function saveChances(formData: FormData) {
  "use server";
  await requireAdmin();
  const caseId = String(formData.get("caseId"));

  const entries: { itemId: string; dropChance: number }[] = [];
  formData.forEach((value, key) => {
    if (key.startsWith("chance:")) {
      const itemId = key.slice("chance:".length);
      const dropChance = Number(value);
      entries.push({ itemId, dropChance });
    }
  });

  validateChances(entries);

  await prisma.$transaction(
    entries.map((e) =>
      prisma.caseItem.update({
        where: { caseId_itemId: { caseId, itemId: e.itemId } },
        data: { dropChance: e.dropChance },
      })
    )
  );
  await recalcCasePrice(caseId);
  revalidatePath(`/admin/cases/${caseId}`);
}

async function toggleActiveForm(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const isActive = formData.get("isActive") === "1";
  await prisma.case.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath(`/admin/cases/${id}`);
  revalidatePath("/admin/cases");
  revalidatePath("/");
}

export default async function AdminCasePage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  if (isNew) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/admin/cases" className="text-sm text-muted-foreground">
          ← Все кейсы
        </Link>
        <h2 className="text-xl font-bold">Новый кейс</h2>
        <form action={saveInfo} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <input type="hidden" name="id" value="new" />
          <input
            name="name"
            placeholder="Название кейса"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="Описание"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            name="image"
            placeholder="Ссылка на картинку (необязательно)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            Создать
          </Button>
        </form>
      </div>
    );
  }

  const [c, allItems] = await Promise.all([
    prisma.case.findUnique({
      where: { id: params.id },
      include: { items: { include: { item: true } } },
    }),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!c) notFound();

  const usedIds = new Set(c.items.map((ci) => ci.itemId));
  const available = allItems.filter((it) => !usedIds.has(it.id));
  const sumChance = c.items.reduce((s, ci) => s + ci.dropChance, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/cases" className="text-sm text-muted-foreground">
        ← Все кейсы
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{c.name}</h2>
        <form action={toggleActiveForm}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="isActive" value={c.isActive ? "1" : "0"} />
          <button
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              c.isActive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-zinc-500/20 text-zinc-400"
            }`}
          >
            {c.isActive ? "Показан на сайте" : "Скрыт"}
          </button>
        </form>
      </div>

      <form action={saveInfo} className="space-y-3 rounded-xl border border-border bg-card p-5">
        <input type="hidden" name="id" value={c.id} />
        <input
          name="name"
          defaultValue={c.name}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          defaultValue={c.description}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          name="image"
          defaultValue={c.image}
          placeholder="Ссылка на картинку"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Текущая цена: {c.price.toLocaleString("ru-RU")} ₽ (считается автоматически)
          </span>
          <Button type="submit" className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            Сохранить
          </Button>
        </div>
      </form>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h3 className="font-bold">Добавить предмет в кейс</h3>
        <form action={addCaseItem} className="flex flex-wrap gap-2">
          <input type="hidden" name="caseId" value={c.id} />
          <select
            name="itemId"
            required
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Выбери предмет...</option>
            {available.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} · {RARITY_LABEL[it.rarity] ?? it.rarity} · {it.price} ₽
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Добавить
          </Button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Шансы выпадения</h3>
          <span
            className={`text-sm font-semibold ${
              Math.abs(sumChance - 100) < 0.01 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            Сумма: {sumChance.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}%
          </span>
        </div>

        {c.items.length === 0 ? (
          <p className="text-muted-foreground">В кейсе нет предметов.</p>
        ) : (
          <form action={saveChances} className="space-y-2">
            <input type="hidden" name="caseId" value={c.id} />
            {c.items.map((ci) => (
              <div key={ci.itemId} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-muted-foreground">
                  {ci.item.price.toLocaleString("ru-RU")} ₽
                </span>
                <span className="flex-1 truncate">{ci.item.name}</span>
                <input
                  name={`chance:${ci.itemId}`}
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  defaultValue={ci.dropChance}
                  className="w-24 rounded-md border border-border bg-background px-2 py-1"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="submit" className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                Сохранить шансы
              </Button>
            </div>
          </form>
        )}

        {c.items.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            {c.items.map((ci) => (
              <div key={ci.itemId} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">{ci.item.name}</span>
                <form action={removeCaseItem}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="itemId" value={ci.itemId} />
                  <button type="submit" className="text-red-400 underline underline-offset-4">
                    Убрать
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <form action={deleteCase}>
        <input type="hidden" name="id" value={c.id} />
        <button type="submit" className="text-sm text-red-400 underline underline-offset-4">
          Удалить кейс целиком
        </button>
      </form>
    </div>
  );
}
