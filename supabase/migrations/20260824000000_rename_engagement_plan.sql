-- Rename the Phase 6 section to "Engagement Plan".
-- History: originally seeded as "Action Plan", renamed to "Strategic Plan" in
-- 20260519000000_rename_action_plan_section.sql. Now standardized to "Engagement Plan"
-- so the term "Action Plan" is reserved for the future Idea Filter implementation roadmap.
UPDATE step_definition
SET section = 'Engagement Plan'
WHERE section IN ('Action Plan', 'Strategic Plan');
