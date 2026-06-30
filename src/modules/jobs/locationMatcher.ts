export function locationMatches(location: string): boolean {
  return /curitiba|pr|paraná|parana|remoto|brasil|híbrido|hibrido/i.test(location);
}
