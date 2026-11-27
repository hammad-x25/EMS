import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ExamAnalyticsDto } from "@/lib/analytics";

function collectPdf(document: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

export async function generateCandidateReportPdf(input: {
  candidateName: string;
  candidateIdentifier: string;
  examTitle: string;
  attemptedAt: Date;
  totalScore: number;
  maxScore: number;
  passingMarks: number;
  verificationCode: string;
  verificationUrl: string;
  version: number;
  sections: Array<{ topic: string; earned: number; maximum: number }>;
}): Promise<Buffer> {
  const document = new PDFDocument({ size: "A4", margin: 52, info: { Title: `${input.examTitle} Score Report` } });
  const output = collectPdf(document);
  const qr = await QRCode.toBuffer(input.verificationUrl, { width: 150, margin: 1, errorCorrectionLevel: "M" });
  document.fillColor("#312e81").fontSize(10).text("AEGISEXAM · VERIFIED SCORE REPORT");
  document.fillColor("#0f172a").fontSize(24).text(input.examTitle, { width: 430 });
  document.moveDown(0.4).fontSize(11).fillColor("#475569").text(`Issued ${new Date().toLocaleString()} · Report version ${input.version}`);
  document.moveDown(1.5).fillColor("#0f172a").fontSize(13).text(`Candidate: ${input.candidateName}`);
  document.text(`Candidate ID: ${input.candidateIdentifier}`);
  document.text(`Attempt date: ${input.attemptedAt.toLocaleString()}`);
  document.moveDown(1.2);
  const passed = input.totalScore >= input.passingMarks;
  document.roundedRect(52, document.y, 490, 76, 8).fill(passed ? "#ecfdf5" : "#fff1f2");
  document.fillColor(passed ? "#047857" : "#be123c").fontSize(25).text(`${input.totalScore} / ${input.maxScore}`, 70, document.y + 18);
  document.fontSize(12).text(passed ? "PASS" : "NOT PASSED", 390, document.y - 22, { align: "right", width: 130 });
  document.y += 70;
  document.fillColor("#0f172a").fontSize(15).text("Section summary");
  document.moveDown(0.5);
  for (const section of input.sections) {
    document.fontSize(11).text(`${section.topic}: ${section.earned} / ${section.maximum}`);
  }
  document.moveDown(1.5).fontSize(15).text("Authenticity verification");
  document.image(qr, 52, document.y + 8, { width: 105 });
  document.fontSize(11).fillColor("#334155").text(`Verification ID: ${input.verificationCode}`, 175, document.y + 25);
  document.fontSize(9).text(input.verificationUrl, 175, document.y + 8, { width: 350 });
  document.moveDown(6).fontSize(8).fillColor("#64748b").text("This document contains no question text, candidate answers, email address, or monitoring records. Verify the QR code before relying on a printed copy.");
  document.end();
  return output;
}

export async function generateExamSummaryPdf(analytics: ExamAnalyticsDto): Promise<Buffer> {
  const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${analytics.title} Cohort Report` } });
  const output = collectPdf(document);
  document.fillColor("#312e81").fontSize(10).text("AEGISEXAM · EXAMINER COHORT SUMMARY");
  document.fillColor("#0f172a").fontSize(23).text(analytics.title);
  document.moveDown(0.5).fontSize(10).fillColor("#64748b").text(`Generated ${new Date().toLocaleString()}`);
  document.moveDown(1.5).fillColor("#0f172a").fontSize(12);
  document.text(`Submissions: ${analytics.submissionCount}`);
  document.text(`Mean / Median: ${analytics.mean} / ${analytics.median}`);
  document.text(`Minimum / Maximum: ${analytics.minimum} / ${analytics.maximum}`);
  document.text(`Pass rate: ${analytics.passRate}%`);
  document.moveDown(1.3).fontSize(15).text("Question difficulty and review signals");
  document.moveDown(0.6);
  for (const [index, question] of analytics.questions.entries()) {
    if (document.y > 720) document.addPage();
    document.fontSize(10).fillColor("#0f172a").text(`${index + 1}. ${question.prompt}`, { width: 500 });
    document.fontSize(9).fillColor("#475569").text(`p-value ${question.observedDifficultyIndex} · full correctness ${question.correctnessRate}% · skipped ${question.skipRate}%${question.flags.length ? ` · flags: ${question.flags.join(", ")}` : ""}`);
    document.moveDown(0.55);
  }
  document.end();
  return output;
}
