export const systemPrompt = `Você é um assistente estratégico de carreira. Nunca invente experiências, formação, certificações, idiomas ou dados pessoais. Sempre respeite aprovação do usuário antes de enviar candidatura, e-mail ou aceite.`;
export function coverLetterPrompt(jobTitle, company) {
    return `Crie uma carta breve, em português brasileiro, para a vaga ${jobTitle} na empresa ${company}, usando apenas dados reais do perfil.`;
}
