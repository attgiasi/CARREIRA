export function scoreInformalWork(opportunity) {
    let score = 45;
    if (opportunity.hourlyRate >= 30)
        score += 15;
    if (opportunity.hourlyRate >= 45)
        score += 10;
    if (opportunity.foodIncluded)
        score += 5;
    if (opportunity.transportIncluded)
        score += 5;
    if (opportunity.paymentDelayDays <= 1)
        score += 10;
    if (opportunity.location.toLowerCase().includes("curitiba"))
        score += 5;
    score -= Math.floor(opportunity.riskScore / 3);
    return Math.max(0, Math.min(100, score));
}
export function classifyInformal(score, riskScore) {
    if (riskScore >= 80)
        return "Golpe provável";
    if (riskScore >= 60)
        return "Suspeita";
    if (score >= 90)
        return "Excelente";
    if (score >= 75)
        return "Boa";
    if (score >= 60)
        return "Aceitável";
    if (score >= 40)
        return "Fraca";
    return "Recusar";
}
