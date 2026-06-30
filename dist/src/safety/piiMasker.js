export function maskPii(value) {
    if (typeof value !== "string")
        return value;
    return value
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-mascarado]")
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf-mascarado]")
        .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, "[telefone-mascarado]")
        .replace(/(api[_-]?key|token|secret|refresh[_-]?token)=?[A-Za-z0-9._-]+/gi, "$1=[segredo-mascarado]");
}
export function maskObject(input) {
    if (Array.isArray(input))
        return input.map(maskObject);
    if (input && typeof input === "object") {
        return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, /token|secret|key/i.test(key) ? "[segredo-mascarado]" : maskObject(value)]));
    }
    return maskPii(input);
}
