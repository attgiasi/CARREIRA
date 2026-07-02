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
    instance.ensureApplicationColumns();
    instance.save();
    return instance;
  }

  private ensureApplicationColumns(): void {
    const existing = new Set(this.query<{ name: string }>("PRAGMA table_info(applications)").map((column) => String(column.name)));
    const columns: Array<[string, string]> = [
      ["created_at", "TEXT"],
      ["updated_at", "TEXT"]
    ];
    for (const [name, definition] of columns) {
      if (!existing.has(name)) this.db.run(`ALTER TABLE applications ADD COLUMN ${name} ${definition}`);
    }
    this.db.run("UPDATE applications SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");
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

  insertJob(job: NormalizedJob): void {
    this.run(
      `INSERT OR IGNORE INTO jobs (
        external_id, title, company, location, source, url, description, salary, work_model,
        travel_required, driver_license_required, driver_license_categories, own_vehicle_required,
        education_required, education_level_detected, seniority_level, career_track, employment_type,
        schedule_type, fit_score, hire_chance_score, job_quality_score, risk_score, fit_reason,
        hire_chance_reason, risk_flags, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.externalId, job.title, job.company, job.location, job.source, job.url, job.description, job.salary,
        job.workModel, Number(job.travelRequired), Number(job.driverLicenseRequired), job.driverLicenseCategories.join(","),
        Number(job.ownVehicleRequired), job.educationRequired, job.educationLevelDetected, job.seniorityLevel,
        job.careerTrack, job.employmentType, job.scheduleType, job.fitScore, job.hireChanceScore,
        job.jobQualityScore, job.riskScore, job.fitReason, job.hireChanceReason, job.riskFlags.join("; "),
        job.status, JSON.stringify(job.raw)
      ]
    );
  }

  insertInformal(opportunity: InformalOpportunity): void {
    this.run(
      `INSERT INTO informal_opportunities (
        type, title, contractor_name, company, event_type, location, date, start_time, end_time,
        estimated_hours, total_pay, hourly_rate, payment_method, payment_delay_days, food_included,
        transport_included, requires_own_tools, requires_uniform, requires_driver_license, requires_own_vehicle,
        description, source, url, freela_score, risk_score, risk_flags, status, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opportunity.type, opportunity.title, opportunity.contractorName, opportunity.company, opportunity.eventType,
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
