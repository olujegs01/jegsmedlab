import jsPDF from "jspdf";

interface ReportData {
  symptoms: string[];
  duration?: string;
  severity?: string;
  age?: string;
  sex?: string;
  urgencyLevel?: string;
  aiText: string;
}

const URGENCY_LABELS: Record<string, string> = {
  emergency: "EMERGENCY",
  urgent: "URGENT",
  schedule_soon: "SCHEDULE SOON",
  routine: "ROUTINE",
};

const URGENCY_RGB: Record<string, [number, number, number]> = {
  emergency: [220, 38, 38],
  urgent: [234, 88, 12],
  schedule_soon: [217, 119, 6],
  routine: [5, 150, 105],
};

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-]\s+/gm, "  • ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportSymptomPDF(data: ReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  const nl = (extra = 0) => { y += extra; };

  const text = (
    str: string,
    size: number,
    bold = false,
    color: [number, number, number] = [30, 30, 30],
    indent = 0,
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(str, contentW - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * (size * 0.38 + 1);
  };

  const checkBreak = (needed = 15) => {
    if (y > pageH - needed - 18) {
      doc.addPage();
      y = 18;
    }
  };

  // ── Purple header ──────────────────────────────────────────────────────────
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, pageW, 32, "F");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("JegsMedLab", margin, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("AI Clinical Assessment Report", margin, 20);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  doc.text(dateStr, pageW - margin, 20, { align: "right" });

  y = 42;

  // ── Patient info ───────────────────────────────────────────────────────────
  text("PATIENT INFORMATION", 9, true, [109, 40, 217]);
  nl(1);
  const patientParts: string[] = [];
  if (data.age) patientParts.push(`Age: ${data.age}`);
  if (data.sex) patientParts.push(`Sex: ${data.sex.charAt(0).toUpperCase() + data.sex.slice(1)}`);
  text(patientParts.length > 0 ? patientParts.join("   •   ") : "Demographics not provided", 9);
  nl(4);

  // ── Symptoms ───────────────────────────────────────────────────────────────
  text("PRESENTING SYMPTOMS", 9, true, [109, 40, 217]);
  nl(1);
  text(data.symptoms.join("  •  "), 9);
  if (data.duration) text(`Duration: ${data.duration}`, 9);
  if (data.severity) text(`Severity: ${data.severity.charAt(0).toUpperCase() + data.severity.slice(1)}`, 9);
  nl(4);

  // ── Triage badge ───────────────────────────────────────────────────────────
  if (data.urgencyLevel) {
    const uc = URGENCY_RGB[data.urgencyLevel] || URGENCY_RGB.routine;
    doc.setFillColor(uc[0], uc[1], uc[2]);
    doc.roundedRect(margin, y, 58, 7, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(
      `TRIAGE: ${URGENCY_LABELS[data.urgencyLevel] || data.urgencyLevel.toUpperCase()}`,
      margin + 4,
      y + 4.8,
    );
    y += 12;
  }

  // ── Divider ────────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ── AI Analysis ───────────────────────────────────────────────────────────
  text("CLINICAL ANALYSIS", 9, true, [109, 40, 217]);
  nl(2);

  const SECTION_EMOJIS = ["🚨", "🩺", "💡", "⚡", "📋"];
  const stripped = stripMarkdown(data.aiText);
  const lines = stripped.split("\n");

  doc.setTextColor(30, 30, 30);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { nl(2); continue; }

    checkBreak(14);

    const isSection = SECTION_EMOJIS.some((e) => trimmed.startsWith(e));
    if (isSection) {
      nl(2);
      text(trimmed, 10, true, [30, 30, 30]);
      nl(1);
    } else if (trimmed.startsWith("  •") || trimmed.startsWith("•")) {
      text(trimmed, 9, false, [30, 30, 30], 3);
    } else {
      text(trimmed, 9);
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const fY = pageH - 16;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, fY, pageW - margin, fY);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(
      "This AI-generated report is for educational purposes only and does not constitute medical advice or a diagnosis. Consult a licensed healthcare provider.",
      margin,
      fY + 4,
    );
    doc.text(
      `Page ${i} of ${totalPages}  •  JegsMedLab  •  Generated ${new Date().toLocaleDateString()}`,
      pageW - margin,
      fY + 9,
      { align: "right" },
    );
  }

  doc.save(`JegsMedLab_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
