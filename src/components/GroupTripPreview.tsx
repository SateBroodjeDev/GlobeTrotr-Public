import { Check, MapPin, Users } from "lucide-react";
import { useLocale } from "@/lib/locale";

/** Clearly labelled sample collaboration, with no real votes or customer data. */
export function GroupTripPreview() {
  const { text } = useLocale();
  return (
    <div className="group-trip-preview">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Users className="size-4" />
          {text("Onze volgende reis", "Our next trip")}
        </span>
        <span className="text-xs text-muted-foreground">{text("Voorbeeld", "Illustration")}</span>
      </div>
      <div className="group-trip-cover" aria-hidden="true">
        <svg viewBox="0 0 500 190" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width="500" height="190" fill="#e3eee9" />
          <circle cx="360" cy="68" r="35" fill="#f6d49b" />
          <path d="M0 122Q100 75 225 127T500 115V190H0Z" fill="#79b8bb" />
          <path d="M0 168Q112 115 245 158T500 151V190H0Z" fill="#efd6ab" />
          <path d="M0 190Q165 139 310 180T500 170V190Z" fill="#547e64" />
        </svg>
      </div>
      <div className="flex items-center gap-3 py-5">
        <div className="flex -space-x-2" aria-hidden="true">
          {["N", "S", "J", "M"].map((initial, index) => (
            <span key={initial} className={`group-avatar group-avatar--${index}`}>
              {initial}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {text("Vier reizigers. Eén plan.", "Four travellers. One plan.")}
        </p>
      </div>
      <p className="mb-3 font-display text-xl font-semibold">
        {text("Waar willen we naartoe?", "Where shall we go?")}
      </p>
      <div className="space-y-3">
        {[
          [
            text("Een week aan zee", "A week by the sea"),
            text("Strand en tijd voor elkaar", "Beach days and time together"),
            "w-3/4",
          ],
          [
            text("Een nieuwe stad ontdekken", "Explore a new city"),
            text("Cultuur, lekker eten en wandelen", "Culture, good food and walking"),
            "w-1/2",
          ],
        ].map(([title, body, width]) => (
          <div key={title} className="border-b pb-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="size-4 text-primary" />
              {title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            <div className="mt-3 h-1 rounded-full bg-primary/10">
              <div className={`h-full rounded-full bg-primary/60 ${width}`} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 flex items-center gap-2 text-sm text-primary">
        <Check className="size-4" />
        {text("Vergelijk opties en kies samen", "Compare options and choose together")}
      </p>
    </div>
  );
}
