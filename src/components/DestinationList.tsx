import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { destinationDrag } from "@/lib/destination-drag";
import { ArrowDown, ArrowUp, CalendarDays, GripVertical, Trash2 } from "lucide-react";
import { useLocale } from "@/lib/locale";

const control = "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none";
const arrowControl = `${control} hover:bg-primary/15 hover:text-primary focus-visible:bg-primary/15 focus-visible:text-primary active:bg-primary/20`;

export function DestinationControls({ name, index, total, onMove, onRemove, onEditDate }: {
  name: string; index: number; total: number; onMove: (direction: -1 | 1) => void; onRemove: () => void; onEditDate?: () => void;
}) {
  const { text } = useLocale();
  return <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
    <button type="button" data-destination-drag disabled={total < 2}
      className={`${arrowControl} mr-auto touch-none select-none cursor-grab active:cursor-grabbing sm:hidden [@media(pointer:coarse)]:inline-flex`}
      aria-label={text(`Versleep bestemming ${name}`, `Drag destination ${name}`)}
      title={text("Sleep om de volgorde te wijzigen; je kunt ook de pijltjes gebruiken", "Drag to reorder; you can also use the arrows")}
      onClick={event => event.stopPropagation()}><GripVertical className="size-5" aria-hidden="true" /></button>
    {onEditDate && <button type="button" className={arrowControl}
      aria-label={text(`Datum wijzigen voor ${name}`, `Change date for ${name}`)}
      title={text("Bestemmingsdatum wijzigen", "Change destination date")}
      onClick={event => { event.stopPropagation(); onEditDate(); }}><CalendarDays className="size-4" aria-hidden="true" /></button>}
    <button type="button" data-reorder-destination disabled={index === 0} className={arrowControl}
      aria-label={text("Bestemming omhoog", "Move destination up")} title={text(`${name} omhoog verplaatsen`, `Move ${name} up`)}
      onClick={event => { event.stopPropagation(); onMove(-1); }}><ArrowUp className="size-5" aria-hidden="true" /></button>
    <button type="button" data-reorder-destination disabled={index === total - 1} className={arrowControl}
      aria-label={text("Bestemming omlaag", "Move destination down")} title={text(`${name} omlaag verplaatsen`, `Move ${name} down`)}
      onClick={event => { event.stopPropagation(); onMove(1); }}><ArrowDown className="size-5" aria-hidden="true" /></button>
    <button type="button" className={`${control} hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive`}
      aria-label={text("Verwijder bestemming", "Delete destination")} title={text(`${name} verwijderen`, `Delete ${name}`)}
      onClick={event => { event.stopPropagation(); onRemove(); }}><Trash2 className="size-4" aria-hidden="true" /></button>
  </div>;
}

/** Animate existing keyed rows; ordering, focus and persistence remain React-owned. */
export function DestinationList({ order, children, onReorder }: {
  order: string[]; children: ReactNode; onReorder?: (source: string, target: string) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  const animations = useRef<Animation[]>([]);
  const orderKey = JSON.stringify(order);
  const reorder = useRef(onReorder);
  reorder.current = onReorder;
  const drag = useRef<ReturnType<typeof destinationDrag> | null>(null);
  const cancel = () => {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  };
  const measure = () => new Map(Array.from(list.current?.children ?? []).flatMap(node => {
    const element = node as HTMLElement;
    const id = element.dataset.destinationId;
    return id ? [[id, element.getBoundingClientRect()] as const] : [];
  }));

  useLayoutEffect(() => {
    drag.current?.cancel();
    cancel();
    const previous = positions.current;
    const current = measure();
    positions.current = current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const node of Array.from(list.current?.children ?? [])) {
      const element = node as HTMLElement;
      const id = element.dataset.destinationId;
      const before = id ? previous.get(id) : undefined;
      const after = id ? current.get(id) : undefined;
      if (!before || !after || typeof element.animate !== "function") continue;
      const x = before.left - after.left, y = before.top - after.top;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;
      animations.current.push(element.animate([
        { transform: `translate(${x}px, ${y}px)` },
        { transform: "translate(0, 0)" },
      ], { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" }));
    }
  }, [orderKey]);

  useEffect(() => {
    if (list.current) drag.current = destinationDrag(list.current, {
      enabled: () => Boolean(reorder.current),
      beforeDrag: () => { cancel(); positions.current = measure(); },
      beforeDrop: () => { positions.current = measure(); },
      drop: (source, target) => reorder.current?.(source, target),
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { if (preference.matches) cancel(); };
    preference.addEventListener("change", change);
    return () => { drag.current?.destroy(); drag.current = null; cancel(); preference.removeEventListener("change", change); };
  }, []);

  return <ul ref={list} className="space-y-2" onClickCapture={event => {
    if (event.target === list.current || (event.target instanceof Element && event.target.closest("[data-destination-drag]"))) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (!(event.target instanceof Element) || !event.target.closest("[data-reorder-destination]")) return;
    // Capture the current visual positions before cancelling an interrupted move.
    // This also covers keyboard-generated clicks and repeated arrow presses.
    positions.current = measure();
    cancel();
  }}>{children}</ul>;
}
