import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface ReceiptPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ReceiptPreviewDialog = ({ open, onClose, imageUrl }: ReceiptPreviewDialogProps) => {
  const isPdf = imageUrl.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Comprobante</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {isPdf ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                El comprobante es un archivo PDF
              </p>
              <Button asChild>
                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir PDF
                </a>
              </Button>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Comprobante"
              className="max-h-[60vh] w-auto rounded-lg"
            />
          )}

          <Button variant="outline" asChild>
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir en nueva pestaña
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptPreviewDialog;
