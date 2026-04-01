export async function geminiFreeViaOpenRouter(prompt, apiKey) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://intruvurt.space", // recommended
      "X-Title": "Intruvurt",                   // recommended
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}
