import Link from "next/link";

// Листалка страниц. href — для серверных страниц (ссылки), onPage — для клиентских списков (кнопки).
export default function Pager({
  page,
  pages,
  href,
  onPage,
  className = "",
}: {
  page: number;
  pages: number;
  href?: (page: number) => string;
  onPage?: (page: number) => void;
  className?: string;
}) {
  if (pages <= 1) return null;
  const btn = "btn-ghost h-9 px-3";
  const off = `${btn} pointer-events-none opacity-40`;
  const go = (p: number, label: string, enabled: boolean) =>
    href ? (
      enabled ? (
        <Link href={href(p)} className={btn}>
          {label}
        </Link>
      ) : (
        <span className={off}>{label}</span>
      )
    ) : (
      <button type="button" onClick={() => onPage?.(p)} disabled={!enabled} className={btn}>
        {label}
      </button>
    );
  return (
    <div className={`flex items-center justify-center gap-3 text-sm ${className}`}>
      {go(page - 1, "Назад", page > 1)}
      <span className="whitespace-nowrap text-dust">
        {page} из {pages}
      </span>
      {go(page + 1, "Вперёд", page < pages)}
    </div>
  );
}
