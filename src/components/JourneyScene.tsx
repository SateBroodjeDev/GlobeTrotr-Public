import { BriefcaseBusiness, Check, MapPin, Users, Wallet } from "lucide-react";
import { useLocale } from "@/lib/locale";

/** An illustrative preview, not live availability or customer data. */
export function JourneyScene({
  variant = "travelers",
}: {
  variant?: "travelers" | "groups" | "agency";
}) {
  const { text } = useLocale();
  if (variant === "agency") {
    return (
      <div className="journey-studio">
        <div className="flex items-center justify-between border-b pb-5">
          <span className="flex items-center gap-2 font-semibold">
            <BriefcaseBusiness className="size-5 text-primary" />
            {text("Jouw reisstudio", "Your travel studio")}
          </span>
          <span className="text-xs text-muted-foreground">{text("Voorbeeld", "Illustration")}</span>
        </div>
        <p className="mt-8 text-xs uppercase tracking-[.2em] text-muted-foreground">
          {text("Van aanvraag naar vertrek", "From enquiry to departure")}
        </p>
        <div className="mt-5 space-y-5">
          {[
            [
              text("01 / Klantaanvraag", "01 / Client enquiry"),
              text("Een reis op maat", "A tailored journey"),
              "w-1/3",
            ],
            [
              text("02 / Reisvoorstel", "02 / Travel proposal"),
              text("Route, verblijf en offerte", "Route, stays and quote"),
              "w-2/3",
            ],
            [
              text("03 / Klaar voor vertrek", "03 / Ready to depart"),
              text("Reisdocumenten in jouw huisstijl", "Travel documents in your brand"),
              "w-full",
            ],
          ].map(([label, title, width]) => (
            <div key={label} className="border-l-2 border-primary/30 pl-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-lg font-medium">{title}</p>
              <div className="mt-3 h-1 rounded-full bg-primary/10">
                <div className={`h-full rounded-full bg-primary/60 ${width}`} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 flex items-center gap-2 text-sm text-primary">
          <Check className="size-4" />
          {text("Jouw team. Jouw merk. Eén werkplek.", "Your team. Your brand. One workspace.")}
        </p>
      </div>
    );
  }
  return (
    <div className={`journey-scene journey-scene--${variant}`}>
      <svg viewBox="0 0 640 520" className="journey-landscape" aria-hidden="true">
        <rect width="640" height="520" fill="#e3eee9" />
        <circle cx="190" cy="120" r="55" fill="#f6d49b" />
        {/* Coast, city and open countryside: no single destination implied. */}
        <path d="M270 280 405 152 520 284 602 210 640 250V520H270Z" fill="#9bbcad" />
        <path d="M0 270Q100 243 240 284T640 289V520H0Z" fill="#79b8bb" />
        <path d="M0 318Q160 283 247 344T465 354L640 380V520H0Z" fill="#3a8b92" />
        <path d="M0 385Q120 309 245 352T440 360L640 407V520H0Z" fill="#efd6ab" />
        <path
          d="M345 328V262H383V228L402 213 421 228V262H455V243H497V295H538V247L560 230 582 247V328Z"
          fill="#d8a57b"
        />
        <path
          d="M368 328V283H404V252H437V328M469 328V269H482V328M550 328V268H566V328"
          fill="#f5e6cc"
        />
        <path d="M0 455Q144 356 292 407T640 352V520H0Z" fill="#547e64" />
        <path d="M0 495Q149 416 307 462T640 435V520H0Z" fill="#173e39" />
        <path
          d="M42 291Q83 280 121 286M150 310Q188 300 223 310"
          fill="none"
          stroke="#d5eeea"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M88 434C148 350 252 472 333 404S448 351 541 352"
          fill="none"
          stroke="#f5d9ac"
          strokeWidth="3"
          strokeDasharray="7 9"
        />
        {[
          [88, 434],
          [333, 404],
          [541, 352],
        ].map(([cx, cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r="9" fill="#f5d9ac" />
            <circle cx={cx} cy={cy} r="3" fill="#244f48" />
          </g>
        ))}
        <path
          d="M68 402Q90 372 85 324M85 337Q50 310 29 336Q53 327 85 337M85 337Q103 304 133 316Q106 322 85 337M85 337Q69 300 47 310Q74 322 85 337"
          fill="none"
          stroke="#244f48"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="m580 395 17-43 18 43h-11v20h-13v-20Z" fill="#173e39" />
      </svg>
      <div className="journey-caption">
        <p className="text-xs uppercase tracking-[.2em] text-white/75">
          {text("Een reis om naar uit te kijken", "A journey to look forward to")}
        </p>
        <p className="mt-2 font-display text-3xl font-semibold text-white">
          {text("Het avontuur begint hier.", "Adventure starts here.")}
        </p>
      </div>
      <div className="journey-note">
        {variant === "groups" ? (
          <Users className="size-5 text-primary" />
        ) : (
          <MapPin className="size-5 text-primary" />
        )}
        <div>
          <p className="font-semibold">
            {variant === "groups"
              ? text("Samen op pad", "On the road together")
              : text("Jouw volgende stop", "Your next stop")}
          </p>
          <p className="text-xs text-muted-foreground">
            {text("Zon, stad of natuur", "Sun, city or nature")}
          </p>
        </div>
      </div>
      {variant === "groups" && (
        <div className="journey-group-note">
          <Wallet className="size-4" />
          <span>{text("Samen plannen. Eerlijk delen.", "Plan together. Share fairly.")}</span>
        </div>
      )}
    </div>
  );
}
