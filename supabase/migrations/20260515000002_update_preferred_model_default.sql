-- Update preferred_model column default and existing rows to use correct model string
alter table organizations
  alter column preferred_model set default 'claude-sonnet-4-5';

update organizations
  set preferred_model = 'claude-sonnet-4-5'
  where preferred_model = 'claude-sonnet-4-20250514';

update organizations
  set preferred_model = 'claude-opus-4-5'
  where preferred_model = 'claude-opus-4-20250514';
