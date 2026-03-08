import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { silentPrintPDF } from "./silentPrint";

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

interface DebtPaymentData {
  customerName: string;
  paymentAmount: number;
  paymentMethod: string;
  previousBalance: number;
  newBalance: number;
  creditLimit: number;
  company?: CompanySettings;
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
      reader.onloadend = () => resolve(reader.result ? { data: reader.result as string, format: fmt } : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia" };
  return labels[method] || "Otro";
};

export const generateDebtPaymentTicket = async (data: DebtPaymentData) => {
  const { customerName, paymentAmount, paymentMethod, previousBalance, newBalance, creditLimit, company } = data;
  const currency = company?.currency || "$";
  const totalHeight = 200;

  const pdf = new jsPDF({
    unit: "mm",
    format: [80, totalHeight],
  });

  let yPos = 5;
  const centerX = 40;
  const leftMargin = 3;
  const rightMargin = 77;

  // ========== LOGO ==========
  if (company?.logo_url) {
    const logoResult = await loadImageAsBase64(company.logo_url);
    if (logoResult) {
      try {
        pdf.addImage(logoResult.data, logoResult.format, 28, yPos, 24, 24);
        yPos += 26;
      } catch (e) {
        console.error("Error adding logo:", e);
      }
    }
  }

  // ========== EMPRESA ==========
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(company?.company_name || "Mi Empresa", centerX, yPos, { align: "center" });
  yPos += 5;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("COMPROBANTE DE PAGO", centerX, yPos, { align: "center" });
  yPos += 4;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  if (company?.tax_id) {
    pdf.text(`RUT: ${company.tax_id}`, centerX, yPos, { align: "center" });
    yPos += 3;
  }
  if (company?.address) {
    pdf.text(company.address.length > 35 ? company.address.substring(0, 32) + "..." : company.address, centerX, yPos, { align: "center" });
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
  yPos += 5;

  // ========== FECHA ==========
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  const now = new Date();
  pdf.text(`Fecha: ${format(now, "dd/MM/yyyy", { locale: es })}`, leftMargin, yPos);
  pdf.text(`Hora: ${format(now, "HH:mm:ss")}`, rightMargin, yPos, { align: "right" });
  yPos += 5;

  // Separador
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 5;

  // ========== CLIENTE ==========
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("CLIENTE", leftMargin, yPos);
  yPos += 4;
  pdf.setFont("helvetica", "normal");
  pdf.text(customerName, leftMargin, yPos);
  yPos += 5;

  // Separador
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 5;

  // ========== DETALLE DEL PAGO ==========
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("DETALLE DEL PAGO", leftMargin, yPos);
  yPos += 5;

  pdf.setFont("helvetica", "normal");
  pdf.text("Método de pago:", leftMargin, yPos);
  pdf.text(getPaymentMethodLabel(paymentMethod), rightMargin, yPos, { align: "right" });
  yPos += 4;

  pdf.text("Deuda anterior:", leftMargin, yPos);
  pdf.text(`${currency}${previousBalance.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 5;

  // Monto pagado destacado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("MONTO PAGADO:", leftMargin, yPos);
  pdf.text(`${currency}${paymentAmount.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Nueva deuda:", leftMargin, yPos);
  pdf.text(`${currency}${newBalance.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 4;

  const available = creditLimit - newBalance;
  pdf.text("Saldo disponible:", leftMargin, yPos);
  pdf.text(`${currency}${available.toFixed(2)}`, rightMargin, yPos, { align: "right" });
  yPos += 5;

  // Separador
  pdf.text("--------------------------------", centerX, yPos, { align: "center" });
  yPos += 5;

  // ========== PIE ==========
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7);
  const footer = company?.receipt_footer || "Gracias por su pago";
  pdf.text(footer, centerX, yPos, { align: "center" });

  const safeName = (company?.company_name || "pago").replace(/[^a-zA-Z0-9]/g, "_");
  silentPrintPDF(pdf, `${safeName}-comprobante-pago-${format(now, "yyyyMMdd-HHmmss")}.pdf`);
};
