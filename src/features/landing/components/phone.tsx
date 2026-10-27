/** A plain phone outline. Screen contents are sized in cqw (screen width). */
export default function Phone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative aspect-[9/19] w-full rounded-[14%/6.6%] bg-[var(--lp-phone)] p-[3.4%] shadow-[0_50px_90px_-40px_rgba(10,20,30,0.55),inset_0_0_0_1.5px_rgba(255,255,255,0.08)] ${className}`}
    >
      <div className="relative h-full w-full overflow-clip rounded-[11%/5.2%] bg-[#f6f7f8] text-[#14171c]" style={{ containerType: "inline-size" }}>
        {children}
        <div className="absolute left-1/2 top-[1.7%] z-40 h-[3.5%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}
