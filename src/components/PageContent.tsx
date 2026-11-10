import { useEffect, useRef, type ReactNode } from "react";

/** Brief portal navigation feedback; children and their form state stay mounted. */
export function PageContent({ children, className, routeKey, animate = false }: {
  children: ReactNode;
  className: string;
  routeKey: string;
  animate?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!animate || !element || typeof element.animate !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || element.contains(document.activeElement)) return;
    const animation = element.animate([
      { opacity: 0.94, translate: "0 4px" },
      { opacity: 1, translate: "0 0" },
    ], { duration: 220, easing: "cubic-bezier(.2,.65,.3,1)" });
    const cancel = () => animation.cancel();
    preference.addEventListener("change", cancel);
    element.addEventListener("focusin", cancel, { once: true });
    return () => {
      cancel();
      preference.removeEventListener("change", cancel);
      element.removeEventListener("focusin", cancel);
    };
  }, [routeKey, animate]);
  return <main ref={ref} className={className}>{children}</main>;
}
