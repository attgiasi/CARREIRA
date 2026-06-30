export function chooseBaseCv(job) {
    const text = `${job.careerTrack} ${job.title} ${job.description}`.toLowerCase();
    if (/fraude|risco|backoffice|contestação|operacional/.test(text))
        return "resumes/cv-prevencao.pdf";
    if (/supervis|coordena|gerente|gestão|liderança/.test(text))
        return "resumes/cv-gestao.pdf";
    if (/sac|atendimento|customer|cliente|suporte|cx|cs/.test(text))
        return "resumes/cv-atendimento.pdf";
    return "resumes/cv-hospitalidade.pdf";
}
