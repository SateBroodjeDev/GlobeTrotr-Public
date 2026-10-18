import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PACKING_TEMPLATES, type PackingItem } from "@/lib/types";
import { uid } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/lib/locale";

export function Packing({
  items,
  editable,
  onChange,
}: {
  items: PackingItem[];
  editable: boolean;
  onChange: (next: PackingItem[]) => Promise<void>;
}) {
  const { text } = useLocale();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? (done / items.length) * 100 : 0;

  async function commit(next: PackingItem[], successMessage?: string) {
    setSaving(true);
    try {
      await onChange(next);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : text("Paklijst kon niet worden opgeslagen.", "Packing list could not be saved."),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function load(templateId: string) {
    const tpl = PACKING_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const existing = new Set(items.map((i) => i.label.toLowerCase()));
    const added = tpl.items
      .filter((l) => !existing.has(l.toLowerCase()))
      .map((l) => ({ id: uid(), label: l, done: false }));
    await commit(
      [...items, ...added],
      text(
        `${added.length} punten toegevoegd uit ${tpl.label}`,
        `${added.length} items added from ${tpl.label}`,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {text("Paklijst-sjablonen (1 klik)", "Packing list templates (one click)")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PACKING_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="sm"
              disabled={!editable || saving}
              onClick={() => void load(t.id)}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Checklist — {done}/{items.length} {text("afgevinkt", "checked")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={label}
              disabled={!editable || saving}
              placeholder={text("Eigen punt toevoegen", "Add your own item")}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && label.trim()) {
                  const nextLabel = label.trim();
                  void commit([...items, { id: uid(), label: nextLabel, done: false }]).then(
                    (saved) => saved && setLabel(""),
                  );
                }
              }}
            />
            <Button
              disabled={!editable || saving || !label.trim()}
              onClick={() => {
                const nextLabel = label.trim();
                void commit([...items, { id: uid(), label: nextLabel, done: false }]).then(
                  (saved) => saved && setLabel(""),
                );
              }}
            >
              <Plus className="size-4" /> {text("Toevoegen", "Add")}
            </Button>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {items.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={i.done}
                    disabled={!editable || saving}
                    onChange={(e) =>
                      void commit(
                        items.map((x) => (x.id === i.id ? { ...x, done: e.target.checked } : x)),
                      )
                    }
                  />
                  <span className={i.done ? "text-muted-foreground line-through" : ""}>
                    {i.label}
                  </span>
                </label>
                {editable && (
                  <button
                    disabled={saving}
                    aria-label={text("Verwijder punt", "Delete item")}
                    onClick={() => void commit(items.filter((x) => x.id !== i.id))}
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!items.length && (
            <p className="text-sm text-muted-foreground">
              {text(
                "Nog niets ingepakt — laad hierboven een sjabloon.",
                "Nothing packed yet — load a template above.",
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
