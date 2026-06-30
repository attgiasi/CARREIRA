export function isExploitative(text: string): boolean {
  return /sem remuneração|curso pago obrigatório|taxa de cadastro|100% comissão/i.test(text);
}
