import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductFamilies } from "@/hooks/useProductFamilies";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useEffect } from "react";

interface FamilyFilterProps {
  selectedFamilyId: string | null;
  onFamilyChange: (familyId: string | null) => void;
}

export const FamilyFilter = ({ selectedFamilyId, onFamilyChange }: FamilyFilterProps) => {
  const { selectedEmpresaId } = useEmpresaContext();
  const { families, loading } = useProductFamilies(selectedEmpresaId);

  return (
    <Select
      value={selectedFamilyId || "all"}
      onValueChange={(value) => onFamilyChange(value === "all" ? null : value)}
      disabled={loading}
    >
      <SelectTrigger className="w-[150px] h-9">
        <SelectValue placeholder="Todas las familias" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las familias</SelectItem>
        {families.map((family) => (
          <SelectItem key={family.id} value={family.id}>
            {family.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
