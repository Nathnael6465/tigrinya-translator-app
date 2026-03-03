export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractText } from "unpdf";

async function translateWithGoogle(text: string, from: string, to: string): Promise<string> {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Google translation failed");
  return data.data.translations[0].translatedText;
}

async function translateWithAzure(text: string, from: string, to: string): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY!;
  const region = process.env.AZURE_TRANSLATOR_REGION!;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT!;

  const paragraphs = text.split(/\n/);
  const nonEmpty = paragraphs.map(l => l.trim() === "" ? null : l);
  const toTranslate = nonEmpty.filter(l => l !== null) as string[];

  if (toTranslate.length === 0) return text;

  // Azure has 50k char limit per request so chunk if needed
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const line of toTranslate) {
    if (currentLength + line.length > 40000) {
      chunks.push(current);
      current = [line];
      currentLength = line.length;
    } else {
      current.push(line);
      currentLength += line.length;
    }
  }
  if (current.length) chunks.push(current);

  const results: string[] = [];
  for (const chunk of chunks) {
    const response = await fetch(
      `${endpoint}/translate?api-version=3.0${from !== "ti" ? `&from=${from}` : ""}&to=${to}&textType=plain`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map(t => ({ text: t }))),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Azure translation failed");
    results.push(...data.map((d: any) => d.translations[0]?.text || ""));
  }

  let index = 0;
  return nonEmpty.map(l => {
    if (l === null) return "";
    return results[index++] || "";
  }).join("\n");
}

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
4. Keep scripture references intact with correct punctuation
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
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const from = formData.get("from") as string || "en";
    const to = formData.get("to") as string || "ti";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.name.endsWith(".pdf")) return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });

    // Check cache first using file size + name as key
    const cacheKey = `${file.name}-${file.size}-${from}-${to}`;


    const { data: cached } = await supabase
      .from("translations")
      .select("output_text, google_translation, azure_translation")
      .eq("input_text", cacheKey)
      .eq("from_language", from)
      .eq("to_language", to)
      .single();

    if (cached) {
      console.log("✅ Cache hit for:", cacheKey);
      return NextResponse.json({
        translation: cached.output_text,
        googleTranslation: cached.google_translation,
        azureTranslation: cached.azure_translation,
        cached: true,
        pageCount: 1,
        fileName: file.name,
      });
    }
    console.log("❌ Cache miss, translating:", cacheKey);

    // Step 1 — Extract text from PDF
    const uint8Array = new Uint8Array(await file.arrayBuffer());
    const { text: extractedText } = await extractText(uint8Array, { mergePages: true });

    if (!extractedText) {
      return NextResponse.json({ error: "Could not extract text from PDF. The file may be scanned or image-based." }, { status: 400 });
    }

    // Step 2 — Run Google + Azure in parallel
    const [googleResult, azureResult] = await Promise.allSettled([
      translateWithGoogle(extractedText, from, to),
      translateWithAzure(extractedText, from, to),
    ]);

    const googleTranslation = googleResult.status === "fulfilled" ? googleResult.value : null;
    const azureTranslation = azureResult.status === "fulfilled" ? azureResult.value : null;

    // Step 3 — Claude polishes
    let finalTranslation = googleTranslation || azureTranslation || "";

    if (googleTranslation && azureTranslation && process.env.ANTHROPIC_API_KEY) {
      try {
        const fromLang = from === "en" ? "English" : "Tigrinya";
        const toLang = to === "ti" ? "Tigrinya" : "English";

        // Only send sample to Claude for quality check
        await polishWithClaude(
          extractedText.substring(0, 3000),
          googleTranslation.substring(0, 3000),
          azureTranslation.substring(0, 3000),
          fromLang,
          toLang
        );

        // Use FULL Google translation as final result
        finalTranslation = googleTranslation;

      } catch (e) {
        console.error("Claude polish failed, using Google:", e);
        finalTranslation = googleTranslation || azureTranslation || "";
      }
    }

    // Step 4 — Save to Supabase
    const { data: saved, error } = await supabase
      .from("translations")
      .insert({
        input_text: cacheKey, // ← use cacheKey instead of extractedText.substring
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
      originalText: extractedText,
      translationId: saved?.id,
      fileName: file.name,
      pageCount: 1,
    });

  } catch (error: any) {
    console.error("Full error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}