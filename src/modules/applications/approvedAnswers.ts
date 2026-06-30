import { CareerDatabase } from "../../database/db.js";

export async function saveApprovedAnswer(questionKey: string, questionText: string, answerText: string, track: string): Promise<void> {
  const db = await CareerDatabase.open();
  db.run(
    "INSERT INTO approved_answers (question_key, question_text, answer_text, track, last_used_at, approved_by_user) VALUES (?, ?, ?, ?, ?, 1)",
    [questionKey, questionText, answerText, track, new Date().toISOString()]
  );
}
