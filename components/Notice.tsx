export default function Notice({ error, ok, warn }: { error?: string; ok?: string; warn?: string }) {
  if (error) return <p className="mb-4 rounded border border-danger/50 px-3 py-2 text-sm text-danger">{error}</p>;
  if (warn)
    return (
      <p className="mb-4 rounded border border-stencil/50 px-3 py-2 text-sm text-stencil">
        Сохранено, но сумма шансов не 100%. Кейс не откроется, пока не поправишь.
      </p>
    );
  if (ok) return <p className="mb-4 rounded border border-ok/50 px-3 py-2 text-sm text-ok">Сохранено.</p>;
  return null;
}
