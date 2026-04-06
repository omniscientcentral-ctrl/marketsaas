import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { silentPrintPDF } from "./silentPrint";

interface SaleData {
  sale_number: number;
  created_at: string;
  total: number;
  payment_method: string;
  cash_amount?: number;
  card_amount?: number;
  credit_amount?: number;
  transfer_amount?: number;
  customer_name?: string;
  cashier?: { full_name: string };
  customer?: {
    name: string;
    last_name?: string;
    document?: string;
    rut?: string;
    phone?: string;
    address?: string;
    current_balance?: number;
  };
  notes?: string;
  cash_register?: {
    name: string;
    location?: string;
  };
  session_id?: string;
  replaces_sale_number?: number;
}

// Normaliza created_at asegurando un ISO string válido
const normalizeSaleDate = (date: any): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn("Fecha inválida en SaleData, usando fecha actual", date);
    return new Date().toISOString();
  }
  return d.toISOString();
};

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CompanySettings {
  company_name: string;
  tax_id?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  currency?: string;
  receipt_footer?: string;
  logo_url?: string;
}

// Función para cargar imagen como base64 con detección de formato
const loadImageAsBase64 = async (url: string): Promise<{ data: string; format: "PNG" | "JPEG" } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("Failed to fetch logo:", response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    
    // Detectar formato desde el MIME type
    let format: "PNG" | "JPEG" = "JPEG";
    if (blob.type === "image/png") {
      format = "PNG";
    } else if (blob.type === "image/jpeg" || blob.type === "image/jpg") {
      format = "JPEG";
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result) {
          resolve({ data: result, format });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => {
        console.error("FileReader error loading logo");
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching logo:", error);
    return null;
  }
};

// Obtener etiqueta del método de pago
const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    credit: "Crédito",
    mixed: "Mixto",
    transfer: "Transferencia",
  };
  return labels[method] || "Otro";
};

// Obtener tipo de venta
const getSaleTypeLabel = (method: string): string => {
  return method === "credit" ? "CRÉDITO / FIADO" : "CONTADO";
};

export const generateSaleA4PDF = async (
  sale: SaleData,
  items: SaleItem[],
  company?: CompanySettings,
  copyLabel?: string,  // "COPIA EMPRESA" | "COPIA CLIENTE"
  showDebt: boolean = true
) => {
  // Normalizar fecha
  sale.created_at = normalizeSaleDate(sale.created_at);

  const pdf = new jsPDF();
  const currency = company?.currency || "$";
  let yPos = 15;
  const leftMargin = 20;
  const rightMargin = 190;
  const centerX = 105;

  // Etiqueta de copia en la esquina superior derecha
  if (copyLabel) {
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(100, 100, 100);
    pdf.text(copyLabel, rightMargin, 10, { align: "right" });
    pdf.setTextColor(0, 0, 0);
  }

  // ========== ENCABEZADO CON LOGO ==========
  let logoLoaded = false;
  if (company?.logo_url) {
    const logoResult = await loadImageAsBase64(company.logo_url);
    if (logoResult) {
      try {
        pdf.addImage(logoResult.data, logoResult.format, leftMargin, yPos, 30, 30);
        logoLoaded = true;
      } catch (e) {
        console.error("Error adding logo to PDF:", e);
      }
    }
  }

  // Nombre de empresa (centrado o a la derecha del logo)
  const textStartX = logoLoaded ? 55 : centerX;
  const textAlign = logoLoaded ? undefined : "center";
  
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  if (textAlign === "center") {
    pdf.text(company?.company_name || "Mi Empresa", textStartX, yPos + 8, { align: "center" });
  } else {
    pdf.text(company?.company_name || "Mi Empresa", textStartX, yPos + 8);
  }

  // Tipo de comprobante
  pdf.setFontSize(16);
  if (textAlign === "center") {
    pdf.text("FACTURA / COMPROBANTE DE VENTA", textStartX, yPos + 17, { align: "center" });
  } else {
    pdf.text("FACTURA / COMPROBANTE DE VENTA", textStartX, yPos + 17);
  }

  // Número y fecha
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  const saleInfo = `N° ${sale.sale_number} | ${format(new Date(sale.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}`;
  if (textAlign === "center") {
    pdf.text(saleInfo, textStartX, yPos + 25, { align: "center" });
  } else {
    pdf.text(saleInfo, textStartX, yPos + 25);
  }

  yPos = logoLoaded ? yPos + 37 : yPos + 32;

  // Etiqueta de reemplazo
  if (sale.replaces_sale_number) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(200, 0, 0);
    pdf.text(`REEMPLAZA VENTA #${sale.replaces_sale_number} (ANULADA)`, centerX, yPos, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    yPos += 8;
  }

  // Línea separadora
  pdf.setLineWidth(0.5);
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 9;

  // ========== DATOS DEL EMISOR Y OPERACIÓN (DOS COLUMNAS) ==========
  const col1X = leftMargin;
  const col2X = 115;
  let col1Y = yPos;
  let col2Y = yPos;

  // Columna 1: Datos del Emisor
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DEL EMISOR", col1X, col1Y);
  col1Y += 6;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(company?.company_name || "Mi Empresa", col1X, col1Y);
  col1Y += 5;
  
  if (company?.tax_id) {
    pdf.text(`RUT: ${company.tax_id}`, col1X, col1Y);
    col1Y += 5;
  }
  if (company?.address) {
    pdf.text(company.address, col1X, col1Y);
    col1Y += 5;
  }
  if (company?.city) {
    pdf.text(company.city, col1X, col1Y);
    col1Y += 5;
  }
  if (company?.phone) {
    pdf.text(`Tel: ${company.phone}`, col1X, col1Y);
    col1Y += 5;
  }
  if (company?.email) {
    pdf.text(`Email: ${company.email}`, col1X, col1Y);
    col1Y += 5;
  }

  // Columna 2: Datos de la Operación
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DE LA OPERACIÓN", col2X, col2Y);
  col2Y += 6;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Fecha: ${format(new Date(sale.created_at), "dd/MM/yyyy", { locale: es })}`, col2X, col2Y);
  col2Y += 5;
  pdf.text(`Hora: ${format(new Date(sale.created_at), "HH:mm:ss", { locale: es })}`, col2X, col2Y);
  col2Y += 5;
  pdf.text(`N° Venta: ${sale.sale_number}`, col2X, col2Y);
  col2Y += 5;
  pdf.text(`Tipo: ${getSaleTypeLabel(sale.payment_method)}`, col2X, col2Y);
  col2Y += 5;
  
  if (sale.cash_register?.name) {
    pdf.text(`Caja: ${sale.cash_register.name}`, col2X, col2Y);
    col2Y += 5;
  }
  
  pdf.text(`Cajero: ${sale.cashier?.full_name || "N/A"}`, col2X, col2Y);
  col2Y += 5;
  
  if (sale.session_id) {
    pdf.text(`Sesión: ${sale.session_id.substring(0, 8)}...`, col2X, col2Y);
    col2Y += 5;
  }
  
  if (sale.cash_register?.location) {
    pdf.text(`Sucursal: ${sale.cash_register.location}`, col2X, col2Y);
    col2Y += 5;
  }

  yPos = Math.max(col1Y, col2Y) + 5;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 9;

  // ========== DATOS DEL CLIENTE ==========
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("CLIENTE", leftMargin, yPos);
  yPos += 6;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  if (sale.customer) {
    const customerFullName = `${sale.customer.name} ${sale.customer.last_name || ""}`.trim();
    pdf.text(`Nombre: ${customerFullName}`, leftMargin, yPos);
    yPos += 5;
    if (sale.customer.rut) {
      pdf.text(`RUT: ${sale.customer.rut}`, leftMargin, yPos);
      yPos += 5;
    }
    if (sale.customer.phone) {
      pdf.text(`Teléfono: ${sale.customer.phone}`, leftMargin, yPos);
      yPos += 5;
    }
    if (sale.customer.address) {
      pdf.text(`Dirección: ${sale.customer.address}`, leftMargin, yPos);
      yPos += 5;
    }
    // Deuda posterior para ventas a crédito
    if (showDebt && sale.payment_method === "credit" && sale.customer.current_balance !== undefined) {
      pdf.setFont("helvetica", "bold");
      pdf.text(`Deuda posterior: ${currency}${sale.customer.current_balance.toFixed(2)}`, leftMargin, yPos);
      pdf.setFont("helvetica", "normal");
      yPos += 5;
    }
  } else {
    pdf.text("CONSUMIDOR FINAL", leftMargin, yPos);
    yPos += 5;
  }

  yPos += 3;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 9;

  // ========== TABLA DE PRODUCTOS ==========
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("N°", leftMargin, yPos);
  pdf.text("Producto", leftMargin + 10, yPos);
  pdf.text("Cant.", 115, yPos, { align: "right" });
  pdf.text("P.Unit.", 145, yPos, { align: "right" });
  pdf.text("Subtotal", rightMargin, yPos, { align: "right" });
  yPos += 3;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  let subtotalGeneral = 0;
  
  items.forEach((item, index) => {
    if (yPos > 265) {
      pdf.addPage();
      yPos = 20;
    }

    const productName = item.product_name.length > 40 
      ? item.product_name.substring(0, 37) + "..." 
      : item.product_name;

    pdf.text(`${index + 1}`, leftMargin, yPos);
    pdf.text(productName, leftMargin + 10, yPos);
    pdf.text(item.quantity.toString(), 115, yPos, { align: "right" });
    pdf.text(`${currency}${item.unit_price.toFixed(2)}`, 145, yPos, { align: "right" });
    pdf.text(`${currency}${item.subtotal.toFixed(2)}`, rightMargin, yPos, { align: "right" });
    
    subtotalGeneral += item.subtotal;
    yPos += 6;
  });

  yPos += 3;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 9;

  // ========== TOTALES ==========
  const totalsX = 130;
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("Subtotal:", totalsX, yPos);
  pdf.text(`${currency}${subtotalGeneral.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 7;

  // Línea para TOTAL
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("TOTAL:", totalsX, yPos);
  pdf.text(`${currency}${sale.total.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 11;

  // ========== DETALLE DE PAGOS ==========
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("FORMA DE PAGO", leftMargin, yPos);
  yPos += 6;
  
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  
  if (sale.payment_method === "mixed") {
    if (sale.cash_amount && sale.cash_amount > 0) {
      pdf.text(`Efectivo: ${currency}${sale.cash_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 5;
    }
    if (sale.card_amount && sale.card_amount > 0) {
      pdf.text(`Tarjeta: ${currency}${sale.card_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 5;
    }
    if (sale.credit_amount && sale.credit_amount > 0) {
      pdf.text(`Crédito: ${currency}${sale.credit_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 5;
    }
  } else {
    pdf.text(getPaymentMethodLabel(sale.payment_method), leftMargin, yPos);
    yPos += 5;
  }

  yPos += 8;

  // ========== PIE DE PÁGINA ==========
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 8;
  
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(11);
  const footer = company?.receipt_footer || "Gracias por su compra";
  pdf.text(footer, centerX, yPos, { align: "center" });

  const fileName = copyLabel 
    ? `factura-${sale.sale_number}-${copyLabel.toLowerCase().replace(' ', '-')}.pdf`
    : `factura-${sale.sale_number}.pdf`;
  silentPrintPDF(pdf, fileName);
};

export const generateSaleTicketPDF = async (
  sale: SaleData,
  items: SaleItem[],
  company?: CompanySettings,
  copyLabel?: string,  // "COPIA EMPRESA" | "COPIA CLIENTE"
  showDebt: boolean = true
) => {
  // Normalizar fecha
  sale.created_at = normalizeSaleDate(sale.created_at);

  // Calcular altura dinámica basada en contenido
  const baseHeight = 120;
  const itemsHeight = items.length * 12;
  const totalHeight = Math.max(200, baseHeight + itemsHeight + 60);
  
  const pdf = new jsPDF({
    unit: "mm",
    format: [80, totalHeight],
  });

  const currency = company?.currency || "$";
  let yPos = 5;
  const centerX = 40;
  const leftMargin = 3;
  const rightMargin = 77;

  // Etiqueta de copia al inicio del ticket
  if (copyLabel) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(`*** ${copyLabel} ***`, centerX, yPos, { align: "center" });
    yPos += 4;
  }

  // ========== ENCABEZADO CON LOGO ==========
  if (company?.logo_url) {
    const logoResult = await loadImageAsBase64(company.logo_url);
    if (logoResult) {
      try {
        pdf.addImage(logoResult.data, logoResult.format, 28, yPos, 24, 24);
        yPos += 26;
      } catch (e) {
        console.error("Error adding logo to ticket:", e);
      }
    }
  }

  // Nombre empresa
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(company?.company_name || "Mi Empresa", centerX, yPos, { align: "center" });
  yPos += 4;

  // Tipo de comprobante
  pdf.setFontSize(8);
  pdf.text("FACTURA / COMPROBANTE", centerX, yPos, { align: "center" });
  yPos += 4;

  // Datos del emisor
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  
  if (company?.tax_id) {
    pdf.text(`RUT: ${company.tax_id}`, centerX, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.address) {
    const addr = company.address.length > 35 ? company.address.substring(0, 32) + "..." : company.address;
    pdf.text(addr, centerX, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.city) {
    pdf.text(company.city, centerX, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.phone) {
    pdf.text(`Tel: ${company.phone}`, centerX, yPos, { align: "center" });
    yPos += 3;
  }

  // Separador
  yPos += 1;
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 4;

  // ========== INFO DE VENTA ==========
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`VENTA #${sale.sale_number}`, centerX, yPos, { align: "center" });
  yPos += 4;

  // Etiqueta de reemplazo
  if (sale.replaces_sale_number) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(200, 0, 0);
    pdf.text(`REEMPLAZA VENTA #${sale.replaces_sale_number} (ANULADA)`, centerX, yPos, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    yPos += 4;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  // Validar created_at antes de formatear
  let createdAt = sale.created_at;
  if (!createdAt || createdAt === "undefined") {
    createdAt = new Date().toISOString();
  }
  const parsedDate = new Date(createdAt);
  if (isNaN(parsedDate.getTime())) {
    console.warn("created_at inválido en PDF, usando fecha actual", createdAt);
    createdAt = new Date().toISOString();
  }
  const formattedDate = format(createdAt, "dd/MM/yyyy HH:mm", { locale: es });
  pdf.text(formattedDate, centerX, yPos, { align: "center" });
  yPos += 3;
  
  pdf.text(`Tipo: ${getSaleTypeLabel(sale.payment_method)}`, leftMargin, yPos);
  yPos += 3;
  
  if (sale.cash_register?.name) {
    pdf.text(`Caja: ${sale.cash_register.name}`, leftMargin, yPos);
    yPos += 3;
  }

  pdf.text(`Cajero: ${sale.cashier?.full_name || "N/A"}`, leftMargin, yPos);
  yPos += 4;

  // ========== CLIENTE ==========
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 3;
  
  if (sale.customer) {
    const customerFullName = `${sale.customer.name} ${sale.customer.last_name || ""}`.trim();
    pdf.text(`Cliente: ${customerFullName}`, leftMargin, yPos);
    yPos += 3;
    if (sale.customer.rut) {
      pdf.text(`RUT: ${sale.customer.rut}`, leftMargin, yPos);
      yPos += 3;
    }
  } else {
    pdf.text("Cliente: Consumidor final", leftMargin, yPos);
    yPos += 3;
  }

  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 4;

  // ========== PRODUCTOS ==========
  items.forEach((item, index) => {
    const productName = item.product_name.length > 28 
      ? item.product_name.substring(0, 25) + "..." 
      : item.product_name;
    
    pdf.setFontSize(7);
    pdf.text(`${index + 1}. ${productName}`, leftMargin, yPos);
    yPos += 3;
    
    pdf.text(`   ${item.quantity} x ${currency}${item.unit_price.toFixed(2)}`, leftMargin, yPos);
    pdf.text(`${currency}${item.subtotal.toFixed(2)}`, rightMargin, yPos, { align: "right" });
    yPos += 4;
  });

  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 4;

  // ========== TOTAL ==========
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("TOTAL:", leftMargin, yPos);
  pdf.text(`${currency}${sale.total.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 5;

  // Método de pago
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  
  if (sale.payment_method === "mixed") {
    if (sale.cash_amount && sale.cash_amount > 0) {
      pdf.text(`Efectivo: ${currency}${sale.cash_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 3;
    }
    if (sale.card_amount && sale.card_amount > 0) {
      pdf.text(`Tarjeta: ${currency}${sale.card_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 3;
    }
    if (sale.credit_amount && sale.credit_amount > 0) {
      pdf.text(`Crédito: ${currency}${sale.credit_amount.toFixed(2)}`, leftMargin, yPos);
      yPos += 3;
    }
  } else {
    pdf.text(`Pago: ${getPaymentMethodLabel(sale.payment_method)}`, leftMargin, yPos);
    yPos += 3;
  }

  // Deuda posterior para crédito
  if (showDebt && sale.payment_method === "credit" && sale.customer?.current_balance !== undefined) {
    yPos += 1;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Deuda: ${currency}${sale.customer.current_balance.toFixed(2)}`, leftMargin, yPos);
    yPos += 3;
  }

  yPos += 2;
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 4;

  // ========== PIE ==========
  pdf.setFont("helvetica", "italic");
  const footer = company?.receipt_footer || "Gracias por su compra";
  const footerLines = pdf.splitTextToSize(footer, 70);
  footerLines.forEach((line: string) => {
    pdf.text(line, centerX, yPos, { align: "center" });
    yPos += 3;
  });

  const fileName = copyLabel 
    ? `ticket-${sale.sale_number}-${copyLabel.toLowerCase().replace(' ', '-')}.pdf`
    : `ticket-${sale.sale_number}.pdf`;
  silentPrintPDF(pdf, fileName);
};

// ========== FUNCIÓN DUAL: 2 COPIAS EN 1 HOJA A4 ==========

const renderCompactCopy = (
  pdf: jsPDF,
  sale: SaleData,
  items: SaleItem[],
  company: CompanySettings | undefined,
  copyLabel: string,
  startY: number,
  includeLogo: boolean,
  logoResult: { data: string; format: "PNG" | "JPEG" } | null,
  showDebt: boolean = true,
  isLastPage: boolean = true,
  pageLabel: string = "",
  globalItemOffset: number = 0
): number => {
  const currency = company?.currency || "$";
  const leftMargin = 20;
  const rightMargin = 190;
  const centerX = 105;
  let yPos = startY;

  // Etiqueta de copia + página
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(100, 100, 100);
  const labelText = pageLabel ? `${copyLabel} - ${pageLabel}` : copyLabel;
  pdf.text(labelText, rightMargin, yPos, { align: "right" });
  pdf.setTextColor(0, 0, 0);
  yPos += 2;

  // Encabezado unificado (logo + titulo + EMISOR + OPERACIÓN en 1 bloque)
  let logoLoaded = false;
  if (includeLogo && logoResult) {
    try {
      pdf.addImage(logoResult.data, logoResult.format, leftMargin, yPos, 22, 22);
      logoLoaded = true;
    } catch (e) {
      console.error("Error adding logo to PDF:", e);
    }
  }

  const companyName = company?.company_name || "Mi Empresa";
  const textX = logoLoaded ? 48 : leftMargin;
  const col2X = 135;
  let lineY = yPos;

  // Título
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("FACTURA / COMPROBANTE DE VENTA", textX, lineY + 4);

  // N° y fecha
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const saleInfo = `N° ${sale.sale_number} | ${format(new Date(sale.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}`;
  pdf.text(saleInfo, textX, lineY + 9);

  // Etiqueta de reemplazo en dual
  if (sale.replaces_sale_number) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(200, 0, 0);
    pdf.text(`REEMPLAZA VENTA #${sale.replaces_sale_number} (ANULADA)`, textX, lineY + 13);
    pdf.setTextColor(0, 0, 0);
    lineY += 4;
  }

  // EMISOR
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("EMISOR", textX, lineY + 13);
  pdf.setFont("helvetica", "normal");
  let emisorY = lineY + 16.5;
  pdf.text(companyName, textX, emisorY); emisorY += 3.5;
  if (company?.tax_id) { pdf.text(`RUT: ${company.tax_id}`, textX, emisorY); emisorY += 3.5; }
  if (company?.address) { pdf.text(company.address, textX, emisorY); emisorY += 3.5; }
  if (company?.city) { pdf.text(company.city, textX, emisorY); emisorY += 3.5; }
  if (company?.phone) { pdf.text(`Tel: ${company.phone}`, textX, emisorY); emisorY += 3.5; }
  if (company?.email) { pdf.text(`Email: ${company.email}`, textX, emisorY); emisorY += 3.5; }

  // OPERACIÓN (columna derecha)
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("OPERACIÓN", col2X, lineY + 4);
  pdf.setFont("helvetica", "normal");
  let opY = lineY + 8;
  pdf.text(`Fecha: ${format(new Date(sale.created_at), "dd/MM/yyyy", { locale: es })}`, col2X, opY); opY += 3.5;
  pdf.text(`Hora: ${format(new Date(sale.created_at), "HH:mm:ss", { locale: es })}`, col2X, opY); opY += 3.5;
  pdf.text(`N° Venta: ${sale.sale_number}`, col2X, opY); opY += 3.5;
  pdf.text(`Tipo: ${getSaleTypeLabel(sale.payment_method)}`, col2X, opY); opY += 3.5;
  if (sale.cash_register?.name) { pdf.text(`Caja: ${sale.cash_register.name}`, col2X, opY); opY += 3.5; }
  pdf.text(`Cajero: ${sale.cashier?.full_name || "N/A"}`, col2X, opY); opY += 3.5;

  yPos = Math.max(emisorY, opY, logoLoaded ? lineY + 24 : lineY) + 2;
  pdf.setLineWidth(0.5);
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 4;

  // Cliente (1 línea horizontal para ahorrar espacio)
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("CLIENTE", leftMargin, yPos);

  if (sale.customer) {
    const customerFullName = `${sale.customer.name} ${sale.customer.last_name || ""}`.trim();
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nombre: ${customerFullName}`, leftMargin + 20, yPos);
    if (showDebt && sale.payment_method === "credit" && sale.customer.current_balance !== undefined) {
      pdf.setFont("helvetica", "bold");
      pdf.text(`Deuda posterior: ${currency}${sale.customer.current_balance.toFixed(2)}`, 140, yPos);
      pdf.setFont("helvetica", "normal");
    }
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.text("CONSUMIDOR FINAL", leftMargin + 20, yPos);
  }

  yPos += 4.5;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 4.5;

  // Tabla de productos
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("N°", leftMargin, yPos);
  pdf.text("Producto", leftMargin + 8, yPos);
  pdf.text("Cant.", 115, yPos, { align: "right" });
  pdf.text("P.Unit.", 145, yPos, { align: "right" });
  pdf.text("Subtotal", rightMargin, yPos, { align: "right" });
  yPos += 2.5;
  pdf.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 4;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  items.forEach((item, index) => {
    const productName = item.product_name.length > 45
      ? item.product_name.substring(0, 42) + "..."
      : item.product_name;
    pdf.text(`${globalItemOffset + index + 1}`, leftMargin, yPos);
    pdf.text(productName, leftMargin + 8, yPos);
    pdf.text(item.quantity.toString(), 115, yPos, { align: "right" });
    pdf.text(`${currency}${item.unit_price.toFixed(2)}`, 145, yPos, { align: "right" });
    pdf.text(`${currency}${item.subtotal.toFixed(2)}`, rightMargin, yPos, { align: "right" });
    yPos += 4.5;
  });

  if (isLastPage) {
    yPos += 1;
    pdf.line(leftMargin, yPos, rightMargin, yPos);
    yPos += 4.5;

    // Totales
    const totalsX = 130;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("TOTAL:", totalsX, yPos);
    pdf.text(`${currency}${sale.total.toFixed(2)}`, rightMargin, yPos, { align: "right" });
    yPos += 5.5;

    // Forma de pago
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("FORMA DE PAGO", leftMargin, yPos);
    yPos += 4;
    pdf.setFont("helvetica", "normal");

    if (sale.payment_method === "mixed") {
      if (sale.cash_amount && sale.cash_amount > 0) { pdf.text(`Efectivo: ${currency}${sale.cash_amount.toFixed(2)}`, leftMargin, yPos); yPos += 3.5; }
      if (sale.card_amount && sale.card_amount > 0) { pdf.text(`Tarjeta: ${currency}${sale.card_amount.toFixed(2)}`, leftMargin, yPos); yPos += 3.5; }
      if (sale.credit_amount && sale.credit_amount > 0) { pdf.text(`Crédito: ${currency}${sale.credit_amount.toFixed(2)}`, leftMargin, yPos); yPos += 3.5; }
    } else {
      pdf.text(getPaymentMethodLabel(sale.payment_method), leftMargin, yPos); yPos += 3.5;
    }

    // Pie solo para copia cliente
    if (includeLogo) {
      yPos += 2;
      pdf.line(leftMargin, yPos, rightMargin, yPos);
      yPos += 4;
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      const footer = company?.receipt_footer || "Gracias por su compra";
      pdf.text(footer, centerX, yPos, { align: "center" });
      yPos += 4;
    }
  } else {
    // Not last page: just indicate continuation
    yPos += 1;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(100, 100, 100);
    pdf.text("continúa en la siguiente página...", centerX, yPos, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    yPos += 4;
  }

  return yPos;
};

// Helper to chunk an array
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const generateSaleDualA4PDF = async (
  sale: SaleData,
  items: SaleItem[],
  company?: CompanySettings,
  showDebt: boolean = true
) => {
  const pdf = new jsPDF();

  // Cargar logo una sola vez
  let logoResult: { data: string; format: "PNG" | "JPEG" } | null = null;
  if (company?.logo_url) {
    logoResult = await loadImageAsBase64(company.logo_url);
  }

  const halfPage = 148.5; // Mitad exacta de A4
  const ITEMS_PER_PAGE = 15;
  const itemChunks = chunkArray(items, ITEMS_PER_PAGE);
  const totalPages = itemChunks.length;

  itemChunks.forEach((chunk, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    const isLastPage = pageIndex === totalPages - 1;
    const pageLabel = totalPages > 1 ? `Pág. ${pageIndex + 1}/${totalPages}` : "";
    const globalItemOffset = pageIndex * ITEMS_PER_PAGE;

    // Copia cliente (mitad superior)
    renderCompactCopy(pdf, sale, chunk, company, "COPIA CLIENTE", 10, true, logoResult, showDebt, isLastPage, pageLabel, globalItemOffset);

    // Línea de corte en la mitad exacta
    pdf.setLineDashPattern([2, 2], 0);
    pdf.setLineWidth(0.3);
    pdf.line(20, halfPage, 190, halfPage);
    pdf.setLineDashPattern([], 0);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 120);
    pdf.text("✂  CORTAR AQUÍ  ✂", 105, halfPage - 1, { align: "center" });
    pdf.setTextColor(0, 0, 0);

    // Copia empresa (mitad inferior)
    renderCompactCopy(pdf, sale, chunk, company, "COPIA EMPRESA", halfPage + 5, false, logoResult, showDebt, isLastPage, pageLabel, globalItemOffset);
  });

  const fechaFile = format(new Date(sale.created_at), "ddMMyyyy-HHmmss");
  silentPrintPDF(pdf, `factura-${sale.sale_number}-${fechaFile}.pdf`);
};
