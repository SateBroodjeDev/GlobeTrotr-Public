import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id?: string) => void } } }
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAEzAUfhMofYpNxJC";
export function ContactCaptcha({ token, reset }: { token: (value: string) => void; reset: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id = "", disposed = false;
    const render = () => {
      if (!disposed && ref.current && window.turnstile && !ref.current.childElementCount)
        id = window.turnstile.render(ref.current, { sitekey: SITE_KEY, theme: "auto", action: "contact", callback: token,
          "expired-callback": () => token(""), "error-callback": () => token("") });
    };
    let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true; script.defer = true; script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => { disposed = true; script?.removeEventListener("load", render); if (id) window.turnstile?.remove(id); };
  }, [token, reset]);
  return <div ref={ref} className="min-h-[65px]" />;
}
