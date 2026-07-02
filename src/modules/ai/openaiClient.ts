import { secrets } from "../../config/secrets.js";

export async function askOpenAI(prompt: string): Promise<string> {
  if (!secrets.openaiApiKey) return "";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.openaiApiKey}`
    },
    body: JSON.stringify({
      model: secrets.openaiModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });
  if (!response.ok) return "";
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}
