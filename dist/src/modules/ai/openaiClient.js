import { secrets } from "../../config/secrets.js";
export async function askOpenAI(prompt) {
    if (!secrets.openaiApiKey)
        return "";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secrets.openaiApiKey}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        })
    });
    if (!response.ok)
        return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
}
