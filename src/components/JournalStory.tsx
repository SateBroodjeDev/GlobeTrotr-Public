import { useId, type ReactNode } from "react";
import { BookHeart, MapPin } from "lucide-react";
import { useLocale } from "@/lib/locale";

export type StoryChapter = {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  body: string;
  photo?: string;
  author?: string;
};

/** Presentation only: callers supply already authorized entries and their own actions. */
export function JournalStory<T extends StoryChapter>({
  title, entries, renderEntry,
}: { title: string; entries: T[]; renderEntry?: (entry: T) => ReactNode }) {
  const { text, locale } = useLocale();
  const id = useId();
  const chapters = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const cover = chapters.find((entry) => entry.photo)?.photo;
  return <section className="space-y-6" aria-label={text("Reisverhaal", "Travel story")}>
    <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-primary/10">
      {cover && <img src={cover} alt="" className="absolute inset-0 -z-10 size-full object-cover" />}
      <div className={`px-6 py-10 sm:px-10 sm:py-16 ${cover ? "bg-gradient-to-t from-black/85 via-black/45 to-black/20 text-white" : "bg-gradient-to-br from-primary/15 via-background/40 to-amber-200/15"}`}>
        <BookHeart className="mb-5 size-7" />
        <p className="text-xs font-semibold uppercase tracking-[.2em]">{text("Ons reisverhaal", "Our travel story")}</p>
        <h3 className="mt-3 break-words font-display text-3xl font-semibold sm:text-5xl">{title}</h3>
        <p className="mt-4 max-w-xl text-sm leading-7 opacity-85">{text("De plekken die je bezocht. De momenten die je bijblijven.", "The places you visited. The moments that stay with you.")}</p>
        <p className="mt-5 text-xs opacity-80">{chapters.length} {text(chapters.length === 1 ? "herinnering · op volgorde van de reis" : "herinneringen · op volgorde van de reis", chapters.length === 1 ? "memory · in journey order" : "memories · in journey order")}</p>
      </div>
    </header>
    {chapters.length > 1 && <nav className="flex flex-wrap gap-2" aria-label={text("Hoofdstukken", "Chapters")}>
      {chapters.map((entry, index) => <a key={entry.id} href={`#${id}-${index}`} className="max-w-full truncate rounded-full border px-4 py-2 text-sm hover:bg-muted">{index + 1}. {entry.title}</a>)}
    </nav>}
    <div className="space-y-8">
      {chapters.map((entry, index) => <div key={entry.id} id={`${id}-${index}`} className="scroll-mt-24">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground"><span className="font-semibold text-primary">{String(index + 1).padStart(2, "0")}</span><time dateTime={entry.date}>{new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${entry.date}T12:00:00`))}</time></div>
        {renderEntry ? renderEntry(entry) : <article className="overflow-hidden rounded-2xl border bg-card">
          {entry.photo && <img src={entry.photo} alt="" loading="lazy" className="max-h-96 w-full object-cover" />}
          <div className="p-6 sm:p-8"><h4 className="break-words font-display text-2xl font-semibold">{entry.title}</h4>
            {entry.location && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{entry.location}</p>}
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{entry.body}</p>
            {entry.author && <p className="mt-5 text-xs text-muted-foreground">{text("Door", "By")} {entry.author}</p>}
          </div>
        </article>}
      </div>)}
    </div>
  </section>;
}
