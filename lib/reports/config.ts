// Shared report configuration — colors and types used by the PDF/Word
// generators across the dashboard. Later chunks plug into these constants
// so headers and footers stay visually consistent across reports.

export const NAVY = '#0A1628'
export const ORANGE = '#E8520A'
export const BLUE = '#0EA5E9'
export const GREY = '#6B7280'
export const FOOTER_TEXT = '#4B5563'

export interface ReportHeaderConfig {
  title: string
  company: string
  date: string
  logoUrl?: string | null
}

export interface ReportFooterConfig {
  company: string
  showPageNumbers?: boolean
  confidentialityNotice?: string
}
