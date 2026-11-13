import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="h1">Такой страницы нет</h1>
      <Link href="/" className="btn-primary mt-6">
        На главную
      </Link>
    </div>
  );
}
