export function informalRisk(description: string, hourlyRate: number): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 10;
  if (hourlyRate > 0 && hourlyRate < 30) {
    flags.push("valor por hora abaixo do mínimo configurado");
    score += 25;
  }
  if (!/local|endereço|endereco|curitiba/i.test(description)) {
    flags.push("local pouco claro");
    score += 15;
  }
  if (!/pagamento|pix|dinheiro|transferência|transferencia/i.test(description)) {
    flags.push("forma de pagamento não informada");
    score += 15;
  }
  if (/pagar taxa|adiantamento|cadastro pago/i.test(description)) {
    flags.push("pedido de pagamento antecipado");
    score += 50;
  }
  return { score: Math.min(100, score), flags };
}
