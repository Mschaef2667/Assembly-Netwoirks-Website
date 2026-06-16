-- Remove the abandoned step_definition row for step 4.5 ("GTM Snapshot").
-- step 4.5 has no editor, no downstream consumers, and is not part of the
-- canonical C3 Method 38-step blueprint. step_output has no rows for '4.5'
-- (verified in production), so no data is being preserved.

delete from step_definition where id = '4.5';
