export function buildInformalMessage(kind, opportunity) {
    if (kind === "negociar") {
        const value = Math.max(250, (opportunity?.totalPay ?? 0) + 50);
        return `Obrigado pelas informações. Pelo horário, deslocamento e responsabilidade da função, consigo confirmar por R$ ${value}. Caso esse valor esteja dentro do orçamento, fico à disposição para seguir.`;
    }
    if (kind === "recusar")
        return "Obrigado pelo convite e pela lembrança. Para essa data/condição não consigo confirmar, mas fico à disposição para próximas oportunidades.";
    if (kind === "confirmar")
        return "Obrigado. Confirmo meu interesse, condicionado aos dados de local, horário, função, valor e forma de pagamento combinados por escrito.";
    if (kind === "cobrar")
        return "Olá, tudo bem? Passando para confirmar a previsão de pagamento referente ao trabalho realizado. Fico no aguardo, obrigado.";
    return "Olá, tudo bem? Tenho interesse na oportunidade. Pode me confirmar, por favor: data, horário de entrada e saída, local, valor da taxa, forma e prazo de pagamento, se há alimentação, se há ajuda de custo/transporte e qual será a função exata no evento? Com essas informações consigo confirmar minha disponibilidade.";
}
