export function scoreJobQuality(job) {
    let score = 50;
    if (job.company && !/confirmar|confidencial/i.test(job.company))
        score += 10;
    if (job.salary !== "Não informado")
        score += 15;
    if (job.description.length > 180)
        score += 10;
    if (/benefício|beneficios|vale|plano|bonificação|bonus/i.test(job.description))
        score += 10;
    if (/salário a combinar|disponibilidade total|alta pressão/i.test(job.description))
        score -= 10;
    return Math.max(0, Math.min(100, score));
}
