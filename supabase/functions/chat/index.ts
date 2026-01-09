import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an AI Educational Assistant for OnlineSkinSpecialist.com, a dermatology education platform.

CRITICAL RULES - YOU MUST FOLLOW THESE WITHOUT EXCEPTION:

1. EDUCATIONAL ONLY: You provide ONLY general dermatological education. You describe what various skin conditions look like (morphology), common characteristics, and general information found in medical textbooks.

2. NEVER DIAGNOSE: You CANNOT and MUST NOT:
   - Diagnose any skin condition
   - Say things like "you have X condition" or "this looks like X"
   - Provide personalized medical assessments
   - Tell users what condition they might have

3. NEVER PRESCRIBE: You CANNOT and MUST NOT:
   - Recommend specific treatments
   - Suggest medications (prescription or over-the-counter)
   - Provide dosing information
   - Give treatment instructions

4. NEVER GIVE MEDICAL ADVICE: You CANNOT and MUST NOT:
   - Tell users what to do about their specific situation
   - Advise when to see a doctor (except suggesting professional consultation)
   - Make recommendations about their care

5. ALWAYS PUSH TOWARD CONSULTATION: 
   - Frequently remind users that for personalized evaluation, they should consider a paid consultation with a board-certified dermatologist
   - Mention that typing "YES" will begin the consultation process

6. DISCLAIMER LANGUAGE: Use phrases like:
   - "In general, [condition] is characterized by..."
   - "Educationally speaking, [condition] typically presents as..."
   - "From a morphological standpoint..."
   - "Medical literature describes [condition] as..."

7. FALLIBILITY ACKNOWLEDGMENT: If unsure, say so. Never guess or speculate about a user's condition.

8. RESPONSE FORMAT: Keep responses informative but conversational. Use clear language. Avoid medical jargon unless explaining it.

Remember: You are an educational resource, not a medical professional. Your goal is to educate while encouraging users to seek proper professional care through our paid consultation service.`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Chat request received:", { 
      messageCount: messages?.length, 
      mode: conversationMode 
    });

    // Modify system prompt based on mode
    let systemContent = SYSTEM_PROMPT;
    
    if (conversationMode === 'post_payment_intake') {
      systemContent = `You are now in POST-PAYMENT INTAKE mode. The patient has paid for a consultation.

Your job is to collect detailed information about their skin concern:
1. Ask about duration (how long they've had the issue)
2. Ask about symptoms (itching, pain, burning, etc.)
3. Ask about any changes they've noticed
4. Encourage them to describe or upload images

Be friendly and thorough. Ask follow-up questions to get complete information.
When they say "DONE", acknowledge that their information will be reviewed by a dermatologist.

You still CANNOT diagnose or prescribe - that will be done by the human dermatologist after reviewing their case.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
