import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  location: z.string().max(200, "Máximo 200 caracteres").optional(),
});

interface CashRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register?: any | null;
  onSuccess: () => void;
}

export const CashRegisterDialog = ({ open, onOpenChange, register, onSuccess }: CashRegisterDialogProps) => {
  const { user } = useAuth();
  const empresaId = useEmpresaId();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  useEffect(() => {
    if (register) {
      form.reset({
        name: register.name,
        location: register.location || "",
      });
    } else {
      form.reset({
        name: "",
        location: "",
      });
    }
  }, [register, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (register) {
        // Actualizar
        const { error } = await supabase
          .from('cash_registers')
          .update({
            name: values.name.trim(),
            location: values.location?.trim() || null,
          })
          .eq('id', register.id);

        if (error) throw error;

        // Auditoría
        await supabase.from('cash_register_audit').insert({
          cash_register_id: register.id,
          action: 'update',
          performed_by: user?.id,
          details: { name: values.name, location: values.location }
        });

        toast.success("Caja actualizada correctamente");
      } else {
        // Crear
        const { data, error } = await supabase
          .from('cash_registers')
          .insert({
            name: values.name.trim(),
            location: values.location?.trim() || null,
            is_active: true,
            empresa_id: empresaId,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast.error("Ya existe una caja con ese nombre");
            return;
          }
          throw error;
        }

        // Auditoría
        await supabase.from('cash_register_audit').insert({
          cash_register_id: data.id,
          action: 'create',
          performed_by: user?.id,
          details: { name: values.name, location: values.location }
        });

        toast.success("Caja creada correctamente");
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error("Error al guardar la caja");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{register ? "Editar Caja" : "Nueva Caja"}</DialogTitle>
          <DialogDescription>
            {register ? "Modificá los datos de la caja" : "Creá un nuevo punto de cobro"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Caja 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Planta baja, sector A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {register ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
