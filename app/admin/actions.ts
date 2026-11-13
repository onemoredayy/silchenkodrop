"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { RARITIES } from "@/lib/rarity";
import { round2 } from "@/lib/format";
import { updateAllPrices } from "@/lib/prices";
import { findDefault } from "@/lib/catalog";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(String(f.get(k) ?? "").replace(",", "."));

function slugify(s: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
    л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- Кейсы ----------

export async function saveCase(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const price = num(formData, "price");
  const back = id ? `/admin/cases/${id}` : "/admin/cases/new";
  if (!name) redirect(`${back}?error=${encodeURIComponent("Укажи название")}`);
  if (!Number.isFinite(price) || price <= 0) redirect(`${back}?error=${encodeURIComponent("Цена должна быть больше нуля")}`);

  const slug = slugify(str(formData, "slug") || name) || `case-${Date.now()}`;
  const clash = await prisma.case.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) redirect(`${back}?error=${encodeURIComponent(`Адрес «${slug}» уже занят`)}`);

  const data = {
    name,
    slug,
    price: round2(price),
    image: str(formData, "image") || null,
    description: str(formData, "description") || null,
    isActive: formData.get("isActive") === "on",
    sortOrder: Number(str(formData, "sortOrder")) || 0,
    sectionId: str(formData, "sectionId") || null,
  };
  const kase = id
    ? await prisma.case.update({ where: { id }, data })
    : await prisma.case.create({ data });
  revalidatePath("/", "layout");
  redirect(`/admin/cases/${kase.id}?ok=1`);
}

export async function deleteCase(formData: FormData) {
  await requireAdmin();
  await prisma.case.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/", "layout");
  redirect("/admin/cases");
}

// Редактор шансов: все строки сразу, сумма должна быть ровно 100%
export async function saveChances(formData: FormData) {
  await requireAdmin();
  const caseId = str(formData, "caseId");
  const back = `/admin/cases/${caseId}`;
  const rows = await prisma.caseItem.findMany({ where: { caseId } });

  const keep: { id: string; chance: number }[] = [];
  const remove: string[] = [];
  for (const r of rows) {
    if (formData.get(`remove_${r.id}`) === "on") {
      remove.push(r.id);
      continue;
    }
    const c = num(formData, `chance_${r.id}`);
    if (!Number.isFinite(c) || c < 0) redirect(`${back}?error=${encodeURIComponent("Шанс не может быть отрицательным")}`);
    keep.push({ id: r.id, chance: c });
  }

  const addName = str(formData, "addName");
  const addChance = num(formData, "addChance");
  let addItemId = "";
  if (addName) {
    const existing = await prisma.item.findFirst({ where: { name: addName } });
    if (existing) addItemId = existing.id;
    else {
      const cat = await findDefault(prisma, addName);
      if (!cat) redirect(`${back}?error=${encodeURIComponent(`Скина «${addName}» нет в каталоге`)}`);
      const item = await prisma.item.create({
        data: {
          name: cat.baseName,
          rarity: cat.rarity,
          price: cat.price ?? 0,
          image: cat.image,
          wear: cat.wear,
          marketHashName: cat.marketHashName,
        },
      });
      addItemId = item.id;
    }
  }
  const adding = !!addItemId;
  if (adding) {
    if (!Number.isFinite(addChance) || addChance < 0) redirect(`${back}?error=${encodeURIComponent("Укажи шанс нового предмета")}`);
    if (rows.some((r) => r.itemId === addItemId && !remove.includes(r.id)))
      redirect(`${back}?error=${encodeURIComponent("Этот предмет уже в кейсе")}`);
  }

  const sum = round2(keep.reduce((s, k) => s + k.chance, 0) + (adding ? addChance : 0));
  const sumOk = Math.abs(sum - 100) <= 0.01;
  // сохранить с неверной суммой можно только выключенный кейс
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!sumOk && kase?.isActive) {
    redirect(`${back}?error=${encodeURIComponent(`Сумма шансов ${sum}%, а должна быть 100%. Поправь или выключи кейс.`)}`);
  }

  await prisma.$transaction([
    prisma.caseItem.deleteMany({ where: { id: { in: remove } } }),
    ...keep.map((k) => prisma.caseItem.update({ where: { id: k.id }, data: { dropChance: k.chance } })),
    ...(adding ? [prisma.caseItem.create({ data: { caseId, itemId: addItemId, dropChance: addChance } })] : []),
  ]);
  revalidatePath("/", "layout");
  redirect(`${back}?ok=1${sumOk ? "" : "&warn=1"}`);
}

// ---------- Предметы ----------

export async function saveItem(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const back = id ? `/admin/items/${id}` : "/admin/items/new";
  const name = str(formData, "name");
  const rarity = str(formData, "rarity");
  const price = num(formData, "price");
  if (!name) redirect(`${back}?error=${encodeURIComponent("Укажи название")}`);
  if (!RARITIES.includes(rarity as never)) redirect(`${back}?error=${encodeURIComponent("Неизвестная редкость")}`);
  if (!Number.isFinite(price) || price < 0) redirect(`${back}?error=${encodeURIComponent("Неверная цена")}`);

  let marketHashName: string | null = str(formData, "marketHashName") || null;
  if (marketHashName) {
    const cat = await prisma.skinCatalog.findUnique({ where: { marketHashName } });
    if (!cat) redirect(`${back}?error=${encodeURIComponent("Такого скина нет в каталоге")}`);
  }
  const data = {
    name,
    rarity,
    price: round2(price),
    image: str(formData, "image") || null,
    wear: str(formData, "wear") || null,
    statTrak: formData.get("statTrak") === "on",
    marketHashName,
  };
  const item = id ? await prisma.item.update({ where: { id }, data }) : await prisma.item.create({ data });
  revalidatePath("/", "layout");
  redirect(`/admin/items/${item.id}?ok=1`);
}

// Привязать к скину из каталога: имя, картинка, качество, редкость берутся оттуда
export async function linkItemToCatalog(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const cat = await prisma.skinCatalog.findUnique({ where: { marketHashName: str(formData, "marketHashName") } });
  if (!cat) redirect(`/admin/items/${id || "new"}?error=${encodeURIComponent("Скин не найден")}`);
  const data = {
    name: cat.name,
    rarity: cat.rarity,
    image: cat.image,
    wear: cat.wear,
    marketHashName: cat.marketHashName,
  };
  const item = id
    ? await prisma.item.update({ where: { id }, data })
    : await prisma.item.create({ data: { ...data, price: cat.price ?? 0 } });
  revalidatePath("/", "layout");
  redirect(`/admin/items/${item.id}?ok=1`);
}

export async function deleteItem(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const used = await prisma.inventoryItem.count({ where: { itemId: id } });
  if (used > 0) {
    redirect(`/admin/items/${id}?error=${encodeURIComponent("Предмет уже есть в инвентарях игроков — его нельзя удалить. Убери его из кейсов.")}`);
  }
  await prisma.item.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/admin/items");
}

// ---------- Пользователи ----------

export async function grantBalance(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const amount = round2(num(formData, "amount"));
  if (!Number.isFinite(amount) || amount === 0) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { balance: { increment: amount } } }),
    prisma.transaction.create({
      data: {
        userId,
        type: "ADMIN",
        amount,
        meta: JSON.stringify({ by: admin.username, note: str(formData, "note") }),
      },
    }),
  ]);
  revalidatePath("/admin/users");
}

export async function toggleBan(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  if (userId === admin.id) return;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  await prisma.user.update({ where: { id: userId }, data: { isBanned: !u.isBanned } });
  revalidatePath("/admin/users");
}

export async function toggleAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  if (userId === admin.id) return;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return;
  await prisma.user.update({ where: { id: userId }, data: { role: u.role === "ADMIN" ? "USER" : "ADMIN" } });
  revalidatePath("/admin/users");
}

// ---------- Настройки ----------

const LIMITS: Record<string, number> = { usdRub: 1000 };

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const v = num(formData, key);
    const max = LIMITS[key] ?? 100;
    if (!Number.isFinite(v) || v < 0 || v > max) {
      redirect(`/admin/settings?error=${encodeURIComponent(`Неверное значение: ${key} (от 0 до ${max})`)}`);
    }
    await prisma.siteSetting.upsert({ where: { key }, update: { value: String(v) }, create: { key, value: String(v) } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/settings?ok=1");
}

export async function updatePricesNow() {
  await requireAdmin();
  try {
    const r = await updateAllPrices(prisma);
    revalidatePath("/", "layout");
    redirect(`/admin?msg=${encodeURIComponent(`Цены обновлены: ${r.updated} изменилось, курс $1 = ${r.rate} ₽`)}`);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(`/admin?error=${encodeURIComponent(`Не удалось обновить цены: ${(e as Error).message}`)}`);
  }
}

// ---------- Блоки ----------

export async function saveSection(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!name) redirect(`/admin/sections?error=${encodeURIComponent("Укажи название блока")}`);
  const sortOrder = Number(str(formData, "sortOrder")) || 0;
  if (id) {
    await prisma.caseSection.update({ where: { id }, data: { name, sortOrder } });
  } else {
    const slug = slugify(name) || `block-${Date.now()}`;
    const clash = await prisma.caseSection.findUnique({ where: { slug } });
    await prisma.caseSection.create({ data: { name, sortOrder, slug: clash ? `${slug}-${Date.now()}` : slug } });
  }
  revalidatePath("/", "layout");
  redirect("/admin/sections?ok=1");
}

export async function deleteSection(formData: FormData) {
  await requireAdmin();
  // кейсы блока не удаляются — попадут в «Другие кейсы»
  await prisma.caseSection.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/", "layout");
  redirect("/admin/sections?ok=1");
}
