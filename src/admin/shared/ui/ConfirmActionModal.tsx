import React from "react";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  isLoading = false,
}) => {
  const iconMap = {
    danger: <AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />,
    warning: <AlertCircle className="text-amber-600 dark:text-amber-400" size={24} />,
    primary: <CheckCircle2 className="text-blue-600 dark:text-blue-400" size={24} />,
  };

  const bgMap = {
    danger: "bg-rose-500/10",
    warning: "bg-amber-500/10",
    primary: "bg-blue-500/10",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex items-center justify-center text-[var(--foreground)]">
          {iconMap[variant]}
        </div>

        <div>
          <h3 className="font-headline text-base font-bold text-[var(--foreground)]">
            {title}
          </h3>
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)] leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex gap-2.5 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1"
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
