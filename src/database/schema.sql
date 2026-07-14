CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  settings_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  display_name TEXT,
  login_url TEXT,
  username TEXT,
  encrypted_secret TEXT,
  secret_label TEXT,
  status TEXT DEFAULT 'pendente',
  notes TEXT,
  last_login_at TEXT,
  last_sync_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_user_platform ON connected_accounts(user_id, platform);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
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
  user_id INTEGER DEFAULT 1,
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
  user_id INTEGER DEFAULT 1,
  job_id INTEGER,
  informal_opportunity_id INTEGER,
  user_profile_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT,
  last_attempt_at TEXT,
  application_status TEXT,
  automation_mode TEXT,
  retry_count INTEGER DEFAULT 0,
  cv_version TEXT,
  generated_resume_path TEXT,
  cover_letter_path TEXT,
  approval_status TEXT,
  sent_by_agent INTEGER DEFAULT 0,
  source_platform TEXT,
  availability_status TEXT DEFAULT 'nao_verificado',
  availability_checked_at TEXT,
  availability_last_ok_at TEXT,
  availability_closed_at TEXT,
  pipeline_stage INTEGER DEFAULT 1,
  pipeline_outcome TEXT DEFAULT 'sem_retorno',
  recruiter_status TEXT,
  last_recruiter_email_at TEXT,
  next_action TEXT,
  next_action_due_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  label TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  summary TEXT,
  resume_file TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS answer_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  user_profile_id INTEGER DEFAULT 1,
  question_key TEXT NOT NULL,
  question_text TEXT,
  answer_text TEXT,
  field_type TEXT DEFAULT 'text',
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  approved_by_user INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  UNIQUE(user_profile_id, question_key)
);

CREATE TABLE IF NOT EXISTS application_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  application_id INTEGER,
  user_profile_id INTEGER,
  mode TEXT,
  status TEXT,
  result_message TEXT,
  missing_questions_json TEXT,
  filled_fields_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS recruiter_email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  application_id INTEGER,
  job_id INTEGER,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  received_at TEXT,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  event_type TEXT,
  pipeline_stage INTEGER DEFAULT 1,
  outcome TEXT DEFAULT 'sem_retorno',
  requires_action INTEGER DEFAULT 0,
  action_summary TEXT,
  action_url TEXT,
  job_title TEXT,
  company TEXT,
  source_platform TEXT,
  confidence REAL DEFAULT 0,
  excerpt TEXT,
  raw_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_recruiter_events_user ON recruiter_email_events(user_id, received_at);
CREATE INDEX IF NOT EXISTS idx_recruiter_events_application ON recruiter_email_events(application_id);

CREATE TABLE IF NOT EXISTS gmail_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT,
  scanned_messages INTEGER DEFAULT 0,
  matched_messages INTEGER DEFAULT 0,
  inserted_events INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_gmail_sync_user ON gmail_sync_runs(user_id, started_at);

CREATE TABLE IF NOT EXISTS gmail_message_scan_cache (
  user_id INTEGER NOT NULL,
  gmail_message_id TEXT NOT NULL,
  event_type TEXT,
  matched_application_id INTEGER,
  scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_gmail_scan_cache_user ON gmail_message_scan_cache(user_id, scanned_at);

CREATE TABLE IF NOT EXISTS gmail_job_alert_sync_state (
  user_id INTEGER PRIMARY KEY,
  last_scan_at TEXT,
  messages_scanned INTEGER DEFAULT 0,
  jobs_found INTEGER DEFAULT 0,
  jobs_imported INTEGER DEFAULT 0
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
