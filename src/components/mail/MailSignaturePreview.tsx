import { corporateSignatureHtml } from "@/lib/safe-mail-html";
import { useLocale } from "@/lib/locale";

export function MailSignaturePreview({ signatureText, displayName, address }: {
  signatureText: string;
  displayName: string;
  address: string;
}) {
  const { text } = useLocale();
  if (!displayName.trim() || !address.trim()) return null;
  const signature = corporateSignatureHtml({ signatureText, displayName, address });
  return <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">{text("Voorbeeld van HTML-handtekening", "HTML signature preview")}</p>
    <iframe
      title={text("Voorbeeld van handtekening", "Signature preview")}
      sandbox=""
      referrerPolicy="no-referrer"
      className="h-72 w-full rounded-xl border bg-white"
      srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https://globetrotr.nl data:; base-uri 'none'; form-action 'none'"><div style="padding:16px">${signature}</div>`}
    />
  </div>;
}
