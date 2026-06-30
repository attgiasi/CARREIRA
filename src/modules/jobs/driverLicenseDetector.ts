export function detectDriverLicense(text: string): { required: boolean; categories: string[]; ownVehicle: boolean } {
  const lower = text.toLowerCase();
  const required = /cnh|carteira de motorista|habilitação|habilitacao/.test(lower);
  const categories = [...lower.matchAll(/cnh\s*([abde]{1,2})/gi)].flatMap((match) => match[1].toUpperCase().split(""));
  const ownVehicle = /veículo próprio|veiculo proprio|moto própria|carro próprio/.test(lower);
  return { required, categories: [...new Set(categories)], ownVehicle };
}
