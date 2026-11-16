import { redirect } from "next/navigation";

// Инвентарь переехал в профиль
export default function InventoryPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const q = new URLSearchParams();
  if (searchParams.tab) q.set("tab", searchParams.tab);
  if (searchParams.page) q.set("page", searchParams.page);
  redirect(`/profile${q.size ? `?${q}` : ""}#inventory`);
}
