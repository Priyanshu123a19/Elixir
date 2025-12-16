import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API key not configured. Please add GROQ_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { question, conversationHistory } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey });

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: "system",
        content: `You are a helpful medical AI assistant. You provide general health information, explain medical concepts, and answer health-related questions.

Important guidelines:
- Provide accurate, evidence-based medical information
- Be clear that you're an AI assistant, not a licensed medical professional
- Encourage users to consult healthcare providers for personalized medical advice
- Be empathetic and supportive in your responses
- Explain medical terms in simple, understandable language
- If asked about specific diagnoses or treatments, remind users to consult their doctor

Keep responses concise but informative (2-4 paragraphs maximum).`,
      },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      });
    }

    // Add current question
    messages.push({
      role: "user",
      content: question,
    });

    // Call Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    const answer = chatCompletion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";

    console.log("Groq chatbot response generated, length:", answer.length);

    return NextResponse.json({
      success: true,
      answer,
      model: "llama-3.3-70b-versatile",
    });
  } catch (error: any) {
    console.error("Groq chatbot API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
