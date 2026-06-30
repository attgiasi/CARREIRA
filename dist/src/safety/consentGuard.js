export function needsUserApproval(action) {
    return [
        "enviar_email",
        "responder_pretensao_salarial",
        "aceitar_freela",
        "enviar_documentos",
        "confirmar_viagem",
        "aceitar_pj",
        "aceitar_mudanca"
    ].includes(action);
}
export function approvalStatusFor(action) {
    return needsUserApproval(action) ? "aprovacao_necessaria" : "permitido";
}
