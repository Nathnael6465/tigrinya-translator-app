import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, from, to } = await req.json();

  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;

  if (!key || !region || !endpoint) {
    return NextResponse.json({ error: "Azure credentials not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `${endpoint}/translate?api-version=3.0&from=${from}&to=${to}`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ text }]),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Translation failed");
    }

    const translation = data[0]?.translations[0]?.text;
    return NextResponse.json({ translation });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
