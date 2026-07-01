export function needsUserApproval(action: string): boolean {
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

export function approvalStatusFor(action: string): "aprovacao_necessaria" | "permitido" {
  return needsUserApproval(action) ? "aprovacao_necessaria" : "permitido";
}
