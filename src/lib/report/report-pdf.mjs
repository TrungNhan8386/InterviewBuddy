// PDF file of an interview report (UC-14 Export report as PDF, SCRUM-225).
// Input: the ReportResponse of GET /api/report/{sessionId}; output: PDF bytes.
// Pure function (the font bytes are passed in), so it is unit-tested without a server.
// The font is Geist (the app's own font, SIL Open Font License), which has every
// Vietnamese letter. W9: layout polish and the Export button on the Report page (Tài).
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

const A4 = [595.28, 841.89];
const MARGIN = 48;
const WIDTH = A4[0] - MARGIN * 2;
const INK = rgb(0.11, 0.13, 0.17);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.15, 0.39, 0.92);
const TRACK = rgb(0.9, 0.92, 0.95);
const RULE = rgb(0.85, 0.87, 0.9);

const LABELS = {
  vi: {
    title: 'Báo cáo phỏng vấn', app: 'InterviewBuddy',
    type: { behavioral: 'Hành vi', technical: 'Kỹ thuật', mixed: 'Kết hợp' },
    difficulty: { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' },
    position: 'Vị trí', date: 'Ngày', duration: 'Thời lượng', minutes: 'phút',
    overall: 'Điểm tổng', trend: 'So với lần trước', firstSession: 'Lần đầu, chưa có để so sánh',
    questions: (m, f) => `${m} câu hỏi chính, ${f} câu hỏi phụ`,
    criteria: 'Điểm theo tiêu chí',
    names: { content: 'Nội dung', structure: 'Cấu trúc STAR', clarity: 'Rõ ràng', confidence: 'Tự tin (ước lượng từ văn bản)' },
    starHidden: 'STAR chỉ áp dụng cho phỏng vấn hành vi nên không tính.',
    speaking: 'Chỉ số nói', fillers: 'Từ đệm', per100: 'trên 100 từ', avgWords: 'Độ dài trả lời trung bình', words: 'từ',
    pace: 'Tốc độ nói', wpm: 'từ/phút', paceNA: 'Không có (câu trả lời được gõ phím)',
    summary: 'Nhận xét chung', strengths: 'Điểm mạnh', improvements: 'Cần cải thiện',
    summaryNA: 'Chưa có nhận xét của AI cho buổi này. Mở báo cáo và bấm "Thử lại" rồi xuất PDF lại.',
    timeline: 'Diễn biến buổi phỏng vấn', followUp: 'Câu hỏi phụ', notAnswered: 'Chưa trả lời', score: 'Điểm',
    disclaimer: 'Kết quả chỉ để luyện tập và có thể chưa chính xác. Điểm Tự tin được ước lượng từ văn bản.',
    page: (n, total) => `Trang ${n}/${total}`, generated: 'Tạo lúc',
  },
  en: {
    title: 'Interview report', app: 'InterviewBuddy',
    type: { behavioral: 'Behavioral', technical: 'Technical', mixed: 'Mixed' },
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    position: 'Position', date: 'Date', duration: 'Duration', minutes: 'min',
    overall: 'Overall score', trend: 'Change from last time', firstSession: 'First session, nothing to compare',
    questions: (m, f) => `${m} main question${m === 1 ? '' : 's'}, ${f} follow-up${f === 1 ? '' : 's'}`,
    criteria: 'Scores by criterion',
    names: { content: 'Content', structure: 'STAR structure', clarity: 'Clarity', confidence: 'Confidence (estimated from text)' },
    starHidden: 'STAR applies to behavioral interviews only, so it is not counted.',
    speaking: 'Speaking indicators', fillers: 'Filler words', per100: 'per 100 words', avgWords: 'Average answer length', words: 'words',
    pace: 'Speaking pace', wpm: 'words/min', paceNA: 'Not available for typed answers',
    summary: 'Summary', strengths: 'Strengths', improvements: 'Areas to improve',
    summaryNA: 'The AI summary is not available for this session. Open the report, press "Try again", then export again.',
    timeline: 'Interview timeline', followUp: 'Follow-up', notAnswered: 'Not answered', score: 'Score',
    disclaimer: 'Practice guidance only; scores may be wrong. Confidence is estimated from the text.',
    page: (n, total) => `Page ${n}/${total}`, generated: 'Generated',
  },
};

const pad = (n) => String(n).padStart(2, '0');
function clock(seconds) {
  if (seconds == null) return '–';
  const s = Math.max(0, Math.round(seconds));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
function dateText(iso) {
  if (!iso) return '–';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
const score = (value) => (value == null ? '–' : Number(value).toFixed(1).replace(/\.0$/, ''));

/** File name for the Content-Disposition header, e.g. interviewbuddy-report-2026-11-24.pdf */
export function reportPdfFileName(report) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(report.overview?.endedAt ?? report.generatedAt ?? Date.now()));
  return `interviewbuddy-report-${day}.pdf`;
}

export async function renderReportPdf(report, { fontBytes, now = () => new Date() }) {
  const t = LABELS[report.settings?.language] ?? LABELS.en;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const glyphs = fontkit.create(fontBytes);
  // Characters the font cannot draw (emoji, other scripts) become "?" instead of failing.
  const clean = (text) => [...String(text ?? '').replace(/\s+/gu, ' ').trim()]
    .map((ch) => (glyphs.hasGlyphForCodePoint(ch.codePointAt(0)) ? ch : '?')).join('');

  doc.setTitle(`${t.app} – ${t.title}`);
  doc.setAuthor(t.app);
  doc.setCreator(t.app);
  doc.setProducer(t.app);
  doc.setCreationDate(now());

  let page;
  let y;
  const newPage = () => { page = doc.addPage(A4); y = A4[1] - MARGIN; };
  const ensure = (height) => { if (y - height < MARGIN + 24) newPage(); };
  const wrap = (text, size, width = WIDTH) => {
    const lines = [];
    let line = '';
    for (const word of clean(text).split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else { lines.push(line); line = word; }
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (value, { x = MARGIN, size = 10, color = INK, width = WIDTH, gap = 1.35 } = {}) => {
    for (const line of wrap(value, size, width - (x - MARGIN))) {
      ensure(size * gap);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size * gap;
    }
  };
  const heading = (value) => {
    ensure(44);
    y -= 14;
    page.drawText(clean(value), { x: MARGIN, y: y - 13, size: 13, font, color: ACCENT });
    y -= 20;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 0.6, color: RULE });
    y -= 8;
  };
  const bullets = (items) => {
    for (const item of items) {
      ensure(14);
      page.drawText('•', { x: MARGIN + 4, y: y - 10, size: 10, font, color: ACCENT });
      text(item, { x: MARGIN + 16 });
      y -= 2;
    }
  };

  newPage();
  // Header
  page.drawText(t.app, { x: MARGIN, y: y - 10, size: 10, font, color: ACCENT });
  y -= 16;
  page.drawText(clean(t.title), { x: MARGIN, y: y - 22, size: 22, font, color: INK });
  y -= 32;
  const s = report.settings ?? {};
  const facts = [
    `${t.type[s.type] ?? s.type ?? '–'} · ${t.difficulty[s.difficulty] ?? s.difficulty ?? '–'}`,
    s.targetPosition ? `${t.position}: ${s.targetPosition}` : null,
    `${t.date}: ${dateText(report.overview?.startedAt)}`,
    `${t.duration}: ${clock(report.overview?.durationSeconds)} (${s.durationMinutes ?? '–'} ${t.minutes})`,
  ].filter(Boolean).join('   |   ');
  text(facts, { size: 9.5, color: MUTED });

  // Overview
  const o = report.overview ?? {};
  y -= 10;
  ensure(60);
  page.drawText(`${score(o.overallScore)}`, { x: MARGIN, y: y - 36, size: 36, font, color: ACCENT });
  const big = font.widthOfTextAtSize(`${score(o.overallScore)}`, 36);
  page.drawText('/10', { x: MARGIN + big + 4, y: y - 36, size: 14, font, color: MUTED });
  const col = MARGIN + 150;
  page.drawText(clean(t.overall), { x: col, y: y - 12, size: 10, font, color: MUTED });
  const trend = o.trend
    ? `${t.trend}: ${o.trend.change > 0 ? '+' : ''}${score(o.trend.change)} (${score(o.trend.previousOverallScore)} → ${score(o.overallScore)})`
    : `${t.trend}: – (${t.firstSession})`;
  page.drawText(clean(trend), { x: col, y: y - 27, size: 10, font, color: INK });
  page.drawText(clean(t.questions(o.mainQuestions ?? 0, o.followUps ?? 0)), { x: col, y: y - 41, size: 10, font, color: INK });
  y -= 52;

  // Criteria bars
  heading(t.criteria);
  const criteria = report.criteria ?? {};
  for (const key of ['content', 'structure', 'clarity', 'confidence']) {
    if (key === 'structure' && !report.structureApplies) continue;
    ensure(20);
    const value = criteria[key];
    page.drawText(clean(t.names[key]), { x: MARGIN, y: y - 10, size: 10, font, color: INK });
    const barX = MARGIN + 210;
    const barW = WIDTH - 210 - 40;
    page.drawRectangle({ x: barX, y: y - 11, width: barW, height: 9, color: TRACK });
    if (value != null) page.drawRectangle({ x: barX, y: y - 11, width: barW * Math.min(1, Math.max(0, value / 10)), height: 9, color: ACCENT });
    page.drawText(score(value), { x: barX + barW + 10, y: y - 10, size: 10, font, color: INK });
    y -= 20;
  }
  if (!report.structureApplies) text(t.starHidden, { size: 9, color: MUTED });

  // Speaking indicators
  heading(t.speaking);
  const sp = report.speaking ?? {};
  const top = (sp.fillerWords?.top ?? []).map((f) => `“${f.word}” ×${f.count}`).join(', ');
  text(`${t.fillers}: ${sp.fillerWords?.total ?? 0} (${score(sp.fillerWords?.per100Words ?? 0)} ${t.per100})${top ? ` – ${top}` : ''}`);
  text(`${t.avgWords}: ${sp.avgAnswerWords ?? 0} ${t.words}`);
  text(`${t.pace}: ${sp.paceAvailable && sp.wordsPerMinute != null ? `${sp.wordsPerMinute} ${t.wpm}` : t.paceNA}`);

  // AI summary
  heading(t.summary);
  const sum = report.summary ?? {};
  if (sum.status === 'ready') {
    text(sum.text);
    y -= 4;
    text(t.strengths, { size: 10.5, color: ACCENT });
    bullets(sum.strengths ?? []);
    y -= 2;
    text(t.improvements, { size: 10.5, color: ACCENT });
    bullets(sum.improvements ?? []);
  } else {
    text(t.summaryNA, { color: MUTED });
  }

  // Timeline
  heading(t.timeline);
  for (const item of report.timeline ?? []) {
    const indent = item.kind === 'follow_up' ? 18 : 0;
    const label = `${item.kind === 'follow_up' ? `${t.followUp} · ` : ''}${clock(item.offsetSeconds)}`;
    const right = item.answered ? (item.score == null ? '–' : `${t.score} ${score(item.score)}`) : t.notAnswered;
    const lines = wrap(`${item.position}. ${item.question}`, 10, WIDTH - indent - 90);
    ensure(14 + lines.length * 13.5);
    page.drawText(clean(label), { x: MARGIN + indent, y: y - 9, size: 8.5, font, color: MUTED });
    page.drawText(clean(right), { x: MARGIN + WIDTH - font.widthOfTextAtSize(clean(right), 10), y: y - 9, size: 10, font, color: item.answered ? INK : MUTED });
    y -= 13;
    for (const line of lines) {
      page.drawText(line, { x: MARGIN + indent, y: y - 10, size: 10, font, color: INK });
      y -= 13.5;
    }
    y -= 5;
  }

  // Footer on every page
  const pages = doc.getPages();
  const disclaimer = wrap(t.disclaimer, 7.5)[0];
  const generated = clean(`${t.app} · ${t.generated}: ${dateText(report.generatedAt)}`);
  pages.forEach((p, i) => {
    p.drawText(disclaimer, { x: MARGIN, y: 34, size: 7.5, font, color: MUTED });
    p.drawText(generated, { x: MARGIN, y: 23, size: 7.5, font, color: MUTED });
    const label = t.page(i + 1, pages.length);
    p.drawText(label, { x: MARGIN + WIDTH - font.widthOfTextAtSize(label, 7.5), y: 23, size: 7.5, font, color: MUTED });
  });

  return doc.save();
}
