export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractText } from "unpdf";

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const DAILY_LIMIT = 10;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Check if IP exists and reset if it's a new day
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("ip_address", ip)
    .single();

  if (!existing) {
    // First time this IP — create record
    await supabase.from("rate_limits").insert({
      ip_address: ip,
      translation_count: 1,
      last_reset: now.toISOString(),
    });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  // Check if last reset was yesterday or earlier — reset count
  const lastReset = new Date(existing.last_reset);
  const isNewDay = lastReset < new Date(todayStart);

  if (isNewDay) {
    await supabase
      .from("rate_limits")
      .update({ translation_count: 1, last_reset: now.toISOString() })
      .eq("ip_address", ip);
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  // Check if limit exceeded
  if (existing.translation_count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Increment count
  await supabase
    .from("rate_limits")
    .update({ translation_count: existing.translation_count + 1 })
    .eq("ip_address", ip);

  return { allowed: true, remaining: DAILY_LIMIT - existing.translation_count - 1 };
}

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

  // Split by PARAGRAPHS not sentences — preserve original structure
  const splitIntoParagraphs = (text: string) => {
    return text.split(/\n+/).filter(p => p.trim());
  };

  const originalParagraphs = splitIntoParagraphs(original);
  const googleParagraphs = splitIntoParagraphs(googleResult);
  const azureParagraphs = splitIntoParagraphs(azureResult);

  const paragraphPairs = originalParagraphs.map((orig, i) => {
    const google = googleParagraphs[i] || "";
    const azure = azureParagraphs[i] || "";
    return `Paragraph ${i + 1}:
Original (${fromLang}): ${orig}
Google: ${google}
Azure: ${azure}`;
  }).join("\n\n");

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
          content: `You are an expert ${toLang} linguist, editor and native speaker.

Google Translation is your BASE — it is the most natural and accurate.
Azure Translation is your REFERENCE — use it ONLY to improve specific words or phrases where it is clearly better.

Your job paragraph by paragraph:
1. Start with Google's version as the foundation
2. Check Azure for any better word choices or phrases
3. Fix punctuation — use proper ${toLang} punctuation (።፡፤) instead of Latin (.,)
4. Improve sentence flow and natural rhythm within each paragraph
5. Fix any robotic or unnatural phrasing
6. Keep scripture references intact e.g. (ኢሳይያስ 22:22)
7. CRITICAL — preserve paragraph structure exactly as the original:
   - If original has ${originalParagraphs.length} paragraphs, return exactly ${originalParagraphs.length} paragraphs
   - Separate paragraphs with a single blank line
   - Do NOT add extra line breaks within a paragraph
   - Do NOT split sentences into separate lines
8. Return ONLY the final polished ${toLang} text, nothing else

${paragraphPairs}`,
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
    // Get IP address
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json({
        error: "Daily limit reached. Upgrade to continue translating.",
        limitReached: true,
        remaining: 0,
      }, { status: 429 });
    }

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
        remaining,
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

    // Step 3 — Claude polishes full text
    let finalTranslation = googleTranslation || azureTranslation || "";

    if (googleTranslation && azureTranslation && process.env.ANTHROPIC_API_KEY) {
      try {
        const fromLang = from === "en" ? "English" : "Tigrinya";
        const toLang = to === "ti" ? "Tigrinya" : "English";

        finalTranslation = await polishWithClaude(
          extractedText,
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
      remaining,
    });

  } catch (error: any) {
    console.error("Full error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 });
  }
}