export function locationMatches(location: string): boolean {
  return /curitiba|região metropolitana|são jos[eé] dos pinhais|pinhais|colombo|paran[aá]|\bpr\b|florian[oó]polis|balne[aá]rio cambori[uú]|joinville|santa catarina|\bsc\b|s[aã]o paulo|campinas|jundia[ií]|santos|sorocaba|\bsp\b|remoto|brasil|h[ií]brido/i.test(location);
}
