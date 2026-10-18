import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

export type TranslationDirection = "nl-en" | "en-nl";

export function TranslationDraftButtons({ translating, canTranslateNl, canTranslateEn, onTranslate }: {
  translating: boolean;
  canTranslateNl: boolean;
  canTranslateEn: boolean;
  onTranslate: (direction: TranslationDirection) => void;
}) {
  const { text } = useLocale();
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={translating || !canTranslateNl} onClick={() => onTranslate("nl-en")}>
        {translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
        {text("NL → EN concept", "NL → EN draft")}
      </Button>
      <Button type="button" variant="outline" disabled={translating || !canTranslateEn} onClick={() => onTranslate("en-nl")}>
        {translating ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
        {text("EN → NL concept", "EN → NL draft")}
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">{text(
      "Het doelveld wordt vervangen door een concept. Controleer namen, bedragen en betekenis voordat je opslaat of publiceert.",
      "The target field is replaced with a draft. Check names, amounts and meaning before saving or publishing.",
    )}</p>
  </div>;
}
