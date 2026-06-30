export function scoreRisk(text, settings) {
    const lower = text.toLowerCase();
    const flags = [];
    let score = 10;
    for (const term of settings.badJobDetection.blockedTerms) {
        if (lower.includes(term.toLowerCase())) {
            flags.push(`Termo bloqueante: ${term}`);
            score += 35;
        }
    }
    for (const term of settings.badJobDetection.flagTerms) {
        if (lower.includes(term.toLowerCase())) {
            flags.push(`Termo de atenção: ${term}`);
            score += 10;
        }
    }
    if (/empresa confidencial|empresa oculta/.test(lower)) {
        flags.push("Empresa pouco clara");
        score += 15;
    }
    if (/documentos pessoais|pix|pagamento antecipado|taxa de cadastro/.test(lower)) {
        flags.push("Pedido financeiro/documental sensível");
        score += 40;
    }
    return { score: Math.min(100, score), flags };
}
