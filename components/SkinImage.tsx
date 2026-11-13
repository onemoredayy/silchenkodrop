// Картинка скина; если её нет — силуэт с названием оружия
export default function SkinImage({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} loading="lazy" className={`object-contain ${className}`} />;
  }
  return (
    <div className={`grid place-items-center text-center font-display text-xs text-dust/70 ${className}`}>
      {name.split(" | ")[0]}
    </div>
  );
}
