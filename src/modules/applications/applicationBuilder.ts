import { AgentSettings, NormalizedJob } from "../../types.js";
import { saveResumeMarkdown } from "../profile/resumeBuilder.js";
import { saveCoverLetter } from "./coverLetterGenerator.js";

export function buildApplicationPacket(jobId: number, job: NormalizedJob, settings: AgentSettings) {
  return {
    jobId,
    cvVersion: job.careerTrack,
    generatedResumePath: saveResumeMarkdown(job, settings),
    coverLetterPath: saveCoverLetter(job, settings),
    approvalStatus: "aguardando_aprovacao",
    notes: "Preparado em modo seguro; envio manual ou aprovação obrigatória."
  };
}
