-- step_definition: canonical list of all C3 Method steps (system-wide, not org-scoped)

create table if not exists step_definition (
  id          text primary key,
  title       text not null,
  description text,
  section     text,
  phase       int
);

-- RLS: any authenticated user may read step definitions.
-- step_definition has no org column; we gate on auth.uid() existing in users.

alter table step_definition enable row level security;

drop policy if exists "step_definition_select_authenticated" on step_definition;
create policy "step_definition_select_authenticated"
  on step_definition for select
  using (
    exists (select 1 from users where id = auth.uid())
  );

-- Seed: all 39 rows (steps 1–38 plus 3.5) from the canonical dependency map

insert into step_definition (id, title, section, phase) values
  ('1',   'Product/Service Profile',          'Company Foundation',      1),
  ('2',   'Top Three Target Market Segments', 'Company Foundation',      1),
  ('3',   'Key Decision Makers Per Segment',  'Company Foundation',      1),
  ('3.5', 'Buying Center Evaluation',         'Company Foundation',      1),
  ('4',   'The Problem',                      'Endemic Problems',         2),
  ('5',   'The Cause',                        'Endemic Problems',         2),
  ('6',   'The Effect',                       'Endemic Problems',         2),
  ('7',   'The Realization',                  'Endemic Problems',         2),
  ('8',   'The Solution',                     'Endemic Problems',         2),
  ('9',   'The Search',                       'Endemic Problems',         2),
  ('10',  'The Promise',                      'Company Formulas',         3),
  ('11',  'Compelling Value Propositions',    'Company Formulas',         3),
  ('12',  'Critical Success Factors',         'Company Formulas',         3),
  ('13',  'Critical Success Formulas',        'Company Formulas',         3),
  ('14',  'Core Competencies',               'Company Formulas',         3),
  ('15',  'Key Selling Points',              'Company Formulas',         3),
  ('16',  'Acid Test',                       'Company Formulas',         3),
  ('17',  'Target Competition',              'Competitive Environments', 4),
  ('18',  'Competitive Differentiators',     'Competitive Environments', 4),
  ('19',  'Competitive Advantages',          'Competitive Environments', 4),
  ('20',  'Competitive Threats',             'Competitive Environments', 4),
  ('21',  'Acid Test',                       'Competitive Environments', 4),
  ('22',  'Competitive Evaluation',          'Competitive Environments', 4),
  ('23',  'Decision Process',               'Competitive Environments', 4),
  ('24',  'Competitive Retaliation',         'Competitive Environments', 4),
  ('25',  'Competitive Opportunities',       'Competitive Environments', 4),
  ('26',  'Competitive Strength/Weaknesses', 'Competitive Environments', 4),
  ('27',  'The Set-Up',                      'Strategic Messages',       5),
  ('28',  'The Jab',                         'Strategic Messages',       5),
  ('29',  'Knock-Out',                       'Strategic Messages',       5),
  ('30',  'Clean-Up',                        'Strategic Messages',       5),
  ('31',  'Create Opportunities',            'Action Plan',              6),
  ('32',  'Get Into Position',               'Action Plan',              6),
  ('33',  'Grow Support',                    'Action Plan',              6),
  ('34',  'Close The Sale',                  'Action Plan',              6),
  ('35',  'Pat Them On The Back',            'Action Plan',              6),
  ('36',  'Retrench',                        'Action Plan',              6),
  ('37',  'Resources and Tools',             'Action Plan',              6),
  ('38',  'Opportunity Evaluation',          'Action Plan',              6)
on conflict (id) do nothing;
