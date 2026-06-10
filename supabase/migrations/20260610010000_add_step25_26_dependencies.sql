-- Migration: add step_dependency rows for Steps 25 and 26 so the context packet
-- includes the prerequisites the Copilot prompts read via stepText().
--
-- Step 25 (Competitive Opportunities):           pulls 8, 17, 18
-- Step 26 (Competitive Strengths and Weaknesses): pulls 14, 17, 20, 24

insert into step_dependency (step_id, prerequisite_step_id) values
  ('25', '8'),  ('25', '17'), ('25', '18'),
  ('26', '14'), ('26', '17'), ('26', '20'), ('26', '24')
on conflict do nothing;
