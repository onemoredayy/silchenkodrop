export default function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="rounded bg-raised" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="grid place-items-center rounded bg-stencil font-display text-ground"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {(name || "С").charAt(0).toUpperCase()}
    </span>
  );
}
