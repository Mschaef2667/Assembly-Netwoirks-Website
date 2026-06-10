-- Migration: add step_dependency rows for Step 24 so the context packet
-- includes the prerequisites the Copilot prompt reads via stepText().
--
-- Step 24 (Competitive Retaliation): pulls 17, 18, 20

insert into step_dependency (step_id, prerequisite_step_id) values
  ('24', '17'), ('24', '18'), ('24', '20')
on conflict do nothing;
