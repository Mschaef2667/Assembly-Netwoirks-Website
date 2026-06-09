-- Migration: add step_dependency rows for Steps 20 and 21 so the context packet
-- includes the prerequisites the Copilot prompts read via stepText().
--
-- Step 20 (Competitive Threats):    pulls 17, 18, 19
-- Step 21 (Competitive Acid Test):  pulls 3, 14, 17, 20

insert into step_dependency (step_id, prerequisite_step_id) values
  ('20', '17'), ('20', '18'), ('20', '19'),
  ('21', '3'),  ('21', '14'), ('21', '17'), ('21', '20')
on conflict do nothing;
