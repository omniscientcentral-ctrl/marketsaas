import jsPDF from "jspdf";

/**
 * Imprime un PDF abriendo una ventana con autoPrint habilitado.
 * Si la ventana es bloqueada por el navegador, descarga el archivo como fallback.
 */
export const silentPrintPDF = (pdf: jsPDF, fallbackFileName: string) => {
  try {
    pdf.autoPrint();
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    const printWindow = window.open(blobUrl, "_blank");

    if (printWindow) {
      // Limpiar blob URL después de un tiempo prudente
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } else {
      // window.open bloqueado por el navegador → fallback descarga
      console.warn("Ventana de impresión bloqueada, descargando archivo");
      URL.revokeObjectURL(blobUrl);
      pdf.save(fallbackFileName);
    }
  } catch (e) {
    console.error("Error en silentPrintPDF:", e);
    pdf.save(fallbackFileName);
  }
};
