import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { imageBase64, prompt } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          },
          { type: "text", text: prompt }
        ]
      }
    ]
  });

  const result = response.choices?.[0]?.message?.content ?? "NO";
  return NextResponse.json({ result });
}
