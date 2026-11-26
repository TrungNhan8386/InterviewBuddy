import type { ReportResponse } from './report-service.mjs';

/** File name for the download, e.g. interviewbuddy-report-2026-11-24.pdf */
export function reportPdfFileName(report: Pick<ReportResponse, 'overview' | 'generatedAt'>): string;
/** PDF bytes of a report (UC-14). fontBytes: a TTF with Vietnamese letters (assets/fonts/Geist-Regular.ttf). */
export function renderReportPdf(report: ReportResponse, options: { fontBytes: Uint8Array; now?: () => Date }): Promise<Uint8Array>;
