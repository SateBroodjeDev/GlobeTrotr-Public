import {
  BedDouble,
  BookHeart,
  CalendarDays,
  Check,
  MapPin,
  Plane,
  Users,
  Wallet,
} from "lucide-react";
import { useLocale } from "@/lib/locale";

/** Small explanatory illustrations, not screenshots or a second product demo. */
export function FeatureIllustration({ phase = 0 }: { phase?: number }) {
  const { text } = useLocale();
  return (
    <div className={`feature-illustration feature-tone-${phase % 3}`}>
      <div className="mb-6 flex items-center justify-between gap-3 text-xs font-medium">
        <span className="flex items-center gap-2">
          <MapPin className="size-4" />
          {text("Een week Portugal", "A week in Portugal")}
        </span>
        <span className="rounded-full bg-background/70 px-3 py-1.5">
          {text("Voorbeeld", "Illustration")}
        </span>
      </div>
      {phase === 0 ? (
        <div className="space-y-5">
          <svg viewBox="0 0 360 165" className="h-40 w-full" aria-hidden="true">
            <path
              d="M42 125 C100 125 76 30 176 45 S245 155 318 38"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="6 7"
              opacity=".65"
            />
            {[
              [42, 125],
              [176, 45],
              [318, 38],
            ].map(([x, y], i) => (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  fill="var(--card)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="currentColor">
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-medium">
            {[text("Lissabon", "Lisbon"), "Sintra", "Porto"].map((name) => (
              <span key={name} className="rounded-xl bg-background/75 px-2 py-3">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : phase === 1 || phase === 2 ? (
        <div className="space-y-3">
          {[
            { icon: Plane, time: "09:30", label: text("Aankomst in Lissabon", "Arrive in Lisbon") },
            {
              icon: BedDouble,
              time: "15:00",
              label: text("Inchecken bij je verblijf", "Check in at your stay"),
            },
            {
              icon: CalendarDays,
              time: "18:30",
              label: text("Samen de stad in", "Explore the city together"),
            },
          ].map(({ icon: Icon, time, label }) => (
            <div key={time} className="flex items-center gap-3 rounded-2xl bg-background/80 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-current/5">
                <Icon className="size-5" />
              </span>
              <div>
                <span className="text-xs opacity-70">{time}</span>
                <p className="text-sm font-medium">{label}</p>
              </div>
              {phase === 2 && <Check className="ml-auto size-4 shrink-0" />}
            </div>
          ))}
        </div>
      ) : phase === 3 ? (
        <div className="rounded-2xl bg-background/80 p-6">
          <Wallet className="mb-5 size-7" />
          <p className="text-sm opacity-75">{text("Diner voor twee", "Dinner for two")}</p>
          <p className="mt-1 font-display text-4xl font-semibold">€120</p>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-current/15 pt-4">
            {["Noor", "Sam"].map((name) => (
              <div key={name}>
                <span className="text-xs opacity-70">{name}</span>
                <p className="mt-1 text-xl font-semibold">€60</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs opacity-75">
            {text("Gelijk verdeeld. Geen bankoverboeking.", "Split equally. No bank transfer.")}
          </p>
        </div>
      ) : phase === 4 ? (
        <div className="space-y-3">
          {[
            ["N", "Noor", text("Plant de route", "Plans the route")],
            ["S", "Sam", text("Houdt kosten bij", "Tracks expenses")],
            ["J", "Jules", text("Kijkt mee", "Follows along")],
          ].map(([initial, name, role]) => (
            <div key={name} className="flex items-center gap-3 rounded-2xl bg-background/80 p-4">
              <span className="grid size-11 place-items-center rounded-full bg-current/5 font-semibold">
                {initial}
              </span>
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-1 text-xs opacity-75">{role}</p>
              </div>
              <Users className="ml-auto size-4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-background/80">
          <div
            className="relative h-32 overflow-hidden bg-gradient-to-br from-teal-700 via-cyan-700 to-amber-200"
            aria-hidden="true"
          >
            <div className="absolute -bottom-12 -left-4 h-32 w-56 rotate-12 rounded-[50%] bg-teal-950/50" />
            <BookHeart className="absolute right-5 top-5 size-7 text-white" />
          </div>
          <div className="p-5">
            <p className="text-xs opacity-70">{text("Porto · Dag 5", "Porto · Day 5")}</p>
            <p className="mt-2 font-display text-xl font-semibold">
              {text("Nog even langs de rivier", "One more walk by the river")}
            </p>
            <p className="mt-3 text-sm opacity-75">
              {text(
                "Een plek voor de momenten die je wilt onthouden.",
                "A place for the moments you want to remember.",
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
