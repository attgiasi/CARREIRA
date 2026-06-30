import { CareerDatabase } from "../../database/db.js";
export async function collectMetrics() {
    const db = await CareerDatabase.open();
    const jobs = db.query("SELECT COUNT(*) as total FROM jobs")[0]?.total ?? 0;
    const gold = db.query("SELECT COUNT(*) as total FROM jobs WHERE status = 'Vaga Ouro'")[0]?.total ?? 0;
    const prepared = db.query("SELECT COUNT(*) as total FROM applications")[0]?.total ?? 0;
    const informal = db.query("SELECT COUNT(*) as total FROM informal_opportunities")[0]?.total ?? 0;
    return { jobs, gold, prepared, informal };
}
