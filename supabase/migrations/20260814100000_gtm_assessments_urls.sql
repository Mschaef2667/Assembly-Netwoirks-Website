-- GTM Gap Report: capture the company website and (optional) competitor URLs so
-- the report generator can research the real pages, not just the self-report.

alter table gtm_assessments
  add column if not exists company_website text,
  add column if not exists competitor_urls text;
