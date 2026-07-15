import { AgentSettings, NormalizedJob } from "../../types.js";
import { chooseBaseCv } from "../profile/cvManager.js";
import { saveCoverLetter } from "./coverLetterGenerator.js";

export function buildApplicationPacket(jobId: number, job: NormalizedJob, settings: AgentSettings, originalResumeFile = "") {
  const resumeFile = originalResumeFile.trim() || chooseBaseCv(job);
  return {
    jobId,
    cvVersion: job.careerTrack,
    generatedResumePath: resumeFile,
    coverLetterPath: saveCoverLetter(job, settings),
    approvalStatus: "aguardando_aprovacao",
    notes: "Preparado com o currículo original do perfil; textos auxiliares não podem ampliar experiências, cargos ou formação."
  };
}
