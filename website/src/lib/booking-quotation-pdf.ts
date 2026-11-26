import { jsPDF } from "jspdf";
import { formatKES } from "@/lib/pricing";
import { getBookingSavings, type BookingQuotationData } from "@/lib/booking-quotation";

const NAVY = [10, 35, 66] as const;
const GOLD = [200, 164, 93] as const;
const INK = [26, 26, 26] as const;
const MUTED = [107, 114, 128] as const;

export const downloadBookingQuotationPdf = (quotation: BookingQuotationData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 17;
  const savings = getBookingSavings(quotation);
  let y = 58;

  const addHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 43, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("CONCEPT CLEANING SERVICES", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Professional cleaning & car detailing · Kenya", margin, 22);
    doc.text("+254 796 563 741 · concept-cleaning-kenya.lovable.app", margin, 28);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("BOOKING QUOTATION", pageWidth - margin, 16, { align: "right" });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("PRELIMINARY · AWAITING SERVICE CONFIRMATION", pageWidth - margin, 22, { align: "right" });
  };

  const addSectionTitle = (title: string) => {
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin, y);
    y += 5;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= 270) return;
    doc.addPage();
    addHeader();
    y = 53;
  };

  const writeWrapped = (text: string, x: number, width: number, fontSize = 9, color: readonly number[] = INK) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, width) as string[];
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.42 + 1.2);
  };

  addHeader();
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Booking reference: ${quotation.bookingNumber}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Prepared ${new Date().toLocaleDateString("en-KE")}`, pageWidth - margin, y, { align: "right" });
  y += 9;

  addSectionTitle("Client & appointment");
  const leftX = margin;
  const rightX = pageWidth / 2 + 4;
  const detailPairs = [
    ["Client", quotation.clientName, leftX],
    ["Phone", quotation.phone, rightX],
    ["Location", quotation.location, leftX],
    ["Appointment", `${quotation.date} · ${quotation.timeSlot}`, rightX],
    ["Payment preference", quotation.paymentMethod, leftX],
  ] as const;
  for (const [label, value, x] of detailPairs) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    const valueLines = doc.splitTextToSize(value || "—", 76) as string[];
    doc.text(valueLines, x, y + 4.5);
    if (x === rightX) y += Math.max(10, valueLines.length * 4 + 4);
  }
  if (detailPairs.at(-1)?.[2] === leftX) y += 10;
  y += 2;

  addSectionTitle("Services & selected extras");
  doc.setFillColor(244, 246, 248);
  doc.rect(margin, y - 1, pageWidth - margin * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("SERVICE / DESCRIPTION", margin + 2, y + 3.5);
  doc.text("QTY", 130, y + 3.5, { align: "right" });
  doc.text("UNIT", 161, y + 3.5, { align: "right" });
  doc.text("AMOUNT", pageWidth - margin - 2, y + 3.5, { align: "right" });
  y += 11;

  for (const [index, line] of quotation.serviceLines.entries()) {
    const description = line.description?.replace(/\s+/g, " ").trim();
    const titleLines = doc.splitTextToSize(`${index + 1}. ${line.name}`, 100) as string[];
    const descriptionLines = description ? doc.splitTextToSize(description, 100) as string[] : [];
    const rowHeight = Math.max(8, titleLines.length * 4 + descriptionLines.length * 3.5 + 2);
    ensureSpace(rowHeight + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(titleLines, margin + 2, y);
    if (descriptionLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(descriptionLines, margin + 2, y + titleLines.length * 4);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(String(line.quantity), 130, y, { align: "right" });
    doc.text(formatKES(line.unitPrice), 161, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(formatKES(line.unitPrice * line.quantity), pageWidth - margin - 2, y, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(230, 233, 236);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  if (quotation.freeAddons.length) {
    ensureSpace(18 + quotation.freeAddons.length * 9);
    y += 2;
    addSectionTitle("Complimentary add-ons");
    for (const addon of quotation.freeAddons) {
      const description = addon.description?.replace(/\s+/g, " ").trim();
      const label = `${addon.name}${description ? ` — ${description}` : ""}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(label, 128) as string[], margin + 1, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(14, 159, 110);
      doc.text("FREE · KES 0", pageWidth - margin, y, { align: "right" });
      const labelLines = doc.splitTextToSize(label, 128) as string[];
      y += Math.max(7, labelLines.length * 4.2);
      const regularPrice = Number(addon.regularPrice) || 0;
      if (regularPrice > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(`Regular value: ${formatKES(regularPrice)}`, margin + 1, y - 2);
      }
    }
  }

  ensureSpace(55);
  y += 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 89, y, pageWidth - margin, y);
  y += 7;
  const totalRow = (label: string, value: string, bold = false, color: readonly number[] = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 8.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(label, pageWidth - 88, y);
    doc.text(value, pageWidth - margin, y, { align: "right" });
    y += bold ? 7 : 5.5;
  };
  totalRow("Service subtotal", formatKES(quotation.pricing.subtotal));
  totalRow("Transport", formatKES(quotation.pricing.transport));
  if (quotation.pricing.membershipDiscount > 0) totalRow("Membership savings", `−${formatKES(quotation.pricing.membershipDiscount)}`, false, [14, 159, 110]);
  if (quotation.pricing.bundleDiscount > 0) totalRow("Bundle savings", `−${formatKES(quotation.pricing.bundleDiscount)}`, false, [14, 159, 110]);
  if (quotation.pricing.promoDiscount > 0) totalRow("Promotion savings", `−${formatKES(quotation.pricing.promoDiscount)}`, false, [14, 159, 110]);
  if (savings.freeAddonValue > 0) totalRow("Free add-on value", `−${formatKES(savings.freeAddonValue)}`, false, [14, 159, 110]);
  totalRow("Standard value", formatKES(savings.originalTotal));
  totalRow(`YOU SAVE · ${savings.total > 0 ? "GREAT VALUE" : ""}`, formatKES(savings.total), true, [14, 159, 110]);
  doc.setFillColor(...NAVY);
  doc.roundedRect(pageWidth - 91, y, 74, 15, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TO PAY", pageWidth - 88, y + 5);
  doc.setFontSize(11);
  doc.text(formatKES(quotation.pricing.total), pageWidth - margin - 2, y + 10, { align: "right" });
  y += 22;

  if (quotation.notes) {
    ensureSpace(18);
    addSectionTitle("Special instructions");
    y += writeWrapped(quotation.notes, margin, pageWidth - margin * 2, 8.5) + 4;
  }

  doc.setDrawColor(230, 233, 236);
  doc.line(margin, Math.min(y, 278), pageWidth - margin, Math.min(y, 278));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("This is a preliminary booking estimate and is not an approved final quotation. Final service scope and price are subject to confirmation by Concept Cleaning Services.", margin, Math.min(y + 5, 283), {
    maxWidth: pageWidth - margin * 2,
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Concept Cleaning Services · ${quotation.bookingNumber} · Page ${page} of ${pageCount}`, pageWidth / 2, 291, { align: "center" });
  }

  doc.save(`Concept-Quotation-${quotation.bookingNumber}.pdf`);
};