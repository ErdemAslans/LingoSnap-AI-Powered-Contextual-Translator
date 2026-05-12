import type { TranslationResult } from "../types";

export const API_BASE = "https://api.groq.com/openai/v1";
export const MODEL = "llama-3.3-70b-versatile";

/**
 * Low-level JSON chat helper. Returns parsed JSON object from a single Groq
 * completion with `response_format: json_object`. Caller is responsible for
 * shaping the prompt to produce valid JSON.
 */
export async function chatJson<T = unknown>(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = errData.error?.message || `Groq API error ${res.status}`;
    if (res.status === 401) {
      throw new Error("API anahtarı geçersiz. Lütfen Groq Console'dan yeni bir anahtar alın.");
    }
    if (res.status === 429) throw new Error("Çok fazla istek. Biraz bekleyin.");
    if (res.status >= 500) throw new Error("Groq sunucusu meşgul. Biraz bekleyin.");
    throw new Error(msg);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Groq");
  return JSON.parse(content) as T;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface GroqError {
  error?: {
    message: string;
    type: string;
  };
}

export interface TranslationContext {
  recentTranslations?: Array<{ original: string; translation: string; topic?: string }>;
  currentTopic?: string;
}

async function translateWithGroq(
  text: string,
  apiKey: string,
  context?: TranslationContext
): Promise<TranslationResult> {
  let contextBlock = "";
  if (context?.recentTranslations && context.recentTranslations.length > 0) {
    contextBlock = `\n\nÖnceki ilgili çeviriler (tutarlılık için referans al):
${context.recentTranslations.map((t) => `- "${t.original.slice(0, 80)}..." → "${t.translation.slice(0, 80)}..."${t.topic ? ` [${t.topic}]` : ""}`).join("\n")}`;
  }

  const prompt = `Aşağıdaki İngilizce metni Türkçeye çevir.${contextBlock}

Kurallar:
1. Orijinal anlamı ve tonunu koru
2. Doğal, akıcı Türkçe kullan
3. Teknik terimlerin iyi bir Türkçe karşılığı yoksa orijinalini koru
4. Deyimler için Türkçe karşılığını bul
5. FORMATI KORU: Satır sonlarını (\\n), paragrafları, madde işaretlerini, numaralı listeleri aynen koru
6. Ayrı paragrafları tek blok haline getirme — orijinaldeki yapıyı birebir koru
7. Kod/teknik terimlerde değişken ve fonksiyon adlarını değiştirme

Çevrilecek metin:
${text}

Yanıtını şu JSON formatında ver (başka hiçbir şey ekleme):
{"translation": "çeviri metni buraya", "topic": "konuadı", "contextNote": "varsa kısa bağlam notu yoksa null"}

topic: Metnin ana konusu (ör: Docker, React, Kubernetes, Genel). Tek kelime veya kısa.
contextNote: ${context?.recentTranslations?.length ? "Bu çeviri önceki çevirilerle nasıl bağlantılı? Kısa bir not yaz." : "null"}`;

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
          content: "Sen uzman bir İngilizce-Türkçe çevirmensin. Kullanıcının öğrenme sürecini takip ediyorsun. Yanıtlarını DAİMA geçerli JSON formatında ver. Başka hiçbir metin ekleme.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errData: GroqError = await res.json().catch(() => ({}));
    const errorMsg = errData.error?.message || `Groq API error ${res.status}`;

    if (res.status === 401) {
      throw new Error("API anahtarı geçersiz. Lütfen Groq Console'dan yeni bir anahtar alın.");
    }
    if (res.status === 429) {
      throw new Error("Çok fazla istek. Biraz bekleyip tekrar deneyin.");
    }
    if (res.status === 503 || res.status === 500) {
      throw new Error("Groq sunucusu şu an meşgul. Biraz bekleyin.");
    }
    throw new Error(errorMsg);
  }

  const data: GroqResponse = await res.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error("Invalid response from Groq API");
  }

  const raw = data.choices[0].message.content.trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      translation: parsed.translation || raw,
      topic: parsed.topic || undefined,
      contextNote: parsed.contextNote === "null" || !parsed.contextNote ? undefined : parsed.contextNote,
      tags: parsed.tags || undefined,
    };
  } catch {
    // Fallback: if JSON parsing fails, treat as plain translation
    return {
      translation: raw.replace(/^["']|["']$/g, "").trim(),
    };
  }
}

export async function translateText(
  text: string,
  apiKey: string,
  context?: TranslationContext
): Promise<TranslationResult> {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API key gerekli. console.groq.com'dan ücretsiz alabilirsiniz.");
  }

  try {
    return await translateWithGroq(text, apiKey, context);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("İnternet bağlantısı yok. Bağlantınızı kontrol edin.");
    }
    throw error;
  }
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
