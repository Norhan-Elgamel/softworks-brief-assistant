/**
 * PDF Export — Member 2 deliverable
 * Generates a structured brief PDF and uploads it to Supabase storage.
 * Uses jsPDF (browser-safe, works in Next.js API routes via dynamic import).
 */

import { supabaseAdmin } from './supabase';
import type { Brief, BriefAsset } from '../types';

export async function generateBriefPDF(
  brief: Brief,
  assets: BriefAsset[]
): Promise<string> {
  // Dynamic import so jsPDF is only bundled server-side
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Helper functions ──────────────────────────────────────────
  const addText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; wrap?: boolean } = {}
  ) => {
    const { size = 11, bold = false, color = [30, 30, 30], wrap = true } = opts;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    if (wrap) {
      const lines = doc.splitTextToSize(text, contentW);
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.4) + 2;
    } else {
      doc.text(text, margin, y);
      y += size * 0.4 + 2;
    }
  };

  const addLine = () => {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };

  const addSection = (title: string) => {
    y += 4;
    addLine();
    addText(title, { size: 13, bold: true, color: [0, 100, 200] });
    y += 2;
  };

  const checkNewPage = (needed = 20) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header ────────────────────────────────────────────────────
  doc.setFillColor(0, 80, 160);
  doc.rect(0, 0, pageW, 35, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Softworks Brief Assistant', margin, 16);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Structured Project Brief', margin, 26);
  y = 45;

  // ── Project title ─────────────────────────────────────────────
  const title = brief.project_title || brief.structured_brief?.project_title || 'Untitled Brief';
  addText(title, { size: 18, bold: true, color: [20, 20, 80] });
  y += 2;

  // Meta row
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Submitted: ${new Date(brief.created_at).toLocaleDateString()} | ` +
    `Department: ${brief.department ?? 'TBD'} | ` +
    `Priority: ${brief.priority.toUpperCase()} | ` +
    `Status: ${brief.status.replace(/_/g, ' ').toUpperCase()}`,
    margin, y
  );
  y += 10;

  // ── Submitter info ────────────────────────────────────────────
  addSection('Submitted By');
  addText(`Name: ${brief.submitter_name}`);
  addText(`Email: ${brief.submitter_email}`);
  if (brief.submitter_phone) addText(`Phone: ${brief.submitter_phone}`);

  // ── Summary ───────────────────────────────────────────────────
  if (brief.structured_brief?.summary) {
    addSection('Executive Summary');
    addText(brief.structured_brief.summary);
  }

  // ── Goals ─────────────────────────────────────────────────────
  const goals = brief.goals ?? brief.structured_brief?.goals ?? [];
  if (goals.length) {
    addSection('Project Goals');
    goals.forEach((g, i) => {
      checkNewPage();
      addText(`${i + 1}. ${g}`);
    });
  }

  // ── Deliverables ──────────────────────────────────────────────
  const deliverables = brief.structured_brief?.deliverables ?? [];
  if (deliverables.length) {
    addSection('Deliverables');
    deliverables.forEach((d, i) => {
      checkNewPage();
      addText(`${i + 1}. ${d}`);
    });
  }

  // ── Target audience ───────────────────────────────────────────
  if (brief.structured_brief?.target_audience) {
    addSection('Target Audience');
    addText(brief.structured_brief.target_audience);
  }

  // ── Ambiguities ───────────────────────────────────────────────
  const ambiguities = brief.ambiguities ?? brief.structured_brief?.ambiguities ?? [];
  if (ambiguities.length) {
    addSection('Open Questions / Ambiguities');
    doc.setTextColor(180, 100, 0);
    ambiguities.forEach((a, i) => {
      checkNewPage();
      addText(`⚠ ${i + 1}. ${a}`, { color: [180, 100, 0] });
    });
    doc.setTextColor(30, 30, 30);
  }

  // ── Timeline & budget ─────────────────────────────────────────
  if (brief.deadline || brief.structured_brief?.budget_range) {
    addSection('Timeline & Budget');
    if (brief.deadline) addText(`Deadline: ${new Date(brief.deadline).toLocaleDateString()}`);
    if (brief.structured_brief?.budget_range)
      addText(`Budget: ${brief.structured_brief.budget_range}`);
  }

  // ── Raw brief text ────────────────────────────────────────────
  if (brief.raw_text) {
    checkNewPage(40);
    addSection('Original Brief Text');
    addText(brief.raw_text, { size: 9.5, color: [80, 80, 80] });
  }

  // ── Attachments list ──────────────────────────────────────────
  if (assets.length) {
    addSection('Attachments');
    assets.forEach(a => {
      checkNewPage();
      addText(`• ${a.file_name} (${a.asset_type}, ${formatBytes(a.file_size ?? 0)})`, { size: 10 });
    });
  }

  // ── Manager approval ─────────────────────────────────────────
  if (brief.status === 'approved' || brief.status === 'rejected') {
    addSection('Manager Decision');
    addText(
      `Decision: ${brief.status.toUpperCase()}`,
      { bold: true, color: brief.status === 'approved' ? [0, 150, 0] : [200, 0, 0] }
    );
    if (brief.approved_by) addText(`By: ${brief.approved_by}`);
    if (brief.approved_at)
      addText(`At: ${new Date(brief.approved_at).toLocaleString()}`);
    if (brief.manager_notes) addText(`Notes: ${brief.manager_notes}`);
  }

  // ── Footer on every page ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Softworks Brief Assistant | Brief #${brief.id.substring(0, 8)} | Page ${i} of ${pageCount}`,
      margin, ph - 8
    );
  }

  // ── Upload to Supabase storage ────────────────────────────────
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const fileName = `briefs/${brief.id}/brief-${brief.id.substring(0, 8)}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('brief-pdfs')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`PDF upload failed: ${uploadError.message}`);
  }

  // Save the path back to the brief record
  await supabaseAdmin
    .from('briefs')
    .update({ pdf_path: fileName })
    .eq('id', brief.id);

  return fileName;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
