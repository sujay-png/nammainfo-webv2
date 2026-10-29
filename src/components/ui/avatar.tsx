import { initials } from "@/lib/utils";

/** Photo if there is one, otherwise initials on a neutral tile. */
export default function Avatar({
  name,
  src,
  size = 40,
  shape = "circle",
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  shape?: "circle" | "rounded";
}) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-[22%]";
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" style={style} className={`${radius} shrink-0 object-cover ring-1 ring-black/[0.06]`} />;
  }
  return (
    <span
      style={style}
      className={`${radius} flex shrink-0 select-none items-center justify-center bg-[var(--muted)] font-medium text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--border)]`}
    >
      {initials(name)}
    </span>
  );
}
