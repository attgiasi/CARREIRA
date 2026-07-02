CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  source TEXT,
  url TEXT,
  description TEXT,
  salary TEXT,
  work_model TEXT,
  travel_required INTEGER DEFAULT 0,
  driver_license_required INTEGER DEFAULT 0,
  driver_license_categories TEXT,
  own_vehicle_required INTEGER DEFAULT 0,
  education_required TEXT,
  education_level_detected TEXT,
  seniority_level TEXT,
  career_track TEXT,
  employment_type TEXT,
  schedule_type TEXT,
  found_at TEXT DEFAULT CURRENT_TIMESTAMP,
  fit_score INTEGER DEFAULT 0,
  hire_chance_score INTEGER DEFAULT 0,
  job_quality_score INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  fit_reason TEXT,
  hire_chance_reason TEXT,
  risk_flags TEXT,
  status TEXT DEFAULT 'Encontrada',
  raw_json TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_source_external ON jobs(source, external_id);
CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(fit_score, risk_score);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS informal_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  title TEXT,
  contractor_name TEXT,
  company TEXT,
  event_type TEXT,
  location TEXT,
  date TEXT,
  start_time TEXT,
  end_time TEXT,
  estimated_hours REAL,
  total_pay REAL,
  hourly_rate REAL,
  payment_method TEXT,
  payment_delay_days INTEGER,
  food_included INTEGER,
  transport_included INTEGER,
  requires_own_tools INTEGER,
  requires_uniform INTEGER,
  requires_driver_license INTEGER,
  requires_own_vehicle INTEGER,
  description TEXT,
  source TEXT,
  url TEXT,
  freela_score INTEGER,
  risk_score INTEGER,
  risk_flags TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,
  informal_opportunity_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  application_status TEXT,
  cv_version TEXT,
  generated_resume_path TEXT,
  cover_letter_path TEXT,
  approval_status TEXT,
  sent_by_agent INTEGER DEFAULT 0,
  source_platform TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  website TEXT,
  sector TEXT,
  city TEXT,
  state TEXT,
  target_category TEXT,
  reputation_notes TEXT,
  blacklist_status TEXT,
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  company TEXT,
  source TEXT,
  last_contact TEXT,
  relationship_status TEXT
);

CREATE TABLE IF NOT EXISTS approved_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_key TEXT,
  question_text TEXT,
  answer_text TEXT,
  track TEXT,
  last_used_at TEXT,
  approved_by_user INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  company TEXT,
  job_title TEXT,
  interview_datetime TEXT,
  location_or_link TEXT,
  status TEXT,
  prep_path TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT,
  module TEXT,
  action TEXT,
  result TEXT,
  risk_level TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  jobs_found INTEGER,
  jobs_gold INTEGER,
  jobs_prepared INTEGER,
  applications_sent INTEGER,
  recruiter_replies INTEGER,
  interviews INTEGER,
  informal_opportunities_found INTEGER,
  informal_opportunities_approved INTEGER,
  informal_potential_income REAL,
  response_rate REAL
);
