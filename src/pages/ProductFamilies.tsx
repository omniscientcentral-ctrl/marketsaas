import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useProductFamilies } from "@/hooks/useProductFamilies";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, ArrowLeft, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ProductFamiliesPage = () => {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const { selectedEmpresaId } = useEmpresaContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const { families, loading, createFamily, updateFamily, deleteFamily } = useProductFamilies(selectedEmpresaId);

  const isAdmin = activeRole?.toLowerCase() === "admin" || activeRole?.toLowerCase() === "super_admin" || activeRole?.toLowerCase() === "supervisor";

  const handleOpenDialog = () => {
    if (!isAdmin) {
      toast.error("Solo administradores y supervisores pueden crear familias");
      return;
    }
    setEditingFamily(null);
    setFormName("");
    setFormDescription("");
    setIsDialogOpen(true);
  };

  const handleEditFamily = (family: { id: string; name: string; description: string | null }) => {
    setEditingFamily(family);
    setFormName(family.name);
    setFormDescription(family.description || "");
    setIsDialogOpen(true);
  };

  const handleDeleteFamily = async () => {
    if (!familyToDelete) return;
    const success = await deleteFamily(familyToDelete.id);
    if (success) {
      toast.success(`Familia "${familyToDelete.name}" eliminada`);
    } else {
      toast.error("Error al eliminar la familia");
    }
    setDeleteDialogOpen(false);
    setFamilyToDelete(null);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    if (editingFamily) {
      const success = await updateFamily(editingFamily.id, {
        name: formName.trim(),
        description: formDescription.trim() || null,
      });
      if (success) {
        toast.success("Familia actualizada correctamente");
      } else {
        toast.error("Error al actualizar la familia");
      }
    } else {
      const newFamily = await createFamily({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      if (newFamily) {
        toast.success("Familia creada correctamente");
      } else {
        toast.error("Error al crear la familia");
      }
    }

    setIsDialogOpen(false);
    setEditingFamily(null);
    setFormName("");
    setFormDescription("");
  };

  return (
    <MainLayout>
      <div className="border-b border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/products")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a Productos
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Familias de Productos</h1>
              <p className="text-sm text-muted-foreground">
                Organiza y clasifica tus productos por familias
              </p>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Familia
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingFamily ? "Editar Familia" : "Crear Familia"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingFamily
                      ? "Modifica los datos de la familia"
                      : "Crea una nueva familia para organizar tus productos"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="family-name">Nombre *</Label>
                    <Input
                      id="family-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ej: Electrónica, Alimentos, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="family-description">Descripción</Label>
                    <Textarea
                      id="family-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Opcional: describe el propósito de esta familia"
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">
                    {editingFamily ? "Actualizar Familia" : "Crear Familia"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <Card>
            <CardContent className="py-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : families.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-30" />
              <h3 className="text-lg font-medium mb-1 text-foreground">Sin familias</h3>
              <p className="text-sm text-center max-w-md">
                No hay familias creadas aún. Las familias te ayudan a organizar y filtrar productos.
              </p>
              {isAdmin && (
                <Button className="mt-4" onClick={handleOpenDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera familia
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="grid">Cuadrícula</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
              <div className="space-y-2">
                {families.map((family) => (
                  <div
                    key={family.id}
                    className="flex items-center justify-between p-4 bg-card rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{family.name}</h3>
                      {family.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {family.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditFamily({
                              id: family.id,
                              name: family.name,
                              description: family.description
                            })}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFamilyToDelete({ id: family.id, name: family.name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        Activa
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="grid">
              <div className="grid grid-cols-1 ms:gap-3">
                {families.map((family) => (
                  <Card key={family.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{family.name}</CardTitle>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditFamily({
                                id: family.id,
                                name: family.name,
                                description: family.description
                              })}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setFamilyToDelete({ id: family.id, name: family.name });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {family.description ? (
                        <p className="text-sm text-muted-foreground truncate">{family.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sin descripción</p>
                      )}
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Activa
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen && !!familyToDelete} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar familia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la familia "{familyToDelete?.name}". Los productos que pertenecen a esta familia perderán la referencia a la misma, pero no se eliminarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setFamilyToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFamily}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default ProductFamiliesPage;
