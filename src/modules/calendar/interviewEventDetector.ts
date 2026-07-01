export function looksLikeInterview(text: string): boolean {
  return /entrevista|call|reunião|reuniao|processo seletivo|bate-papo|teste|dinâmica|dinamica/i.test(text);
}
