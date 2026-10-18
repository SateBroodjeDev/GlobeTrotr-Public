import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadPaddle } from "@/lib/paddle-client";

export const Route = createFileRoute("/paddle-checkout")({
  head: () => ({ meta: [{ title: "Beveiligd afrekenen — GlobeTrotr" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PaddleCheckoutBridge,
});

function PaddleCheckoutBridge() {
  const [status, setStatus] = useState<"opening" | "closed" | "failed">("opening");
  useEffect(() => {
    if (window.location.hostname !== "globetrotr.nl") {
      window.location.replace(`https://globetrotr.nl/paddle-checkout${window.location.hash}`);
      return;
    }
    void (async () => {
      try {
        const values = new URLSearchParams(window.location.hash.slice(1));
        const plan = values.get("plan");
        const mode = values.get("mode");
        const binding = values.get("binding");
        const locale = values.get("locale") === "nl" ? "nl" : "en";
        const priceId = values.get("price") ?? "";
        const token = values.get("clientToken") ?? "";
        const environment = values.get("environment") === "sandbox" ? "sandbox" : "production";
        const prefill = values.get("billing") ? JSON.parse(values.get("billing")!) : null;
        const customer = prefill && /^ctm_[a-z0-9]+$/i.test(String(prefill.customer?.id))
          && /^biz_[a-z0-9]+$/i.test(String(prefill.business?.id)) && /^add_[a-z0-9]+$/i.test(String(prefill.address?.id))
          ? { customer: { id: prefill.customer.id }, business: { id: prefill.business.id }, address: { id: prefill.address.id } } : {};
        window.history.replaceState(null, "", window.location.pathname);
        if (!binding || binding.length > 4096 || !["pro", "agency"].includes(plan ?? "") || !["recurring", "oneTime"].includes(mode ?? "") || !/^pri_[A-Za-z0-9_]+$/.test(priceId) || token.length < 8 || token.length > 500) throw new Error("INVALID_CHECKOUT");
        const paddle = await loadPaddle(token, environment, (event) => {
          if (event.name === "checkout.closed") setStatus("closed");
        });
        paddle.Checkout.open({ ...customer, items: [{ priceId, quantity: 1 }], customData: { checkout_binding: binding }, settings: { displayMode: "overlay", theme: "light", locale, showAddTaxId: true, successUrl: "https://portal.globetrotr.nl/billing?checkout=success" } });
      } catch { setStatus("failed"); }
    })();
  }, []);
  return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-md text-center">
    {status === "failed" ? <><h1 className="font-display text-xl font-semibold">Checkout kon niet worden geopend</h1><p className="mt-2 text-sm text-muted-foreground">Ga terug naar je abonnement en probeer het opnieuw.</p></> : status === "closed" ? <><h1 className="font-display text-xl font-semibold">Checkout gesloten</h1><p className="mt-2 text-sm text-muted-foreground">Er is niets gewijzigd. Je kunt teruggaan naar je abonnement of de checkout opnieuw openen.</p></> : <><Loader2 className="mx-auto size-7 animate-spin text-primary"/><p className="mt-3 text-sm text-muted-foreground">Beveiligde checkout openen…</p></>}
    {status !== "opening" && <a href="https://portal.globetrotr.nl/billing" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Terug naar abonnement</a>}
  </div></main>;
}
