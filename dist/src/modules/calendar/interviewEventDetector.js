export function looksLikeInterview(text) {
    return /entrevista|call|reunião|reuniao|processo seletivo|bate-papo|teste|dinâmica|dinamica/i.test(text);
}
