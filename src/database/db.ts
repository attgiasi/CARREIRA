import fs from "node:fs";
import path from "node:path";
import initSqlJs, { Database } from "sql.js";
import { NormalizedJob, InformalOpportunity } from "../types.js";
import { secrets } from "../config/secrets.js";

const schemaPath = path.resolve(process.cwd(), "src/database/schema.sql");

function resolveDatabasePath(): string {
  const rawUrl = secrets.databaseUrl || "file:./data/jobs.sqlite";
  const withoutProtocol = rawUrl.startsWith("file:")
    ? rawUrl.slice("file:".length)
    : rawUrl.startsWith("sqlite://")
      ? rawUrl.slice("sqlite://".length)
      : rawUrl;
  return path.isAbsolute(withoutProtocol) ? withoutProtocol : path.resolve(process.cwd(), withoutProtocol);
}

export class CareerDatabase {
  private constructor(private readonly db: Database) {}

  static async open(): Promise<CareerDatabase> {
    const dbPath = resolveDatabasePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const SQL = await initSqlJs({
      locateFile: (file) => path.resolve(process.cwd(), "node_modules/sql.js/dist", file)
    });
    const data = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
    const db = new SQL.Database(data);
    db.run(fs.readFileSync(schemaPath, "utf8"));
    const instance = new CareerDatabase(db);
    instance.ensureRuntimeColumns();
    instance.save();
    return instance;
  }

  private ensureColumns(table: string, columns: Array<[string, string]>): void {
    const existing = new Set(this.query<{ name: string }>(`PRAGMA table_info(${table})`).map((column) => String(column.name)));
    for (const [name, definition] of columns) {
      if (!existing.has(name)) this.db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }

  private ensureRuntimeColumns(): void {
    this.ensureColumns("jobs", [["user_id", "INTEGER DEFAULT 1"]]);
    this.ensureColumns("informal_opportunities", [["user_id", "INTEGER DEFAULT 1"]]);
    this.ensureColumns("candidate_profiles", [["user_id", "INTEGER DEFAULT 1"]]);
    this.ensureColumns("answer_memory", [["user_id", "INTEGER DEFAULT 1"]]);
    this.ensureColumns("application_attempts", [["user_id", "INTEGER DEFAULT 1"]]);
    this.db.run(`
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
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_accounts(user_id)");
    this.db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_user_platform ON connected_accounts(user_id, platform)");
    this.ensureColumns("applications", [
      ["user_id", "INTEGER DEFAULT 1"],
      ["created_at", "TEXT"],
      ["updated_at", "TEXT"],
      ["user_profile_id", "INTEGER"],
      ["last_attempt_at", "TEXT"],
      ["automation_mode", "TEXT"],
      ["retry_count", "INTEGER DEFAULT 0"],
      ["availability_status", "TEXT DEFAULT 'nao_verificado'"],
      ["availability_checked_at", "TEXT"],
      ["availability_last_ok_at", "TEXT"],
      ["availability_closed_at", "TEXT"],
      ["pipeline_stage", "INTEGER DEFAULT 1"],
      ["pipeline_outcome", "TEXT DEFAULT 'sem_retorno'"],
      ["authorization_status", "TEXT DEFAULT 'aguardando_autorizacao'"],
      ["authorized_at", "TEXT"],
      ["recruiter_status", "TEXT"],
      ["last_recruiter_email_at", "TEXT"],
      ["next_action", "TEXT"],
      ["next_action_due_at", "TEXT"]
    ]);
    this.db.run("UPDATE applications SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");
    this.db.run("UPDATE applications SET pipeline_stage = COALESCE(pipeline_stage, 1), pipeline_outcome = COALESCE(pipeline_outcome, 'sem_retorno')");
    this.db.run(`
      UPDATE applications
      SET authorization_status = CASE
        WHEN sent_by_agent = 1 OR applied_at IS NOT NULL THEN 'concluida'
        WHEN COALESCE(automation_mode, '') <> '' THEN 'autorizada'
        ELSE 'aguardando_autorizacao'
      END
      WHERE authorization_status IS NULL OR trim(authorization_status) = ''
    `);
    this.db.run(`
      UPDATE applications
      SET authorization_status = 'concluida'
      WHERE sent_by_agent = 1 OR applied_at IS NOT NULL
    `);
    this.db.run(`
      UPDATE applications
      SET authorization_status = 'acao_necessaria'
      WHERE sent_by_agent = 0 AND applied_at IS NULL
        AND trim(COALESCE(next_action, '')) <> ''
    `);
    this.db.run(`
      UPDATE applications
      SET authorization_status = 'requer_canal'
      WHERE sent_by_agent = 0 AND applied_at IS NULL
        AND trim(COALESCE(next_action, '')) = ''
        AND application_status IN (
          'Aguardando vaga real da fonte',
          'Aguardando canal de candidatura',
          'LinkedIn manual',
          'Sem canal de candidatura visível no Indeed'
        )
    `);
    this.db.run("UPDATE jobs SET user_id = COALESCE(user_id, 1)");
    this.db.run("UPDATE informal_opportunities SET user_id = COALESCE(user_id, 1)");
    this.db.run("UPDATE candidate_profiles SET user_id = COALESCE(user_id, 1)");
    this.db.run("UPDATE answer_memory SET user_id = COALESCE(user_id, 1)");
    this.db.run("UPDATE application_attempts SET user_id = COALESCE(user_id, 1)");
    this.db.run("UPDATE applications SET user_id = COALESCE(user_id, 1)");
    this.db.run("DROP INDEX IF EXISTS idx_jobs_unique_source_external");
    this.db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_unique_user_source_external ON jobs(user_id, source, external_id)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id)");
  }

  save(): void {
    const dbPath = resolveDatabasePath();
    fs.writeFileSync(dbPath, Buffer.from(this.db.export()));
  }

  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params);
    this.save();
  }

  query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const result = this.db.exec(sql, params)[0];
    if (!result) return [];
    return result.values.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]]))) as T[];
  }

  insertJob(job: NormalizedJob, userId = 1): void {
    this.run(
      `INSERT OR IGNORE INTO jobs (
        user_id, external_id, title, company, location, source, url, description, salary, work_model,
        travel_required, driver_license_required, driver_license_categories, own_vehicle_required,
        education_required, education_level_detected, seniority_level, career_track, employment_type,
        schedule_type, fit_score, hire_chance_score, job_quality_score, risk_score, fit_reason,
        hire_chance_reason, risk_flags, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, job.externalId, job.title, job.company, job.location, job.source, job.url, job.description, job.salary,
        job.workModel, Number(job.travelRequired), Number(job.driverLicenseRequired), job.driverLicenseCategories.join(","),
        Number(job.ownVehicleRequired), job.educationRequired, job.educationLevelDetected, job.seniorityLevel,
        job.careerTrack, job.employmentType, job.scheduleType, job.fitScore, job.hireChanceScore,
        job.jobQualityScore, job.riskScore, job.fitReason, job.hireChanceReason, job.riskFlags.join("; "),
        job.status, JSON.stringify(job.raw)
      ]
    );
  }

  insertInformal(opportunity: InformalOpportunity, userId = 1): void {
    this.run(
      `INSERT INTO informal_opportunities (
        user_id, type, title, contractor_name, company, event_type, location, date, start_time, end_time,
        estimated_hours, total_pay, hourly_rate, payment_method, payment_delay_days, food_included,
        transport_included, requires_own_tools, requires_uniform, requires_driver_license, requires_own_vehicle,
        description, source, url, freela_score, risk_score, risk_flags, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, opportunity.type, opportunity.title, opportunity.contractorName, opportunity.company, opportunity.eventType,
        opportunity.location, opportunity.date, opportunity.startTime, opportunity.endTime, opportunity.estimatedHours,
        opportunity.totalPay, opportunity.hourlyRate, opportunity.paymentMethod, opportunity.paymentDelayDays,
        Number(opportunity.foodIncluded), Number(opportunity.transportIncluded), Number(opportunity.requiresOwnTools),
        Number(opportunity.requiresUniform), Number(opportunity.requiresDriverLicense), Number(opportunity.requiresOwnVehicle),
        opportunity.description, opportunity.source, opportunity.url, opportunity.freelaScore, opportunity.riskScore,
        opportunity.riskFlags.join("; "), opportunity.status, JSON.stringify(opportunity.raw)
      ]
    );
  }
}
