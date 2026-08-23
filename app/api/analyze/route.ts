import { NextResponse } from "next/server";

const fallback = { isPlant: true, plantName: "Tomato", scientificName: "Solanum lycopersicum", confidence: 92, healthStatus: "Warning", problem: "Some lower leaves show yellowing, which may indicate mild watering stress or a nutrient imbalance.", description: "Tomato is a warm-season crop valued for its edible fruit. This plant appears generally vigorous with a few leaves that need attention.", recommendations: ["Water deeply at the base when the top 2–3 cm of soil feels dry.", "Remove leaves that are fully yellow or touching the soil.", "Feed with a balanced tomato fertilizer according to its label."], careGuide: { sunlight: "6–8 hours", water: "Deeply, 2–3× weekly", soil: "Rich & well-drained", temperature: "18–30°C" } };
const schema = `Return only JSON with this exact structure: {"isPlant":boolean,"plantName":"string","scientificName":"string","confidence":number,"healthStatus":"Healthy | Warning | Diseased","problem":"string or empty if healthy","description":"short two-sentence overview","recommendations":["3 to 5 actionable steps"],"careGuide":{"sunlight":"string","water":"string","soil":"string","temperature":"string"}}. Set isPlant to false whenever the image is not clearly a real plant, leaf, crop, flower, or tree. For a non-plant, return empty strings, confidence 0, an empty recommendations array, and empty care-guide values.`;
const visionCandidates = ["qwen/qwen3.6-27b", "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];

async function resolveVisionModel(apiKey: string) {
  const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`Could not list Groq models (${response.status}).`);
  const models = await response.json() as { data?: { id?: string }[] };
  const available = new Set(models.data?.map(model => model.id) || []);
  const model = visionCandidates.find(candidate => available.has(candidate));
  if (!model) throw new Error("This Groq project has no supported PlantAI vision model. Enable Qwen 3.6 or Llama 4 Scout in the Groq Console.");
  return model;
}

export async function POST(request: Request) {
  try {
    const { image } = await request.json() as { image?: string };
    if (!image) return NextResponse.json({ analysis: fallback, demo: true, error: "No image was received." });
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ analysis: fallback, demo: true, error: "GROQ_API_KEY was not loaded. Create a .env.local file and restart the server." });
    const model = await resolveVisionModel(apiKey);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: `You are a careful agricultural expert. Analyze visible plant traits only. Never claim a diagnosis with certainty; use 'may indicate' for potential health problems. ${schema}` }, { role: "user", content: [{ type: "text", text: "Identify this plant and assess any visible health signs." }, { type: "image_url", image_url: { url: image } }] }] }) });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Groq returned ${response.status}: ${details.slice(0, 180)}`);
    }
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Missing response content");
    return NextResponse.json({ analysis: JSON.parse(content), demo: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Groq request error";
    return NextResponse.json({ analysis: fallback, demo: true, error: message });
  }
}
