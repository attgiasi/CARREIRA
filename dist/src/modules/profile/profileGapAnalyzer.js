export function analyzeProfileGaps(jobs) {
    const text = jobs.map((job) => `${job.title} ${job.description}`).join(" ").toLowerCase();
    return ["excel", "power bi", "inglês", "espanhol", "cnh", "veículo próprio", "crm", "indicadores"]
        .filter((term) => text.includes(term))
        .map((term) => `Aparece com frequência nas vagas boas: ${term}. Validar se pode ser desenvolvido ou destacado com base real.`);
}
