import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: server content stays visible without JavaScript. */
export function MarketingMotion({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    let observer: IntersectionObserver | undefined;
    let introduced = false;

    const stop = () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const reveal = (element: Element, delay = 0, heading = false) => {
      if (preference.matches || !root.isConnected || seen.has(element) || element.contains(document.activeElement)) return;
      seen.add(element);
      const animation = element.animate([
        { opacity: heading ? 1 : 0.88, translate: "0 8px" },
        { opacity: 1, translate: "0 0" },
      ], { duration: 480, delay, easing: "cubic-bezier(.2,.65,.3,1)", fill: "backwards" });
      animations.add(animation);
      animation.addEventListener("finish", () => animations.delete(animation), { once: true });
    };
    const start = () => {
      stop();
      if (preference.matches || typeof Element.prototype.animate !== "function") return;
      const hero = root.querySelector(".marketing-hero");
      if (hero && !introduced && hero.getBoundingClientRect().top < window.innerHeight && hero.getBoundingClientRect().bottom > 0) {
        const heading = hero.querySelector("h1");
        if (heading) reveal(heading, 0, true);
        if (heading?.nextElementSibling) reveal(heading.nextElementSibling, 50);
        const preview = hero.querySelector(".journey-scene, .journey-studio, .group-trip-preview");
        if (preview) reveal(preview, 100);
      }
      introduced = true;
      if (!("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer?.unobserve(entry.target);
          reveal(entry.target);
        });
      }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });
      Array.from(root.children).forEach((section) => {
        if (section instanceof HTMLElement && section !== hero && section.tagName !== "SCRIPT"
          && section.getBoundingClientRect().top >= window.innerHeight) observer?.observe(section);
      });
    };
    const focus = (event: FocusEvent) => {
      animations.forEach((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target instanceof Element && event.target instanceof Node && target.contains(event.target)) {
          animation.cancel();
          animations.delete(animation);
        }
      });
    };
    start();
    preference.addEventListener("change", start);
    root.addEventListener("focusin", focus);
    return () => {
      stop();
      preference.removeEventListener("change", start);
      root.removeEventListener("focusin", focus);
    };
  }, []);

  return <div ref={ref} className={`marketing-motion ${className}`}>{children}</div>;
}
