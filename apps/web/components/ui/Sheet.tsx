"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { IconButton } from "./Button";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * Bottom sheet on small screens, centred dialog on wide ones. Built on the native
 * `<dialog>` element so focus trapping, Escape and inert backgrounds come from the platform.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className="pp-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <div className="pp-sheet__grip" aria-hidden="true" />
      <div className="pp-sheet__hd">
        <h2 id={titleId}>{title}</h2>
        <span className="pp-card__end">
          <IconButton
            label="Close"
            icon={<X className="pp-i-lg" />}
            onClick={onClose}
          />
        </span>
      </div>
      <div className="pp-sheet__body">{children}</div>
    </dialog>
  );
}
