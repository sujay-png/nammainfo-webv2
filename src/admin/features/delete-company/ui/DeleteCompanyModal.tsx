import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "@/admin/shared/ui/Modal";
import { Button } from "@/admin/shared/ui/Button";
import { deleteCompany } from "@/admin/entities/company/api/company-api";
import type { Company } from "@/admin/entities/company/model/types";

interface DeleteCompanyModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteCompanyModal: React.FC<DeleteCompanyModalProps> = ({
  company,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  if (!company) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteCompany(company.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex items-center justify-center text-rose-600 dark:text-rose-400">
          <AlertTriangle size={24} />
        </div>

        <div>
          <h3 className="font-headline text-lg font-bold text-[var(--foreground)]">
            Delete Company Account?
          </h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {company.businessName}
            </span>
            ? This will permanently remove all associated employees, digital cards, and profile data.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            leftIcon={<Trash2 size={14} />}
            isLoading={loading}
            onClick={handleDelete}
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
