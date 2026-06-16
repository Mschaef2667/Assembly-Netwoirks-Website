-- Rename three step_definition titles:
--   Step 16: "Acid Test"             -> "Acid Test 1"
--   Step 21: "Acid Test"             -> "Acid Test 2"
--   Step 38: "Opportunity Evaluation"-> "Generate Plans"
-- IDs, phases, and sections are unchanged.

UPDATE step_definition SET title = 'Acid Test 1'   WHERE id = '16';
UPDATE step_definition SET title = 'Acid Test 2'   WHERE id = '21';
UPDATE step_definition SET title = 'Generate Plans' WHERE id = '38';
