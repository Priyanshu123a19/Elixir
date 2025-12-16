import Groq from "groq-sdk";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn("GROQ_API_KEY is not set. Lab analysis will be disabled.");
}

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

export interface LabReportContext {
  rawText: string;
  structuredData?: {
    patientName?: string;
    date?: string;
    testType?: string;
    testResults?: Array<{
      name: string;
      value: string;
      unit?: string;
      referenceRange?: string;
      status?: "normal" | "high" | "low" | "critical";
    }>;
  };
}

export async function analyzeLabReportText(input: string | LabReportContext) {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  // Handle both string input and structured context
  let rawText: string;
  let structuredData: LabReportContext["structuredData"] | undefined;

  if (typeof input === "string") {
    rawText = input;
  } else {
    rawText = input.rawText;
    structuredData = input.structuredData;
  }

  // Build context-aware prompt
  let prompt = `You are a clinical assistant helping patients understand lab test results. You have access to extracted lab report data.

RAW LAB REPORT TEXT:
${rawText}
`;

  if (structuredData) {
    prompt += `\n\nEXTRACTED STRUCTURED DATA:
- Test Type: ${structuredData.testType || "Not specified"}
- Date: ${structuredData.date || "Not specified"}
- Patient: ${structuredData.patientName || "Not specified"}

TEST RESULTS:
${
  structuredData.testResults
    ?.map(
      (result) =>
        `- ${result.name}: ${result.value} ${result.unit || ""} (Reference: ${
          result.referenceRange || "N/A"
        }) [Status: ${result.status || "unknown"}]`
    )
    .join("\n") || "No structured test results found"
}
`;
  }

  prompt += `\n\nTASKS:
1. Summarize the overall picture in simple, reassuring language.
2. Call out any abnormal values (high/low/critical) and what they might mean in broad terms.
3. For each abnormal value, explain what it typically indicates (in general terms, not specific diagnoses).
4. Suggest 3-5 concrete follow-up questions the patient could ask their clinician.
5. Use short paragraphs and bullet points for clarity.
6. Do NOT give treatment plans, prescriptions, or specific medical diagnoses.
7. Always remind the patient to consult with their healthcare provider for medical advice.

IMPORTANT FORMATTING:
- Do NOT use markdown formatting (no asterisks, hashtags, or backticks)
- Use plain text only
- Use line breaks and simple dashes for bullet points
- Keep formatting clean and readable`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful medical AI assistant that analyzes lab reports and provides clear, patient-friendly explanations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    max_tokens: 2048,
  });

  return chatCompletion.choices[0]?.message?.content || "Unable to analyze report.";
}

// Analyze a PDF lab report from extracted text
// Note: This now expects extracted text instead of PDF buffer
export async function analyzeLabReportPdfFromBuffer(
  extractedText: string,
  fileName?: string
): Promise<string> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  const prompt = `You are a clinical assistant helping patients understand lab test results.

FILE NAME: ${fileName || "Lab report"}

EXTRACTED LAB REPORT TEXT:
${extractedText}

TASKS:
1. Carefully analyze the lab report text, including any test values and reference ranges.
2. Summarize the overall picture in simple, reassuring language.
3. Call out any clearly abnormal values and what they might mean in broad terms (no diagnoses).
4. Group results into sections (for example: blood counts, kidney function, liver function, cholesterol, glucose, etc.) when possible.
5. Suggest 3-5 specific follow-up questions the patient could ask their clinician.
6. Use short paragraphs and bullet points. Do NOT give treatment plans, prescriptions, or specific medical diagnoses.
7. Always include a short disclaimer reminding the patient to discuss results with their clinician.

IMPORTANT FORMATTING:
- Do NOT use markdown formatting (no asterisks, hashtags, or backticks)
- Use plain text only
- Use line breaks and simple dashes for bullet points
- Keep formatting clean and readable`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful medical AI assistant that analyzes lab reports and provides clear, patient-friendly explanations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    max_tokens: 2048,
  });

  return chatCompletion.choices[0]?.message?.content || "Unable to analyze report.";
}

// Chat with a lab report using raw text and AI analysis
export async function chatWithLabReport(
  rawText: string,
  analysisText: string | null,
  question: string
): Promise<string> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Lab report raw text is required for chat");
  }

  // Build the prompt with both raw text and analysis
  let prompt = `You are a clinical assistant helping a patient understand their lab test results. You have access to the COMPLETE RAW TEXT from their lab report PDF, and optionally a summary analysis.

=== RAW LAB REPORT TEXT (COMPLETE) ===
${rawText.substring(0, 50000)}${
    rawText.length > 50000 ? "\n\n[... text truncated for length ...]" : ""
  }
=== END OF RAW TEXT ===`;

  if (analysisText && analysisText.trim().length > 0) {
    prompt += `\n\n=== PREVIOUS AI ANALYSIS SUMMARY ===
${analysisText}
=== END OF ANALYSIS ===`;
  }

  prompt += `\n\nThe patient is now asking a follow-up question about their lab results.

PATIENT'S QUESTION: ${question}

CRITICAL INSTRUCTIONS:
1. You have the COMPLETE RAW TEXT from the lab report above. Use this as your primary source of information.
2. If an analysis summary is provided, you can reference it, but always verify details against the raw text.
3. DO NOT say you don't have access to the lab report data - you have the complete raw text above.
4. Reference specific values, test names, reference ranges, and findings from the raw text when answering.
5. Use simple, patient-friendly language.
6. If the question asks about something not in the report, acknowledge that and suggest they ask their healthcare provider.
7. Do NOT provide diagnoses or treatment plans.
8. Always remind them to consult their healthcare provider for medical advice.

FORMATTING REQUIREMENTS:
- Do NOT use markdown formatting (no asterisks, hashtags, or backticks)
- Use plain text only
- Use line breaks and simple dashes for lists
- Keep formatting clean and readable

Answer the patient's question now, using the raw lab report text above as your source of information:`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful medical AI assistant that helps patients understand their lab results."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    max_tokens: 1500,
  });

  return chatCompletion.choices[0]?.message?.content || "Unable to answer the question.";
}
