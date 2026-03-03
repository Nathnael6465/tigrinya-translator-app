import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v2 as googleTranslate } from "@google-cloud/translate";

const translator = new googleTranslate.Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY,
});

const LANGUAGE_NAMES: { [key: string]: string } = {
  en: "English",
  ti: "Tigrinya",
};

// Translate with Google
async function translateWithGoogle(text: string, from: string, to: string): Promise<string> {
  const [translation] = await translator.translate(text, { from, to });
  return translation;
}

// Translate with Azure
async function translateWithAzure(text: string, from: string, to: string): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY!;
  const region = process.env.AZURE_TRANSLATOR_REGION!;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT!;

  const paragraphs = text.split(/\n/);
  const nonEmpty = paragraphs.map(l => l.trim() === "" ? null : l);
  const toTranslate = nonEmpty.filter(l => l !== null) as string[];

  if (toTranslate.length === 0) return text;

  const response = await fetch(
    `${endpoint}/translate?api-version=3.0${from !== "ti" ? `&from=${from}` : ""}&to=${to}&textType=plain`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toTranslate.map(t => ({ text: t }))),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Azure translation failed");

  let index = 0;
  return nonEmpty.map(l => {
    if (l === null) return "";
    return data[index++]?.translations[0]?.text || "";
  }).join("\n");
}

// Claude picks the best translation
async function polishWithClaude(
  original: string,
  googleResult: string,
  azureResult: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert ${toLang} linguist and native speaker.

You have two machine translations of the same ${fromLang} text. Your job is to:
1. Pick the most accurate and natural sounding translation
2. Polish it to sound like a native ${toLang} speaker wrote it
3. Preserve ALL paragraph breaks exactly
4. Keep scripture references intact e.g. (ኢሳይያስ 22:22) with correct punctuation
5. Return ONLY the final polished text, nothing else

ORIGINAL ${fromLang}:
${original}

GOOGLE TRANSLATION:
${googleResult}

AZURE TRANSLATION:
${azureResult}`,
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error("Claude polishing failed");
  return data.content[0]?.text?.trim();
}

export async function POST(req: NextRequest) {
  const { text, from, to } = await req.json();

  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  try {
    // Step 1 — Check cache first
    const { data: cached } = await supabase
      .from("translations")
      .select("output_text, google_translation, azure_translation")
      .eq("input_text", text)
      .eq("from_language", from)
      .eq("to_language", to)
      .single();

    if (cached) {
      return NextResponse.json({
        translation: cached.output_text,
        googleTranslation: cached.google_translation,
        azureTranslation: cached.azure_translation,
        cached: true,
      });
    }

    const fromLang = LANGUAGE_NAMES[from] || from;
    const toLang = LANGUAGE_NAMES[to] || to;

    // Step 2 — Run Google + Azure in parallel
    const [googleResult, azureResult] = await Promise.allSettled([
      translateWithGoogle(text, from, to),
      translateWithAzure(text, from, to),
    ]);

    const googleTranslation = googleResult.status === "fulfilled" ? googleResult.value : null;
    const azureTranslation = azureResult.status === "fulfilled" ? azureResult.value : null;

    // Step 3 — Claude polishes the best result
    let finalTranslation = googleTranslation || azureTranslation || "";

    if (googleTranslation && azureTranslation && process.env.ANTHROPIC_API_KEY) {
      try {
        finalTranslation = await polishWithClaude(
          text,
          googleTranslation,
          azureTranslation,
          fromLang,
          toLang
        );
      } catch (e) {
        console.error("Claude polish failed, using Google:", e);
        finalTranslation = googleTranslation;
      }
    }

    // Step 4 — Save to Supabase with all 3 results
    const { data: saved, error } = await supabase
      .from("translations")
      .insert({
        input_text: text,
        output_text: finalTranslation,
        google_translation: googleTranslation,
        azure_translation: azureTranslation,
        from_language: from,
        to_language: to,
      })
      .select()
      .single();

    if (error) console.error("Supabase error:", error);

    return NextResponse.json({
      translation: finalTranslation,
      googleTranslation,
      azureTranslation,
      translationId: saved?.id,
      cached: false,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}