import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const companySettingsSchema = z.object({
  company_name: z.string().min(1, "El nombre de la empresa es requerido"),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  tax_id: z.string().optional(),
  currency: z.string().min(1, "El símbolo de moneda es requerido"),
  receipt_footer: z.string().optional(),
  stock_disabled: z.boolean().default(false),
  logo_url: z.string().optional(),
  cash_closure_approval_threshold: z.coerce.number().min(0, "Debe ser mayor o igual a 0").default(50),
});

type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export default function CompanySettingsForm() {
  const [loading, setLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const empresaId = useEmpresaId();

  const form = useForm<CompanySettingsFormData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      tax_id: "",
      currency: "$",
      receipt_footer: "",
      stock_disabled: false,
      logo_url: "",
      cash_closure_approval_threshold: 50,
    },
  });

  useEffect(() => {
    if (empresaId) loadCompanySettings();
  }, [empresaId]);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("empresa_id", empresaId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        form.reset({
          company_name: data.company_name || "",
          address: data.address || "",
          city: (data as any).city || "",
          phone: data.phone || "",
          email: data.email || "",
          tax_id: data.tax_id || "",
          currency: data.currency || "$",
          receipt_footer: data.receipt_footer || "",
          stock_disabled: data.stock_disabled || false,
          logo_url: data.logo_url || "",
          cash_closure_approval_threshold: (data as any).cash_closure_approval_threshold ?? 50,
        });
        if (data.logo_url) {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error: any) {
      console.error("Error loading company settings:", error);
      toast.error("Error al cargar la configuración");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato no soportado. Use PNG, JPG, WEBP, GIF o SVG");
      return;
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo es muy grande. Máximo 2MB");
      return;
    }

    setLogoFile(file);
    
    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    // Si hay un logo guardado, eliminarlo del storage
    const currentLogoUrl = form.getValues("logo_url");
    if (currentLogoUrl) {
      try {
        // Extraer el nombre del archivo de la URL
        const urlParts = currentLogoUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        
        await supabase.storage
          .from("company-assets")
          .remove([fileName]);
      } catch (error) {
        console.error("Error removing logo from storage:", error);
      }
    }

    setLogoFile(null);
    setLogoPreview(null);
    form.setValue("logo_url", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLogoUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("company-assets")
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("company-assets")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const onSubmit = async (data: CompanySettingsFormData) => {
    setLoading(true);

    try {
      let logoUrl = data.logo_url;

      // Si hay un nuevo archivo, subirlo
      if (logoFile) {
        setUploadingLogo(true);
        
        // Si había un logo anterior, eliminarlo
        if (data.logo_url) {
          try {
            const urlParts = data.logo_url.split("/");
            const oldFileName = urlParts[urlParts.length - 1];
            await supabase.storage
              .from("company-assets")
              .remove([oldFileName]);
          } catch (e) {
            console.error("Error removing old logo:", e);
          }
        }
        
        logoUrl = await handleLogoUpload(logoFile);
        setUploadingLogo(false);
        setLogoFile(null);
      }

      const updateData = { ...data, logo_url: logoUrl || null, empresa_id: empresaId };

      if (settingsId) {
        const { error } = await supabase
          .from("company_settings")
          .update(updateData)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data: newSettings, error } = await supabase
          .from("company_settings")
          .insert([updateData])
          .select()
          .single();

        if (error) throw error;
        if (newSettings) setSettingsId(newSettings.id);
      }

      toast.success("Configuración guardada exitosamente");
    } catch (error: any) {
      console.error("Error saving company settings:", error);
      toast.error("Error al guardar la configuración");
    } finally {
      setLoading(false);
      setUploadingLogo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <CardTitle>Configuración de la Empresa</CardTitle>
        </div>
        <CardDescription>
          Estos datos aparecerán en los tickets de venta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Logo de la Empresa */}
            <FormItem>
              <FormLabel>Logo de la Empresa</FormLabel>
              <div className="flex items-center gap-4">
                {/* Preview del logo */}
                <div className="h-24 w-24 border rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo de la empresa"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {logoPreview ? "Cambiar" : "Subir"}
                    </Button>
                    
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={uploadingLogo}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
              <FormDescription>
                Formatos: PNG, JPG, WEBP, GIF, SVG. Máximo 2MB.
              </FormDescription>
            </FormItem>

            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Empresa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Mi Tienda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tax_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT / Número de identificación</FormLabel>
                  <FormControl>
                    <Input placeholder="12.345.678-9" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Calle Principal, Local 123" 
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciudad</FormLabel>
                  <FormControl>
                    <Input placeholder="Santiago" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="0414-1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@tienda.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Símbolo de Moneda *</FormLabel>
                  <FormControl>
                    <Input placeholder="$" maxLength={3} {...field} />
                  </FormControl>
                  <FormDescription>
                    Símbolo que aparecerá en los precios (ej: $, Bs., €)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receipt_footer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensaje Final del Ticket</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Gracias por su compra. ¡Vuelva pronto!"
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stock_disabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Control de Stock Desactivado</FormLabel>
                    <FormDescription>
                      Si está activado, permite vender sin validar stock disponible
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cash_closure_approval_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Umbral de Aprobación para Cierre de Caja</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      step={1}
                      placeholder="50" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Diferencias mayores a este monto requerirán aprobación de supervisor
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading || uploadingLogo} className="w-full">
              {(loading || uploadingLogo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadingLogo ? "Subiendo logo..." : "Guardar Configuración"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
