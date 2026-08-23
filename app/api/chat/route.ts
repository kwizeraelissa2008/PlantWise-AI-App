import { NextResponse } from "next/server";

type Context = { plantName: string; healthStatus: string; problem: string; careGuide: { sunlight: string; water: string; soil: string; temperature: string } };

function demoAnswer(question: string, context: Context) {
  if (question.toLowerCase().includes("water")) return `For this ${context.plantName}, ${context.careGuide.water.toLowerCase()}. Check the top layer of soil first and adjust for rainfall or heat.`;
  return `For your ${context.plantName}, keep watching the plant over the next few days. ${context.problem ? `The scan noted: ${context.problem}` : "The scan did not identify a clear visible problem."} If symptoms spread, consult a local extension service or plant professional.`;
}

export async function POST(request: Request) {
  const { question, context } = await request.json() as { question?: string; context?: Context };
  if (!question || !context) return NextResponse.json({ answer: "Please ask a question about your scan." }, { status: 400 });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ answer: demoAnswer(question, context), demo: true });
  try {
    const prompt = `You are PlantAI, a practical agricultural guide. Scan context: plant=${context.plantName}; health=${context.healthStatus}; visible concern=${context.problem || "none"}; care=${JSON.stringify(context.careGuide)}. Answer this question in 1–3 short sentences and under 60 words: ${question}. Return only valid JSON in this format: {"answer":"your concise answer"}. Do not expose reasoning or use markdown.`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "qwen/qwen3.6-27b", temperature: 0.3, max_completion_tokens: 120, reasoning_effort: "none", reasoning_format: "hidden", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) });
    if (!response.ok) throw new Error("Groq request failed");
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    const answer = content ? (JSON.parse(content) as { answer?: string }).answer?.trim() : undefined;
    return NextResponse.json({ answer: answer || demoAnswer(question, context) });
  } catch { return NextResponse.json({ answer: demoAnswer(question, context), demo: true }); }
}
