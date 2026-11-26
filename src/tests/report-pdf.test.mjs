import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PDFParse } from 'pdf-parse';
import { renderReportPdf, reportPdfFileName } from '../lib/report/report-pdf.mjs';

const fontBytes = readFileSync(new URL('../assets/fonts/Geist-Regular.ttf', import.meta.url));
const sample = JSON.parse(readFileSync(new URL('../../docs/api/examples/report.response.json', import.meta.url), 'utf8'));

async function textOf(bytes) {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return { text: result.text, pages: result.total };
  } finally {
    await parser.destroy();
  }
}

test('Vietnamese report: every section, Vietnamese letters, STAR hidden for a technical interview', async () => {
  const bytes = await renderReportPdf(sample, { fontBytes });
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
  const { text, pages } = await textOf(bytes);
  assert.equal(pages, 1);
  for (const expected of ['Báo cáo phỏng vấn', 'Kỹ thuật · Trung bình', 'Điểm theo tiêu chí', 'Nội dung', 'Tự tin (ước lượng từ văn bản)',
    'Chỉ số nói', '“kiểu như” ×1', 'Tốc độ nói: 75 từ/phút', 'Điểm mạnh', 'Cần cải thiện', sample.summary.strengths[0],
    'Diễn biến buổi phỏng vấn', 'Câu hỏi phụ · 00:01', 'Chưa trả lời', 'Bạn kiểm thử component thế nào?', 'Trang 1/1']) {
    assert.ok(text.includes(expected), `missing "${expected}"`);
  }
  assert.ok(!text.includes('Cấu trúc STAR'), 'STAR must be hidden when it does not apply');
  assert.ok(text.includes('STAR chỉ áp dụng cho phỏng vấn hành vi'));
});

test('English report: STAR shown, first session, summary unavailable, long timeline over several pages', async () => {
  const report = {
    ...sample,
    settings: { ...sample.settings, language: 'en', type: 'behavioral' },
    structureApplies: true,
    criteria: { ...sample.criteria, structure: 5 },
    overview: { ...sample.overview, trend: null },
    speaking: { ...sample.speaking, paceAvailable: false, wordsPerMinute: null },
    summary: { status: 'unavailable', errorCode: 'AI_TIMEOUT', text: null, strengths: [], improvements: [] },
    timeline: Array.from({ length: 40 }, (_, i) => ({ ...sample.timeline[i % sample.timeline.length], position: i + 1,
      question: i === 0 ? 'Emoji 😀 and Chinese 你好 cannot be drawn by the font' : sample.timeline[i % sample.timeline.length].question })),
  };
  const { text, pages } = await textOf(await renderReportPdf(report, { fontBytes }));
  assert.ok(pages >= 2);
  for (const expected of ['Interview report', 'Behavioral · Medium', 'STAR structure', 'First session, nothing to compare',
    'Not available for typed answers', 'The AI summary is not available', 'Emoji ? and Chinese ?? cannot', `Page ${pages}/${pages}`]) {
    assert.ok(text.includes(expected), `missing "${expected}"`);
  }
  assert.ok(!text.includes('Strengths'));
});

test('download file name uses the interview day in Vietnam time', () => {
  assert.equal(reportPdfFileName({ overview: { endedAt: '2026-11-24T18:30:00Z' }, generatedAt: '2026-11-25T00:00:00Z' }), 'interviewbuddy-report-2026-11-25.pdf');
});
