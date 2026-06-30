import { CareerDatabase } from "../../database/db.js";
export async function enqueueApplication(packet) {
    const db = await CareerDatabase.open();
    db.run("INSERT INTO applications (job_id, application_status, cv_version, generated_resume_path, cover_letter_path, approval_status, sent_by_agent, notes) VALUES (?, ?, ?, ?, ?, ?, 0, ?)", [packet.jobId, "Aguardando aprovação", packet.cvVersion, packet.generatedResumePath, packet.coverLetterPath, packet.approvalStatus, packet.notes]);
}
