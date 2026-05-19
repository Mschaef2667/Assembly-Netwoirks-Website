-- Rename the "Action Plan" section to "Strategic Plan" across all step_definition rows.
UPDATE step_definition
SET section = 'Strategic Plan'
WHERE section = 'Action Plan';
