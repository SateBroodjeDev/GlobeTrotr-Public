/** Handle-only pointer dragging. No writes until drop; scrolling the row stays native. */
export function destinationDrag(list: HTMLUListElement, options: {
  enabled: () => boolean;
  beforeDrag: () => void;
  beforeDrop: () => void;
  drop: (source: string, target: string) => void;
}) {
  let active: {
    pointer: number; source: string; target: string; row: HTMLElement;
    startY: number; y: number; windowY: number; scrollTop: number;
    scroller: HTMLElement | null; moved: boolean;
    rows: { id: string; center: number }[];
  } | undefined;
  let frame = 0;
  const rows = () => Array.from(list.children) as HTMLElement[];
  const clear = () => {
    const previous = active;
    active = undefined;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const row of rows()) {
      delete row.dataset.dropTarget;
      delete row.dataset.dragging;
    }
    if (previous) {
      previous.row.style.removeProperty("transform");
      previous.row.style.removeProperty("will-change");
      if (list.hasPointerCapture(previous.pointer)) list.releasePointerCapture(previous.pointer);
    }
  };
  const update = () => {
    if (!active || !active.row.isConnected) { clear(); return; }
    const scrollDelta = window.scrollY - active.windowY
      + (active.scroller ? active.scroller.scrollTop - active.scrollTop : 0);
    const delta = active.y - active.startY + scrollDelta;
    active.row.style.transform = `translateY(${delta}px)`;
    active.row.dataset.dragging = "true";
    const origin = active.rows.find(row => row.id === active!.source)!;
    const center = origin.center + delta;
    const target = active.rows.reduce((best, row) =>
      Math.abs(row.center - center) < Math.abs(best.center - center) ? row : best);
    active.target = target.id;
    for (const row of rows()) {
      if (row.dataset.destinationId === target.id && target.id !== active.source) row.dataset.dropTarget = "true";
      else delete row.dataset.dropTarget;
    }
  };
  const scroll = () => {
    if (!active?.moved) return;
    const rect = active.scroller?.getBoundingClientRect();
    const top = Math.max(0, rect?.top ?? 0), bottom = Math.min(window.innerHeight, rect?.bottom ?? window.innerHeight);
    const speed = active.y < top + 48 ? -Math.min(12, (top + 48 - active.y) / 4)
      : active.y > bottom - 48 ? Math.min(12, (active.y - bottom + 48) / 4) : 0;
    if (speed) {
      if (active.scroller) active.scroller.scrollTop += speed;
      else window.scrollBy(0, speed);
      update();
    }
    if (active) frame = requestAnimationFrame(scroll);
  };
  const down = (event: PointerEvent) => {
    if (active || !options.enabled() || !event.isPrimary || event.button !== 0
      || !(event.target instanceof Element)) return;
    const handle = event.target.closest<HTMLButtonElement>("[data-destination-drag]");
    const row = handle?.closest<HTMLElement>("[data-destination-id]");
    if (!handle || handle.disabled || !row || !list.contains(row)) return;
    options.beforeDrag();
    let scroller = list.parentElement;
    while (scroller && (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
      || scroller.scrollHeight <= scroller.clientHeight)) scroller = scroller.parentElement;
    if (scroller === document.body || scroller === document.documentElement) scroller = null;
    active = {
      pointer: event.pointerId, source: row.dataset.destinationId!, target: row.dataset.destinationId!, row,
      startY: event.clientY, y: event.clientY, windowY: window.scrollY,
      scrollTop: scroller?.scrollTop ?? 0, scroller, moved: false,
      rows: rows().map(item => { const rect = item.getBoundingClientRect();
        return { id: item.dataset.destinationId!, center: rect.top + rect.height / 2 }; }),
    };
    try { list.setPointerCapture(event.pointerId); } catch { clear(); }
  };
  const move = (event: PointerEvent) => {
    if (!active || active.pointer !== event.pointerId) return;
    active.y = event.clientY;
    if (!active.moved && Math.abs(active.y - active.startY) < 6) return;
    if (!active.moved) { active.moved = true; active.row.style.willChange = "transform"; frame = requestAnimationFrame(scroll); }
    event.preventDefault();
    update();
  };
  const up = (event: PointerEvent) => {
    if (!active || active.pointer !== event.pointerId) return;
    const { source, target, moved } = active;
    if (moved && source !== target && options.enabled()) {
      options.beforeDrop();
      clear();
      options.drop(source, target);
    } else clear();
  };
  const cancelPointer = (event: PointerEvent) => { if (active?.pointer === event.pointerId) clear(); };
  const key = (event: KeyboardEvent) => { if (active && event.key === "Escape") { event.preventDefault(); clear(); } };
  list.addEventListener("pointerdown", down);
  list.addEventListener("pointermove", move, { passive: false });
  list.addEventListener("pointerup", up);
  list.addEventListener("pointercancel", cancelPointer);
  list.addEventListener("lostpointercapture", cancelPointer);
  document.addEventListener("keydown", key);
  window.addEventListener("blur", clear);
  window.addEventListener("resize", clear);
  return { cancel: clear, destroy: () => {
    clear();
    list.removeEventListener("pointerdown", down);
    list.removeEventListener("pointermove", move);
    list.removeEventListener("pointerup", up);
    list.removeEventListener("pointercancel", cancelPointer);
    list.removeEventListener("lostpointercapture", cancelPointer);
    document.removeEventListener("keydown", key);
    window.removeEventListener("blur", clear);
    window.removeEventListener("resize", clear);
  } };
}
