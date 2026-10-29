import { useEffect, useRef } from "react";
import { Button } from "@/shared/ui";

interface DeleteConfirmationProps {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function DeleteConfirmation({ open, onCancel, onConfirm }: DeleteConfirmationProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [open]);
  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="delete-heading"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id="delete-heading" className="text-lg font-semibold">
        Удалить встречу?
      </h2>
      <p className="my-4 text-sm text-muted-foreground">
        После подтверждения время освободится для других встреч.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Удалить встречу
        </Button>
      </div>
    </dialog>
  );
}
