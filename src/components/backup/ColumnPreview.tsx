import { Check, X, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ColumnDef {
  name: string;
  required: boolean;
  type: string;
}

interface ColumnPreviewProps {
  expectedColumns: ColumnDef[];
  detectedColumns: string[];
}

export function ColumnPreview({ expectedColumns, detectedColumns }: ColumnPreviewProps) {
  const unknownColumns = detectedColumns.filter(
    (col) =>
      !expectedColumns.some((e) => e.name === col) &&
      !["id", "empresa_id", "created_at", "updated_at"].includes(col)
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Mapeo de columnas</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Columna esperada</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Requerida</TableHead>
            <TableHead>Detectada</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expectedColumns.map((col) => {
            const found = detectedColumns.includes(col.name);
            return (
              <TableRow key={col.name}>
                <TableCell className="font-mono text-xs">{col.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {col.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  {col.required ? (
                    <Badge variant="destructive" className="text-xs">Sí</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell>
                  {found ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : col.required ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {unknownColumns.map((col) => (
            <TableRow key={col}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {col}
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs">Ignorada</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
