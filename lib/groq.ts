import Groq from "groq-sdk";

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn("GROQ_API_KEY is not set. Lab analysis will be disabled.");
}

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// ============================================
// TEXT CHUNKING UTILITIES FOR LARGE DOCUMENTS
// ============================================

/**
 * Split large text into chunks for processing
 * Tries to split on natural boundaries (paragraphs, sections)
 */
function chunkText(text: string, maxChunkSize: number = 6000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const sections = text.split(/\n\n={2,}.*?={2,}\n\n/); // Split on page markers
  
  let currentChunk = '';
  
  for (const section of sections) {
    // If section itself is too large, split by paragraphs
    if (section.length > maxChunkSize) {
      const paragraphs = section.split('\n\n');
      
      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph + '\n\n';
        } else {
          currentChunk += paragraph + '\n\n';
        }
      }
    } else {
      // Try to add whole section
      if ((currentChunk + section).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = section + '\n\n';
      } else {
        currentChunk += section + '\n\n';
      }
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text];
}

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

// ============================================
// ENHANCED MULTI-STAGE ANALYSIS FOR LARGE DOCUMENTS
// ============================================

/**
 * Analyze a single chunk of lab report text
 * Used for multi-page reports that need to be processed in parts
 */
async function analyzeReportChunk(
  chunk: string,
  chunkNum: number,
  totalChunks: number,
  fileName?: string
): Promise<string> {
  if (!groq) {
    throw new Error("Groq client not initialized");
  }

  const prompt = `You are analyzing ${totalChunks > 1 ? `PART ${chunkNum} of ${totalChunks}` : 'a section'} of a lab test report.

${fileName ? `FILE: ${fileName}` : ''}

REPORT SECTION:
${chunk}

TASKS FOR THIS SECTION:
1. Extract ALL test parameters with their values, units, and reference ranges
2. Identify abnormal values (mark as HIGH, LOW, or CRITICAL)
3. Note test categories (CBC, Lipid Panel, Liver Function, etc.)
4. Identify any critical findings that need immediate attention
5. List patient information if present (name, age, date, etc.)

IMPORTANT:
- Be thorough and precise with data extraction
- Include ALL numerical values you find
- Preserve units and reference ranges exactly as shown
- Note any missing or unclear data

Provide structured, detailed output focusing on data extraction and immediate observations.`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a medical data extraction expert. Extract all lab values precisely. Be thorough and accurate.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.1, // Lower temperature for accurate data extraction
    max_tokens: 3000,
  });

  return completion.choices[0]?.message?.content || "";
}

/**
 * Synthesize multiple chunk analyses into a comprehensive final report
 */
async function synthesizeAnalyses(
  chunkAnalyses: string[],
  fileName?: string
): Promise<string> {
  if (!groq) {
    throw new Error("Groq client not initialized");
  }

  const combinedAnalysis = chunkAnalyses
    .map((analysis, index) => `\n=== SECTION ${index + 1} ANALYSIS ===\n${analysis}`)
    .join('\n\n');

  const prompt = `You are a clinical assistant. I've analyzed a ${chunkAnalyses.length}-page lab report in sections. Now create a comprehensive, patient-friendly analysis.

${fileName ? `REPORT: ${fileName}` : ''}

SECTIONAL ANALYSES:
${combinedAnalysis}

FINAL COMPREHENSIVE ANALYSIS:

Create a complete analysis with these sections:

1. OVERVIEW SUMMARY
   - Brief overview of what tests were performed
   - Overall health picture in simple terms

2. KEY FINDINGS
   - List ALL abnormal values across all sections
   - Group by category (blood counts, metabolic panel, etc.)
   - For each abnormal value, explain what it means in simple terms

3. HEALTH INSIGHTS
   - Patterns and correlations across all test results
   - What these results suggest about overall health
   - Areas that look good vs areas of concern

4. IMPORTANT NOTES
   - Any critical or urgent findings
   - Values that warrant immediate follow-up

5. FOLLOW-UP QUESTIONS
   - 3-5 specific questions to ask the healthcare provider

6. LIFESTYLE RECOMMENDATIONS
   - Diet, exercise, or lifestyle changes based on results

IMPORTANT FORMATTING:
- Do NOT use markdown (no asterisks, hashtags, backticks)
- Use plain text with line breaks
- Use simple dashes for bullet points: "- Item"
- Keep language simple and reassuring
- Always remind patient to discuss with their clinician
- Be thorough but not overwhelming`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful medical AI assistant that creates clear, comprehensive, patient-friendly lab report analyses.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.4, // Slightly higher for better prose
    max_tokens: 4000, // More tokens for comprehensive analysis
  });

  return completion.choices[0]?.message?.content || "Analysis unavailable";
}

/**
 * Enhanced analysis that handles large multi-page reports
 * Automatically chunks text and performs multi-stage analysis
 */
export async function analyzeLabReportEnhanced(
  extractedText: string,
  fileName?: string,
  pageCount: number = 1
): Promise<string> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  console.log(`Starting enhanced analysis for ${fileName || 'report'} (${pageCount} pages, ${extractedText.length} chars)`);

  // For small single-page reports, use simple analysis
  if (pageCount === 1 && extractedText.length < 5000) {
    console.log("Using single-pass analysis for small report");
    return await analyzeLabReportPdfFromBuffer(extractedText, fileName);
  }

  // For larger reports, use multi-stage analysis
  console.log("Using multi-stage analysis for large report");
  const chunks = chunkText(extractedText, 6000);
  console.log(`Split into ${chunks.length} chunks`);

  if (chunks.length === 1) {
    // Single chunk but large - use enhanced single pass
    return await analyzeReportChunk(chunks[0], 1, 1, fileName);
  }

  // Multiple chunks - analyze each then synthesize
  const chunkAnalyses: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Analyzing chunk ${i + 1}/${chunks.length}`);
    const analysis = await analyzeReportChunk(chunks[i], i + 1, chunks.length, fileName);
    chunkAnalyses.push(analysis);
  }

  console.log(`Synthesizing ${chunkAnalyses.length} chunk analyses`);
  const finalAnalysis = await synthesizeAnalyses(chunkAnalyses, fileName);
  
  return finalAnalysis;
}

/**
 * Extract structured data from lab report with better accuracy for large reports
 */
export async function extractStructuredDataEnhanced(
  extractedText: string
): Promise<any> {
  if (!groq) {
    return { testResults: [] };
  }

  const chunks = chunkText(extractedText, 6000);
  const allTests: any[] = [];

  console.log(`Extracting structured data from ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const prompt = `Extract ALL lab test data from this report section into JSON format.

${chunks[i]}

Extract every test parameter you find. Return ONLY valid JSON with this structure:
{
  "testResults": [
    {
      "category": "Complete Blood Count",
      "name": "Hemoglobin",
      "value": "13.5",
      "unit": "g/dL",
      "referenceRange": "12-16",
      "status": "normal"
    }
  ]
}

Be thorough and precise. Extract ALL values.`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a data extraction expert. Return ONLY valid JSON, no explanation. Extract all lab values precisely.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const data = JSON.parse(completion.choices[0]?.message?.content || "{}");
      if (data.testResults && Array.isArray(data.testResults)) {
        allTests.push(...data.testResults);
      }
    } catch (e) {
      console.error(`Failed to extract structured data from chunk ${i + 1}:`, e);
    }
  }

  console.log(`Extracted ${allTests.length} test results total`);

  return {
    testResults: allTests,
    extractedCount: allTests.length,
  };
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

// Generate personalized recommendations based on lab results
export async function generatePersonalizedRecommendations(
  rawText: string,
  aiAnalysis: string | null
): Promise<{
  diet: string[];
  exercise: string[];
  lifestyle: string[];
}> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  let prompt = `You are a wellness advisor analyzing lab test results to provide personalized health recommendations.

=== LAB REPORT TEXT ===
${rawText.substring(0, 30000)}
=== END OF LAB REPORT ===`;

  if (aiAnalysis) {
    prompt += `\n\n=== PREVIOUS ANALYSIS ===
${aiAnalysis}
=== END OF ANALYSIS ===`;
  }

  prompt += `\n\nBased on the lab results above, provide personalized recommendations in three categories: Diet, Exercise, and Lifestyle.

INSTRUCTIONS:
1. Analyze the lab values to identify areas that need attention (e.g., high cholesterol, low iron, high blood sugar, etc.)
2. Provide 3-5 specific, actionable recommendations for each category
3. Make recommendations practical and easy to follow
4. Keep each recommendation concise (1-2 sentences maximum)
5. Focus on evidence-based suggestions
6. Be encouraging and positive in tone
7. Always include a reminder to consult with healthcare provider before making major changes

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS (use this exact structure with these exact headers):

DIET:
- [Diet recommendation 1]
- [Diet recommendation 2]
- [Diet recommendation 3]
- [Diet recommendation 4]
- [Diet recommendation 5]

EXERCISE:
- [Exercise recommendation 1]
- [Exercise recommendation 2]
- [Exercise recommendation 3]
- [Exercise recommendation 4]

LIFESTYLE:
- [Lifestyle recommendation 1]
- [Lifestyle recommendation 2]
- [Lifestyle recommendation 3]
- [Lifestyle recommendation 4]

NOTE:
Consult your healthcare provider before making significant changes to your diet, exercise routine, or lifestyle.

IMPORTANT:
- Use simple dashes (-) for bullet points
- Do NOT use asterisks, hashtags, or any markdown formatting
- Keep each recommendation concise and actionable
- Start each line with "- "`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a wellness advisor providing personalized health recommendations based on lab results."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.6,
    max_tokens: 1500,
  });

  const response = chatCompletion.choices[0]?.message?.content || "";

  // Parse the response into categories
  const recommendations = {
    diet: [] as string[],
    exercise: [] as string[],
    lifestyle: [] as string[]
  };

  try {
    const sections = response.split(/(?:DIET:|EXERCISE:|LIFESTYLE:)/i);
    
    if (sections.length >= 3) {
      // Extract diet recommendations
      const dietSection = sections[1];
      recommendations.diet = dietSection
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .filter(line => line.length > 0);

      // Extract exercise recommendations
      const exerciseSection = sections[2];
      recommendations.exercise = exerciseSection
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .filter(line => line.length > 0);

      // Extract lifestyle recommendations
      const lifestyleSection = sections[3];
      recommendations.lifestyle = lifestyleSection
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .filter(line => line.length > 0);
    }
  } catch (error) {
    console.error("Failed to parse recommendations:", error);
  }

  return recommendations;
}

// Symptom-Lab Correlation Interface
export interface SymptomCorrelation {
  correlations: Array<{
    symptom: string;
    labValue: string;
    value: string;
    normalRange: string;
    status: string;
    explanation: string;
  }>;
  insights: string;
  recommendations: string[];
  urgencyLevel: "low" | "medium" | "high";
  urgencyMessage: string;
}

export async function correlateSymptoms(
  symptoms: Array<{ name: string; severity: number }>,
  labReports: Array<{
    id: string;
    raw_text: string;
    structured_data?: any;
    ai_analysis?: string;
    uploaded_at: string;
  }>,
  daysExperiencing: number
): Promise<SymptomCorrelation> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  if (labReports.length === 0) {
    return {
      correlations: [],
      insights: "No lab reports available for analysis. Please upload lab reports to get symptom correlations.",
      recommendations: [
        "Upload your recent lab reports to enable symptom correlation analysis",
        "Consult with your healthcare provider about your symptoms",
      ],
      urgencyLevel: "low",
      urgencyMessage: "Upload lab reports for better insights",
    };
  }

  // Prepare lab data summary
  const labDataSummary = labReports
    .map((report, index) => {
      let summary = `\n--- Lab Report ${index + 1} (${report.uploaded_at}) ---\n`;
      
      if (report.structured_data?.testResults) {
        summary += "Key Test Results:\n";
        report.structured_data.testResults.forEach((test: any) => {
          summary += `- ${test.name}: ${test.value} ${test.unit || ""} (Normal: ${test.referenceRange || "N/A"}) [${test.status || "unknown"}]\n`;
        });
      } else {
        summary += `Raw Text (excerpt): ${report.raw_text.substring(0, 500)}...\n`;
      }

      if (report.ai_analysis) {
        summary += `\nAI Analysis Summary: ${report.ai_analysis.substring(0, 300)}...\n`;
      }

      return summary;
    })
    .join("\n");

  const symptomList = symptoms
    .map((s) => `${s.name} (Severity: ${s.severity}/10)`)
    .join(", ");

  const prompt = `You are a clinical assistant helping to correlate patient symptoms with their lab test results.

PATIENT SYMPTOMS:
${symptomList}
Duration: ${daysExperiencing} days

LAB REPORTS DATA:
${labDataSummary}

TASK:
Analyze the patient's symptoms and correlate them with any abnormal or relevant lab values from their reports.

RESPONSE FORMAT (YOU MUST FOLLOW THIS EXACTLY):

CORRELATIONS:
[For each relevant correlation, use this format:]
CORRELATION:
Symptom: [symptom name]
Lab Value: [test name]
Value: [actual value with unit]
Normal Range: [reference range]
Status: [normal/low/high/critical]
Explanation: [Brief explanation of how this lab value relates to the symptom]
END_CORRELATION

INSIGHTS:
[Provide 2-3 paragraphs explaining:
1. Overall health picture based on symptoms and lab values
2. Possible underlying conditions or deficiencies that may explain the symptoms
3. Important patterns or trends noticed]

RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]
[etc.]

URGENCY:
Level: [low/medium/high]
Message: [Brief message about urgency]

IMPORTANT GUIDELINES:
- Only correlate symptoms with ACTUAL abnormal lab values from the reports
- Be specific about which lab values relate to which symptoms
- Use simple, patient-friendly language
- Always recommend consulting a healthcare provider
- For urgency: 
  * HIGH if multiple critical values or severe symptoms
  * MEDIUM if several abnormal values or moderate symptoms
  * LOW if minor abnormalities or mild symptoms
- Be conservative and avoid causing unnecessary alarm
- Do NOT diagnose conditions, only suggest possible correlations`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 2000,
  });

  const responseText = completion.choices[0]?.message?.content || "";

  // Parse the structured response
  const result: SymptomCorrelation = {
    correlations: [],
    insights: "",
    recommendations: [],
    urgencyLevel: "low",
    urgencyMessage: "",
  };

  try {
    // Extract correlations
    const correlationMatches = responseText.matchAll(
      /CORRELATION:\s*\nSymptom:\s*([^\n]+)\s*\nLab Value:\s*([^\n]+)\s*\nValue:\s*([^\n]+)\s*\nNormal Range:\s*([^\n]+)\s*\nStatus:\s*([^\n]+)\s*\nExplanation:\s*([^\n]+(?:\n(?!END_CORRELATION)[^\n]+)*)\s*\nEND_CORRELATION/gi
    );

    for (const match of correlationMatches) {
      result.correlations.push({
        symptom: match[1].trim(),
        labValue: match[2].trim(),
        value: match[3].trim(),
        normalRange: match[4].trim(),
        status: match[5].trim().toLowerCase(),
        explanation: match[6].trim(),
      });
    }

    // Extract insights
    const insightsMatch = responseText.match(
      /INSIGHTS:\s*\n([\s\S]*?)(?=\n\nRECOMMENDATIONS:|$)/i
    );
    if (insightsMatch) {
      result.insights = insightsMatch[1].trim();
    }

    // Extract recommendations
    const recommendationsMatch = responseText.match(
      /RECOMMENDATIONS:\s*\n([\s\S]*?)(?=\n\nURGENCY:|$)/i
    );
    if (recommendationsMatch) {
      result.recommendations = recommendationsMatch[1]
        .split("\n")
        .filter((line) => line.trim().startsWith("-"))
        .map((line) => line.trim().substring(1).trim())
        .filter((line) => line.length > 0);
    }

    // Extract urgency
    const urgencyLevelMatch = responseText.match(
      /Level:\s*(low|medium|high)/i
    );
    if (urgencyLevelMatch) {
      result.urgencyLevel = urgencyLevelMatch[1].toLowerCase() as
        | "low"
        | "medium"
        | "high";
    }

    const urgencyMessageMatch = responseText.match(
      /Message:\s*([^\n]+)/i
    );
    if (urgencyMessageMatch) {
      result.urgencyMessage = urgencyMessageMatch[1].trim();
    }
  } catch (error) {
    console.error("Failed to parse symptom correlation response:", error);
    console.log("Raw response:", responseText);
    
    // Fallback
    result.insights = responseText.substring(0, 500) + "...";
    result.recommendations = [
      "Please consult with your healthcare provider about your symptoms",
      "Consider scheduling a follow-up appointment to discuss your lab results",
    ];
    result.urgencyMessage = "Unable to fully parse analysis. Please review with your doctor.";
  }

  return result;
}

// ============================================
// HEALTH GOALS AND PROGRESS TRACKING
// ============================================

export interface HealthGoal {
  goal_category: 'diet' | 'exercise' | 'lifestyle' | 'medication' | 'monitoring';
  goal_title: string;
  goal_description: string;
  target_metric?: string;
  target_value?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'not_started';
}

/**
 * Generate personalized health goals based on lab report analysis
 */
export async function generateHealthGoals(
  rawText: string,
  aiAnalysis: string | null,
  structuredData: any
): Promise<HealthGoal[]> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  let prompt = `You are a health goal advisor analyzing lab test results to create personalized, actionable health goals.

=== LAB REPORT TEXT ===
${rawText.substring(0, 20000)}
=== END OF LAB REPORT ===`;

  if (aiAnalysis) {
    prompt += `\n\n=== AI ANALYSIS ===
${aiAnalysis}
=== END OF ANALYSIS ===`;
  }

  if (structuredData?.testResults) {
    prompt += `\n\n=== STRUCTURED TEST RESULTS ===
${JSON.stringify(structuredData.testResults, null, 2)}
=== END OF STRUCTURED DATA ===`;
  }

  prompt += `\n\nBased on the lab results, create 5-8 specific, measurable, and actionable health goals.

INSTRUCTIONS:
1. Focus on abnormal values and areas that need improvement
2. Make goals SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
3. Include variety: diet, exercise, lifestyle, monitoring goals
4. Assign appropriate priority based on severity
5. For each goal, specify what metric to track if applicable
6. Be encouraging but realistic

RETURN VALID JSON ONLY in this exact format:
{
  "goals": [
    {
      "goal_category": "diet",
      "goal_title": "Reduce LDL Cholesterol",
      "goal_description": "Lower LDL cholesterol from 150 mg/dL to below 100 mg/dL through dietary changes. Focus on reducing saturated fats and increasing fiber intake.",
      "target_metric": "LDL Cholesterol",
      "target_value": "<100 mg/dL",
      "priority": "high",
      "status": "not_started"
    }
  ]
}

CATEGORIES: diet, exercise, lifestyle, medication, monitoring
PRIORITIES: low, medium, high, critical
STATUS: always use "not_started" for new goals

Be specific and actionable. Return ONLY valid JSON.`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a health goal advisor. Return ONLY valid JSON with health goals. Be specific and actionable.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  try {
    const response = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return response.goals || [];
  } catch (error) {
    console.error("Failed to parse health goals:", error);
    return [];
  }
}

export interface ProgressComparison {
  metric_name: string;
  baseline_value: string;
  followup_value: string;
  unit: string;
  reference_range: string;
  improvement_percentage: number | null;
  status: 'improved' | 'worsened' | 'stable' | 'normalized';
  ai_insight: string;
}

export interface ProgressAnalysis {
  overall_summary: string;
  progress_items: ProgressComparison[];
  achievement_rate: number;
  recommendations: string[];
  celebration_message: string;
  areas_of_concern: string[];
}

/**
 * Compare baseline and follow-up lab reports to track progress
 */
export async function analyzeProgressBetweenReports(
  baselineReport: {
    raw_text: string;
    structured_data?: any;
    ai_analysis?: string;
    uploaded_at: string;
  },
  followupReport: {
    raw_text: string;
    structured_data?: any;
    ai_analysis?: string;
    uploaded_at: string;
  },
  healthGoals?: HealthGoal[]
): Promise<ProgressAnalysis> {
  if (!groq) {
    throw new Error("Groq client not initialized. Set GROQ_API_KEY.");
  }

  const prompt = `You are analyzing the progress between two lab reports to track health improvements.

=== BASELINE REPORT (${baselineReport.uploaded_at}) ===
${baselineReport.raw_text.substring(0, 15000)}

BASELINE STRUCTURED DATA:
${JSON.stringify(baselineReport.structured_data?.testResults || [], null, 2)}
=== END BASELINE ===

=== FOLLOW-UP REPORT (${followupReport.uploaded_at}) ===
${followupReport.raw_text.substring(0, 15000)}

FOLLOW-UP STRUCTURED DATA:
${JSON.stringify(followupReport.structured_data?.testResults || [], null, 2)}
=== END FOLLOW-UP ===

${healthGoals ? `\n=== HEALTH GOALS SET ===
${JSON.stringify(healthGoals, null, 2)}
=== END GOALS ===\n` : ''}

TASK:
Compare the two reports and analyze progress for each metric.

RETURN VALID JSON ONLY in this exact format:
{
  "overall_summary": "Brief 2-3 sentence summary of overall progress",
  "progress_items": [
    {
      "metric_name": "LDL Cholesterol",
      "baseline_value": "150",
      "followup_value": "120",
      "unit": "mg/dL",
      "reference_range": "<100",
      "improvement_percentage": 20,
      "status": "improved",
      "ai_insight": "LDL cholesterol decreased by 30 mg/dL (20% improvement). Still above target but moving in the right direction. Continue dietary changes."
    }
  ],
  "achievement_rate": 65,
  "recommendations": [
    "Continue current diet modifications - showing good results",
    "Consider adding regular exercise to further improve lipid profile"
  ],
  "celebration_message": "Great progress! You've improved 5 out of 8 key metrics.",
  "areas_of_concern": [
    "Blood glucose remains elevated - may need additional intervention"
  ]
}

INSTRUCTIONS:
1. Compare EVERY metric that appears in both reports
2. Calculate improvement percentage where applicable
3. Status options: improved, worsened, stable, normalized
4. "normalized" means the value moved into normal range
5. Be specific and encouraging
6. Achievement rate is % of metrics that improved or normalized
7. Reference health goals if provided
8. Return ONLY valid JSON`;

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a health progress analyzer. Return ONLY valid JSON comparing lab report metrics. Be thorough and specific.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  try {
    const response = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      overall_summary: response.overall_summary || "Unable to generate summary",
      progress_items: response.progress_items || [],
      achievement_rate: response.achievement_rate || 0,
      recommendations: response.recommendations || [],
      celebration_message: response.celebration_message || "",
      areas_of_concern: response.areas_of_concern || [],
    };
  } catch (error) {
    console.error("Failed to parse progress analysis:", error);
    return {
      overall_summary: "Unable to analyze progress",
      progress_items: [],
      achievement_rate: 0,
      recommendations: [],
      celebration_message: "",
      areas_of_concern: [],
    };
  }
}

/**
 * Update health goal status based on progress
 */
export async function updateGoalStatus(
  goal: HealthGoal,
  progressData: ProgressComparison[]
): Promise<'completed' | 'in_progress' | 'active' | 'not_started'> {
  // Find relevant progress items for this goal
  const relevantProgress = progressData.filter(p => 
    goal.target_metric && p.metric_name.toLowerCase().includes(goal.target_metric.toLowerCase())
  );

  if (relevantProgress.length === 0) {
    return goal.status;
  }

  // Check if goal is achieved
  const normalized = relevantProgress.some(p => p.status === 'normalized');
  const improved = relevantProgress.some(p => p.status === 'improved');
  const worsened = relevantProgress.some(p => p.status === 'worsened');

  if (normalized) {
    return 'completed';
  } else if (improved) {
    return 'in_progress';
  } else if (worsened) {
    return 'active'; // Still needs work
  }

  return 'in_progress';
}
