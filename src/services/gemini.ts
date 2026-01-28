import type { TranslationResult } from "../types";

// Groq API - Free tier with Llama models
const API_BASE = "https://api.groq.com/openai/v1";
const MODEL = "llama-3.1-8b-instant"; // Fast, free tier available

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface GroqError {
  error?: {
    message: string;
    type: string;
  };
}

async function translateWithGroq(
  text: string,
  apiKey: string
): Promise<{ translation: string; explanation?: string }> {
  const prompt = `Translate the following English text to Turkish. You are a master translator who understands context, idioms, and cultural nuances.

Rules:
1. Preserve the original meaning and tone
2. Use natural, fluent Turkish
3. For technical terms, keep the original if there's no good Turkish equivalent
4. For idioms, find the Turkish equivalent rather than literal translation
5. If the text is code/technical, preserve variable names and function names

Text to translate:
${text}

Provide ONLY the Turkish translation. No explanations, no "TRANSLATION:" prefix, just the translated text.`;

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert English-Turkish translator. Provide only the Turkish translation, no additional text or explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errData: GroqError = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API error ${res.status}`);
  }

  const data: GroqResponse = await res.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Invalid response from Groq API");
  }

  const translation = data.choices[0].message.content.trim();

  return {
    translation: translation.replace(/^["']|["']$/g, "").trim(),
  };
}

export async function translateText(
  text: string,
  apiKey: string
): Promise<TranslationResult> {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Groq API key is required. Get your free API key at https://console.groq.com/");
  }

  const { translation } = await translateWithGroq(text, apiKey);

  return {
    translation,
    explanation: undefined,
    original_context: "AI-powered translation via Groq",
  };
}

export async function testApiKey(apiKey: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      const errData: GroqError = await res.json().catch(() => ({}));
      return errData.error?.message || `Error ${res.status}`;
    }

    return "ok";
  } catch (e) {
    return e instanceof Error ? e.message : "Connection failed";
  }
}
