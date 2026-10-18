import { useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/lib/locale";

export function DeleteTripButton({ tripName, onDelete, onDeleted, iconOnly = false, disabled = false }: {
  tripName: string;
  onDelete: () => Promise<void>;
  onDeleted?: () => void;
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const { text } = useLocale();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);

  async function confirmDelete() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : text("Reis kon niet worden verwijderd.", "Trip could not be deleted."));
      return;
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
    setOpen(false);
    toast.success(text("Reis verwijderd", "Trip deleted"));
    onDeleted?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!inFlight.current) setOpen(next); }}>
      <AlertDialogTrigger asChild>
        <Button variant={iconOnly ? "ghost" : "destructive"} size={iconOnly ? "icon" : "default"}
          disabled={disabled || deleting} aria-label={text("Reis verwijderen", "Delete trip")}>
          <Trash2 className="size-4" />
          {!iconOnly && text("Verwijderen", "Delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{text("Reis definitief verwijderen?", "Permanently delete trip?")}</AlertDialogTitle>
          <AlertDialogDescription className="break-anywhere">
            {text(`Je verwijdert “${tripName}” en de bijbehorende reisgegevens. Dit kun je niet ongedaan maken. De reis verdwijnt ook voor reisgenoten.`, `You are deleting “${tripName}” and its associated trip data. This cannot be undone. The trip also disappears for fellow travellers.`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={deleting}>{text("Annuleren", "Cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={disabled || deleting} onClick={() => void confirmDelete()} aria-busy={deleting}>
            {deleting && <Loader2 className="size-4 animate-spin" />}
            {deleting ? text("Verwijderen…", "Deleting…") : text("Definitief verwijderen", "Permanently delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
