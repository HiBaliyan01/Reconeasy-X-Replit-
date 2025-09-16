import React from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";

interface ImportConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onImportValid: () => void;
  onImportValidAndSimilar: () => void;
  validCount: number;
  similarCount: number;
  importing: boolean;
  pendingChoice: "valid" | "valid+similar" | null;
}

const ImportConfirmModal: React.FC<ImportConfirmModalProps> = ({
  open,
  onCancel,
  onImportValid,
  onImportValidAndSimilar,
  validCount,
  similarCount,
  importing,
  pendingChoice,
}) => {
  return (
    <Modal open={open} onClose={onCancel} title="Confirm import" size="sm" hideClose={importing}>
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
        <p>
          We found <strong>{validCount}</strong> valid row{validCount === 1 ? "" : "s"} ready to import.
          {similarCount > 0 && (
            <>
              {" "}There are also <strong>{similarCount}</strong> similar overlap row
              {similarCount === 1 ? "" : "s"} that require explicit approval.
            </>
          )}
        </p>

        {similarCount > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Importing similar rows will overwrite overlapping marketplace/category rate cards for the same date
              range. Review them carefully before confirming.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={onImportValid} disabled={importing || validCount === 0} className="gap-2">
            {importing && pendingChoice === "valid" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Import valid only
              </>
            )}
          </Button>
          <Button
            onClick={onImportValidAndSimilar}
            variant="secondary"
            disabled={importing || similarCount === 0}
            className="gap-2"
          >
            {importing && pendingChoice === "valid+similar" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" /> Import valid + similar
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportConfirmModal;
