import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPushStatus,
  revokePushSubscription,
  savePushSubscription,
  sendPushTest,
} from "@/lib/push.functions";
import { useLocale } from "@/lib/locale";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushNotificationControl() {
  const { text } = useLocale();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!supported) {
        setChecking(false);
        return;
      }
      try {
        const [status, registration] = await Promise.all([
          getPushStatus(),
          navigator.serviceWorker.getRegistration("/"),
        ]);
        const subscription = await registration?.pushManager.getSubscription();
        if (!active) return;
        setConfigured(Boolean(status.publicKey));
        setEnabled(Boolean(subscription && status.endpoints.includes(subscription.endpoint)));
      } catch {
        if (active) {
          setConfigured(false);
          setEnabled(false);
        }
      } finally {
        if (active) setChecking(false);
      }
    }
    void inspect();
    return () => {
      active = false;
    };
  }, [supported]);

  async function toggle() {
    if (!supported) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current && enabled) {
        await revokePushSubscription({ data: { endpoint: current.endpoint } });
        await current.unsubscribe();
        setEnabled(false);
        toast.success(
          text(
            "Pushmeldingen zijn op dit apparaat uitgezet.",
            "Push notifications are disabled on this device.",
          ),
        );
        return;
      }
      const status = await getPushStatus();
      if (!status.publicKey) throw new Error("PUSH_NOT_CONFIGURED");
      setConfigured(true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("PUSH_PERMISSION_DENIED");
      const subscription =
        current ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(status.publicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
        throw new Error("PUSH_SUBSCRIPTION_INVALID");
      await savePushSubscription({
        data: {
          endpoint: json.endpoint,
          expirationTime: json.expirationTime ?? null,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent,
        },
      });
      setEnabled(true);
      toast.success(
        text(
          "Pushmeldingen zijn op dit apparaat aangezet.",
          "Push notifications are enabled on this device.",
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("PERMISSION")
          ? text(
              "Je browser heeft pushmeldingen geweigerd. Pas de toestemming aan in de browserinstellingen.",
              "Your browser denied push notifications. Change the permission in browser settings.",
            )
          : message.includes("NOT_CONFIGURED")
            ? text(
                "Pushmeldingen zijn nog niet op de server geconfigureerd.",
                "Push notifications have not been configured on the server yet.",
              )
            : text(
                "Pushmeldingen konden niet worden gewijzigd.",
                "Push notifications could not be changed.",
              ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    try {
      await sendPushTest();
      toast.success(
        text(
          "Testmelding staat klaar voor bezorging.",
          "The test notification is queued for delivery.",
        ),
      );
    } catch {
      toast.error(
        text(
          "De testmelding kon niet worden klaargezet. Controleer de workerstatus.",
          "The test notification could not be queued. Check the worker status.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;
  return (
    <div className="space-y-2 border-b p-3">
      <Button
        className="w-full justify-start"
        size="sm"
        variant="outline"
        disabled={busy || checking}
        onClick={toggle}
      >
        {busy || checking ? (
          <Loader2 className="size-4 animate-spin" />
        ) : enabled ? (
          <BellOff className="size-4" />
        ) : (
          <BellRing className="size-4" />
        )}
        {enabled
          ? text("Push op dit apparaat uitzetten", "Disable push on this device")
          : text("Push op dit apparaat aanzetten", "Enable push on this device")}
      </Button>
      {enabled && (
        <Button
          className="w-full justify-start"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void testPush()}
        >
          <Send className="size-4" />
          {text("Testmelding versturen", "Send test notification")}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {!checking && !configured
          ? text(
              "De serverconfiguratie ontbreekt nog. Volg de uitrolstappen voor Node-01 en Node-02.",
              "The server configuration is still missing. Follow the deployment steps for Node-01 and Node-02.",
            )
          : text(
              "De push bevat alleen een algemene melding; details staan na inloggen in GlobeTrotr.",
              "The push only contains a general notice; details remain behind your GlobeTrotr sign-in.",
            )}
      </p>
    </div>
  );
}
