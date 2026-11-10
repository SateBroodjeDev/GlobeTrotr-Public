/** Compact header lockup with readable text at interface sizes. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="GlobeTrotr" className={`inline-flex shrink-0 items-center gap-2.5 align-middle ${className}`}>
      <img
        src="/assets/brand/logo.png?v=20261019"
        alt=""
        aria-hidden="true"
        width={1024}
        height={1024}
        className="size-8 shrink-0 rounded-lg object-contain sm:size-9"
      />
      <span aria-hidden="true" className="font-display text-lg font-semibold tracking-tight text-foreground">GlobeTrotr</span>
    </span>
  );
}
