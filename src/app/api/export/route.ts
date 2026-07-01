import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Footer, Header, PageNumber, BorderStyle,
  Table, TableRow, TableCell, WidthType, ShadingType,
  convertInchesToTwip,
} from "docx";

const NAVY  = "0F2557";
const GOLD  = "C8921A";
const GRAY  = "4A5568";
const WHITE = "FFFFFF";
const LIGHT = "F8FAFC";

// ── Inline markdown → TextRun[] ──────────────────────────────
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), font: "Calibri", size: 22, color: "1A202C" }));
    if (m[1]) runs.push(new TextRun({ text: m[1], bold: true, font: "Calibri", size: 22, color: NAVY }));
    else if (m[2]) runs.push(new TextRun({ text: m[2], italics: true, font: "Calibri", size: 22, color: GRAY }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], font: "Courier New", size: 20, color: "8B1A2B" }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), font: "Calibri", size: 22, color: "1A202C" }));
  return runs.length ? runs : [new TextRun({ text, font: "Calibri", size: 22, color: "1A202C" })];
}

// ── Markdown → Paragraph[] ───────────────────────────────────
function mdToDocx(markdown: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip divider lines in tables (|---|---|)
    if (/^\|[\s\-:]+\|/.test(trimmed)) { i++; continue; }

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\|[\s\-:]+\|/.test(lines[i].trim())) tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length > 0) {
        const rows = tableLines.map((tl, ri) =>
          new TableRow({
            children: tl.slice(1, -1).split("|").map(cell =>
              new TableCell({
                children: [new Paragraph({
                  children: parseInline(cell.trim()),
                  spacing: { before: 60, after: 60 },
                })],
                shading: ri === 0 ? { type: ShadingType.SOLID, color: NAVY } : { type: ShadingType.SOLID, color: ri % 2 === 0 ? LIGHT : WHITE },
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
              })
            ),
          })
        );
        // Override first row text color to white
        elements.push(new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
          },
        }));
        elements.push(new Paragraph({ text: "", spacing: { before: 120, after: 120 } }));
      }
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(3), bold: true, font: "DM Serif Display, Times New Roman", size: 30, color: NAVY })],
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
      }));
      i++; continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(4), bold: true, font: "Calibri", size: 26, color: NAVY })],
        spacing: { before: 200, after: 80 },
      }));
      i++; continue;
    }

    // H4 / ####
    if (trimmed.startsWith("#### ")) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(5), bold: true, font: "Calibri", size: 23, color: GRAY })],
        spacing: { before: 160, after: 60 },
      }));
      i++; continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      elements.push(new Paragraph({
        children: parseInline(trimmed.slice(2)),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
        indent: { left: convertInchesToTwip(0.25) },
      }));
      i++; continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      elements.push(new Paragraph({
        children: [
          new TextRun({ text: `${numMatch[1]}. `, bold: true, font: "Calibri", size: 22, color: NAVY }),
          ...parseInline(numMatch[2]),
        ],
        spacing: { before: 40, after: 40 },
        indent: { left: convertInchesToTwip(0.25) },
      }));
      i++; continue;
    }

    // Blockquote / callout
    if (trimmed.startsWith("> ")) {
      elements.push(new Paragraph({
        children: parseInline(trimmed.slice(2)),
        spacing: { before: 80, after: 80 },
        indent: { left: convertInchesToTwip(0.3) },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD } },
        shading: { type: ShadingType.SOLID, color: "FFF8E7" },
      }));
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(new Paragraph({
        text: "",
        spacing: { before: 120, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: "E2E8F0" } },
      }));
      i++; continue;
    }

    // Empty line
    if (!trimmed) {
      elements.push(new Paragraph({ text: "", spacing: { before: 60, after: 60 } }));
      i++; continue;
    }

    // Normal paragraph
    elements.push(new Paragraph({
      children: parseInline(trimmed),
      spacing: { before: 60, after: 80 },
    }));
    i++;
  }

  return elements;
}

// ── Cover page paragraphs ────────────────────────────────────
function coverPage(title: string, date: string): Paragraph[] {
  return [
    new Paragraph({ text: "", spacing: { before: 1400, after: 0 } }),
    new Paragraph({
      children: [new TextRun({ text: "IMPI Lex", font: "Times New Roman", size: 72, bold: true, color: NAVY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Agente de Propiedad Industrial · México", font: "Calibri", size: 24, color: GRAY, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "▬".repeat(32), font: "Calibri", size: 14, color: GOLD })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 600 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, font: "Times New Roman", size: 40, bold: true, color: NAVY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: date, font: "Calibri", size: 22, color: GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 800 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Generado por IMPI Lex — Marca tu Marca", font: "Calibri", size: 18, color: GOLD, italics: true })],
      alignment: AlignmentType.CENTER,
    }),
  ];
}

// ── Main handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { content, title = "Informe de Propiedad Industrial" } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Generado por IMPI Lex — Marca tu Marca  |  Página ", font: "Calibri", size: 18, color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: GRAY }),
            new TextRun({ text: " de ", font: "Calibri", size: 18, color: GRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 18, color: GRAY }),
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 3, color: "E2E8F0" } },
          spacing: { before: 120 },
        }),
      ],
    });

    const doc = new Document({
      creator: "IMPI Lex",
      title,
      description: "Informe generado por IMPI Lex — Agente de Propiedad Industrial",
      sections: [
        // Cover page (no footer)
        {
          properties: {},
          children: coverPage(title, dateStr),
        },
        // Content section with footer
        {
          properties: {},
          footers: { default: footer },
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, font: "Times New Roman", size: 36, bold: true, color: NAVY })],
              spacing: { before: 0, after: 200 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Fecha: ${dateStr}`, font: "Calibri", size: 20, italics: true, color: GRAY })],
              spacing: { before: 80, after: 320 },
            }),
            ...mdToDocx(content),
            new Paragraph({ text: "", spacing: { before: 400 } }),
            new Paragraph({
              children: [new TextRun({ text: "— Fin del informe —", font: "Calibri", size: 20, italics: true, color: GRAY })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="impi-lex-${safeName}.docx"`,
      },
    });
  } catch (error) {
    console.error("Error generando .docx:", error);
    return NextResponse.json({ error: "Error al generar el documento" }, { status: 500 });
  }
}
