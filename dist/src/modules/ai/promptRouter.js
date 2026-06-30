import { askOpenAI } from "./openaiClient.js";
import { askGeminiFallback } from "./geminiFallback.js";
export async function routePrompt(prompt) {
    const openai = await askOpenAI(prompt);
    if (openai)
        return openai;
    const gemini = await askGeminiFallback(prompt);
    return gemini;
}
