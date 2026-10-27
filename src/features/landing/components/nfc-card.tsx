import s from "./landing.module.css";

/** The ))) symbol printed on NFC cards. */
export function NfcGlyph({ className = "", strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className={className} aria-hidden>
      <path d="M5 8.6a4.6 4.6 0 0 1 0 6.8" />
      <path d="M8.6 5.8a8.6 8.6 0 0 1 0 12.4" />
      <path d="M12.2 3a12.6 12.6 0 0 1 0 18" />
    </svg>
  );
}

const FOIL = "linear-gradient(140deg, #10393a 0%, #0a1f20 46%, #0a0c0f 100%)";
const GOLD = "linear-gradient(135deg, #ecd48f 0%, #b88f36 55%, #e6c77b 100%)";

/**
 * Front of a Namma Info card. Sizes are in container-query units (cqw),
 * so the same card looks right at 120px or 440px wide.
 */
export function NfcCardFront({
  name = "Adithya Puthraya",
  business = "Namma Info",
  withSheen = true,
}: {
  name?: string;
  business?: string;
  withSheen?: boolean;
}) {
  return (
    <span
      className="relative block h-full w-full overflow-clip rounded-[inherit] text-left text-[#efe7d2] shadow-[0_40px_80px_-30px_rgba(5,30,30,0.65)]"
      style={{ background: FOIL, containerType: "inline-size", boxShadow: "inset 0 0 0 1px rgba(217,181,94,0.3)" }}
    >
      {/* fine engraved lines, like on a bank card */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.2]" viewBox="0 0 320 202" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <path
            key={i}
            d={`M -20 ${170 - i * 8} C 70 ${120 - i * 8}, 210 ${215 - i * 8}, 340 ${118 - i * 8}`}
            fill="none"
            stroke="#d9b55e"
            strokeWidth="0.5"
          />
        ))}
      </svg>
      <span className={`${s.display} absolute left-[7%] top-[9%] text-[5.6cqw] font-semibold`}>namma info</span>
      <NfcGlyph className="absolute right-[6.5%] top-[8%] h-[13cqw] w-[13cqw] text-[#d9b55e]" strokeWidth={1.6} />
      {/* chip */}
      <span className="absolute left-[7%] top-[35%] h-[21%] w-[15.5%] overflow-clip rounded-[1.6cqw]" style={{ background: GOLD }}>
        <svg viewBox="0 0 50 42" className="h-full w-full opacity-60" aria-hidden>
          <path d="M0 14h17M0 28h17M33 14h17M33 28h17M17 0v42M33 0v42M17 21h16" stroke="#7a5a18" strokeWidth="1.2" fill="none" />
        </svg>
      </span>
      <span className="absolute bottom-[9%] left-[7%] right-[7%]">
        <span className="block text-[6.4cqw] font-medium leading-tight tracking-[-0.01em] text-[#f6efdc]">{name}</span>
        <span className="mt-[0.6cqw] block text-[3.6cqw] text-[#b9b096]">{business}</span>
      </span>
      {withSheen && <span className={s.sheen} />}
    </span>
  );
}

export function NfcCardBack({ link = "nammainfo.in/adithya-puthraya" }: { link?: string }) {
  return (
    <span
      className="relative block h-full w-full overflow-clip rounded-[inherit] text-[#efe7d2]"
      style={{ background: "linear-gradient(200deg, #0d2f30 0%, #081516 55%, #07090b 100%)", containerType: "inline-size", boxShadow: "inset 0 0 0 1px rgba(217,181,94,0.3)" }}
    >
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqw] text-center">
        <NfcGlyph className="h-[20cqw] w-[20cqw] text-[#d9b55e]" strokeWidth={1.4} />
        <span className="text-[4.6cqw] font-medium text-[#f6efdc]">Hold on the back of any phone</span>
        <span className="text-[3.4cqw] text-[#b9b096]">{link}</span>
      </span>
      <span className={s.sheen} />
    </span>
  );
}
