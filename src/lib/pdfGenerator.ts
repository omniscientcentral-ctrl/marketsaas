import { jsPDF } from "jspdf";
import { format } from "date-fns";

interface CashRegisterData {
  id: string;
  cashier_id: string;
  opened_at: string;
  closed_at?: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  difference?: number;
  difference_reason?: string;
  cash_denominations?: any;
  card_total?: number;
  credit_sales_total?: number;
  cash_withdrawals?: number;
  other_expenses?: number;
  ticket_count?: number;
  closure_type?: string;
}

interface SalesData {
  totalSales: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
}

export interface CompanySettings {
  company_name?: string;
  tax_id?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  currency?: string;
  logo_url?: string;
  receipt_footer?: string;
}

const loadImageAsBase64 = async (url: string): Promise<{ data: string; format: "PNG" | "JPEG" } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    let fmt: "PNG" | "JPEG" = "JPEG";
    if (blob.type === "image/png") fmt = "PNG";
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result ? { data: result, format: fmt } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const buildFileName = (company?: CompanySettings, closureType?: string) => {
  const safeName = (company?.company_name || "Empresa").replace(/[^a-zA-Z0-9]/g, "-");
  return `${safeName}-Cierre-${closureType || "Z"}-${format(new Date(), "yyyyMMdd-HHmmss")}.pdf`;
};

export const generateA4PDF = async (
  cashRegister: CashRegisterData,
  salesData: SalesData,
  cashierName: string,
  company?: CompanySettings
) => {
  const doc = new jsPDF();
  let yPos = 15;
  const leftMargin = 20;
  const rightMargin = 190;
  const centerX = 105;
  const companyName = company?.company_name || "Mi Empresa";

  // ========== LOGO ==========
  let logoLoaded = false;
  if (company?.logo_url) {
    const logoResult = await loadImageAsBase64(company.logo_url);
    if (logoResult) {
      try {
        doc.addImage(logoResult.data, logoResult.format, leftMargin, yPos, 30, 30);
        logoLoaded = true;
      } catch (e) {
        console.error("Error adding logo:", e);
      }
    }
  }

  // ========== ENCABEZADO ==========
  const textStartX = logoLoaded ? 55 : centerX;
  const textAlign = logoLoaded ? undefined : "center";

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  if (textAlign === "center") {
    doc.text(companyName, textStartX, yPos + 8, { align: "center" });
  } else {
    doc.text(companyName, textStartX, yPos + 8);
  }

  doc.setFontSize(14);
  const title = `Cierre de Caja ${cashRegister.closure_type || "Z"}`;
  if (textAlign === "center") {
    doc.text(title, textStartX, yPos + 16, { align: "center" });
  } else {
    doc.text(title, textStartX, yPos + 16);
  }

  // Datos de empresa
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let infoY = yPos + 22;
  const infoX = logoLoaded ? 55 : centerX;

  const companyLines: string[] = [];
  if (company?.tax_id) companyLines.push(`CUIT: ${company.tax_id}`);
  if (company?.address) companyLines.push(company.address);
  if (company?.city) companyLines.push(company.city);
  if (company?.phone) companyLines.push(`Tel: ${company.phone}`);
  if (company?.email) companyLines.push(company.email);

  companyLines.forEach(line => {
    if (textAlign === "center") {
      doc.text(line, infoX, infoY, { align: "center" });
    } else {
      doc.text(line, infoX, infoY);
    }
    infoY += 4;
  });

  yPos = Math.max(logoLoaded ? yPos + 35 : yPos + 28, infoY + 2);

  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 10;

  // ========== INFORMACIÓN GENERAL ==========
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cajero: ${cashierName}`, leftMargin, yPos);
  yPos += 6;
  doc.text(`Fecha Apertura: ${format(new Date(cashRegister.opened_at), "dd/MM/yyyy HH:mm")}`, leftMargin, yPos);
  yPos += 6;
  if (cashRegister.closed_at) {
    doc.text(`Fecha Cierre: ${format(new Date(cashRegister.closed_at), "dd/MM/yyyy HH:mm")}`, leftMargin, yPos);
    yPos += 6;
  }
  doc.text(`N° de Tickets: ${cashRegister.ticket_count || 0}`, leftMargin, yPos);

  yPos += 12;
  doc.setFont("helvetica", "bold");
  doc.text("VENTAS DEL DÍA", leftMargin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 8;

  doc.text(`Efectivo: $${salesData.cashSales.toFixed(2)}`, 25, yPos); yPos += 6;
  doc.text(`Tarjeta: $${salesData.cardSales.toFixed(2)}`, 25, yPos); yPos += 6;
  doc.text(`Crédito: $${salesData.creditSales.toFixed(2)}`, 25, yPos); yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Ventas: $${salesData.totalSales.toFixed(2)}`, 25, yPos);
  doc.setFont("helvetica", "normal");

  yPos += 12;
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 10;

  doc.setFont("helvetica", "bold");
  doc.text("MOVIMIENTOS DE CAJA", leftMargin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 8;

  doc.text(`Apertura: $${cashRegister.opening_amount.toFixed(2)}`, 25, yPos); yPos += 6;
  doc.text(`Ventas Efectivo: $${salesData.cashSales.toFixed(2)}`, 25, yPos); yPos += 6;
  doc.text(`Retiros: $${(cashRegister.cash_withdrawals || 0).toFixed(2)}`, 25, yPos); yPos += 6;
  doc.text(`Gastos: $${(cashRegister.other_expenses || 0).toFixed(2)}`, 25, yPos); yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Esperado: $${(cashRegister.expected_amount || 0).toFixed(2)}`, 25, yPos);
  doc.setFont("helvetica", "normal");

  yPos += 12;
  doc.line(leftMargin, yPos, rightMargin, yPos);
  yPos += 10;

  doc.setFont("helvetica", "bold");
  doc.text("ARQUEO DE CAJA", leftMargin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 8;

  if (cashRegister.cash_denominations) {
    const denoms = cashRegister.cash_denominations;
    const denominations = [
      { label: "Billetes $1000", key: "bill_1000" },
      { label: "Billetes $500", key: "bill_500" },
      { label: "Billetes $200", key: "bill_200" },
      { label: "Billetes $100", key: "bill_100" },
      { label: "Billetes $50", key: "bill_50" },
      { label: "Billetes $20", key: "bill_20" },
      { label: "Billetes $10", key: "bill_10" },
      { label: "Monedas $10", key: "coin_10" },
      { label: "Monedas $5", key: "coin_5" },
      { label: "Monedas $2", key: "coin_2" },
      { label: "Monedas $1", key: "coin_1" },
    ];
    denominations.forEach((denom) => {
      const count = denoms[denom.key] || 0;
      if (count > 0) {
        doc.text(`${denom.label}: ${count}`, 25, yPos);
        yPos += 6;
      }
    });
  }

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Contado: $${(cashRegister.closing_amount || 0).toFixed(2)}`, 25, yPos);
  doc.setFont("helvetica", "normal");

  yPos += 12;
  doc.setFont("helvetica", "bold");
  const difference = cashRegister.difference || 0;
  const diffColor = difference === 0 ? [0, 128, 0] : difference > 0 ? [0, 100, 200] : [200, 0, 0];
  doc.setTextColor(diffColor[0], diffColor[1], diffColor[2]);
  doc.text(`DIFERENCIA: $${difference.toFixed(2)}`, leftMargin, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  if (cashRegister.difference_reason) {
    yPos += 8;
    doc.text(`Motivo: ${cashRegister.difference_reason}`, 25, yPos);
  }

  // ========== PIE DE PÁGINA ==========
  yPos += 15;
  if (company?.receipt_footer) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(company.receipt_footer, centerX, yPos, { align: "center" });
    yPos += 8;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Documento generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, centerX, yPos, { align: "center" });

  doc.save(buildFileName(company, cashRegister.closure_type));
};

export const generateTicketPDF = async (
  cashRegister: CashRegisterData,
  salesData: SalesData,
  cashierName: string,
  company?: CompanySettings
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 297],
  });

  let yPos = 5;
  const leftMargin = 5;
  const pageWidth = 80;
  const companyName = company?.company_name || "Mi Empresa";

  // ========== LOGO ==========
  if (company?.logo_url) {
    const logoResult = await loadImageAsBase64(company.logo_url);
    if (logoResult) {
      try {
        doc.addImage(logoResult.data, logoResult.format, 28, yPos, 24, 24);
        yPos += 26;
      } catch (e) {
        console.error("Error adding logo to ticket:", e);
      }
    }
  }

  // Título
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.setFontSize(10);
  doc.text(`Cierre ${cashRegister.closure_type || "Z"}`, pageWidth / 2, yPos, { align: "center" });

  // Datos empresa
  yPos += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  if (company?.tax_id) {
    doc.text(`CUIT: ${company.tax_id}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.address) {
    const addr = company.address.length > 35 ? company.address.substring(0, 32) + "..." : company.address;
    doc.text(addr, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.phone) {
    doc.text(`Tel: ${company.phone}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }

  yPos += 2;
  doc.setFontSize(8);
  doc.text("================================", pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.text(`Cajero: ${cashierName}`, leftMargin, yPos); yPos += 4;
  doc.text(`Apertura: ${format(new Date(cashRegister.opened_at), "dd/MM/yyyy HH:mm")}`, leftMargin, yPos); yPos += 4;
  if (cashRegister.closed_at) {
    doc.text(`Cierre: ${format(new Date(cashRegister.closed_at), "dd/MM/yyyy HH:mm")}`, leftMargin, yPos);
    yPos += 4;
  }
  doc.text(`Tickets: ${cashRegister.ticket_count || 0}`, leftMargin, yPos);

  yPos += 6;
  doc.text("================================", pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("VENTAS", leftMargin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;

  doc.text("Efectivo:", leftMargin, yPos);
  doc.text(`$${salesData.cashSales.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.text("Tarjeta:", leftMargin, yPos);
  doc.text(`$${salesData.cardSales.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.text("Crédito:", leftMargin, yPos);
  doc.text(`$${salesData.creditSales.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", leftMargin, yPos);
  doc.text(`$${salesData.totalSales.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });
  doc.setFont("helvetica", "normal");

  yPos += 6;
  doc.text("================================", pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("CAJA", leftMargin, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;

  doc.text("Apertura:", leftMargin, yPos);
  doc.text(`$${cashRegister.opening_amount.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.text("+ Efectivo:", leftMargin, yPos);
  doc.text(`$${salesData.cashSales.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.text("- Retiros:", leftMargin, yPos);
  doc.text(`$${(cashRegister.cash_withdrawals || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.text("- Gastos:", leftMargin, yPos);
  doc.text(`$${(cashRegister.other_expenses || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" }); yPos += 4;
  doc.setFont("helvetica", "bold");
  doc.text("ESPERADO:", leftMargin, yPos);
  doc.text(`$${(cashRegister.expected_amount || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });
  doc.setFont("helvetica", "normal");

  yPos += 6;
  doc.text("================================", pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Contado:", leftMargin, yPos);
  doc.text(`$${(cashRegister.closing_amount || 0).toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });

  yPos += 5;
  const difference = cashRegister.difference || 0;
  doc.text("DIFERENCIA:", leftMargin, yPos);
  doc.text(`$${difference.toFixed(2)}`, pageWidth - leftMargin, yPos, { align: "right" });
  doc.setFont("helvetica", "normal");

  if (cashRegister.difference_reason) {
    yPos += 5;
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(`Motivo: ${cashRegister.difference_reason}`, pageWidth - 2 * leftMargin);
    doc.text(lines, leftMargin, yPos);
    yPos += lines.length * 3;
  }

  // Pie
  yPos += 4;
  if (company?.receipt_footer) {
    doc.setFontSize(6);
    doc.setFont("helvetica", "italic");
    const footerLines = doc.splitTextToSize(company.receipt_footer, pageWidth - 2 * leftMargin);
    doc.text(footerLines, pageWidth / 2, yPos, { align: "center" });
    yPos += footerLines.length * 3;
  }

  yPos += 3;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(`${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, yPos, { align: "center" });

  doc.save(buildFileName(company, cashRegister.closure_type));
};
