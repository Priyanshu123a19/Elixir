import { HfInference } from "@huggingface/inference";

// Initialize client at module level
const apiKey = process.env.HUGGINGFACE_API_KEY;

console.log("🔑 HUGGINGFACE_API_KEY loaded:", apiKey ? "✅ Yes" : "❌ No");

let hf: HfInference | null = null;

if (apiKey) {
  hf = new HfInference(apiKey);
  console.log("✅ Hugging Face client initialized successfully");
} else {
  console.error("❌ HUGGINGFACE_API_KEY not found in environment variables");
}

export interface MedicineRecommendation {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  purpose: string;
  precautions: string[];
}

export interface RecommendationResponse {
  medications: MedicineRecommendation[];
  general_advice: string;
  disclaimer: string;
}

/**
 * Extract specific abnormal values from lab report for precise recommendations
 */
function extractAbnormalValues(reportText: string, aiAnalysis: string): string {
  // Parse the text to find specific test results with abnormal values
  const abnormalFindings: string[] = [];
  
  // Common patterns in lab reports
  const patterns = [
    /(\w+[\w\s]*?):\s*(\d+\.?\d*)\s*([a-zA-Z\/]+)?\s*(?:\((?:normal|ref|reference):\s*([^)]+)\))?/gi,
    /(\w+[\w\s]*?)\s+(\d+\.?\d*)\s+([a-zA-Z\/]+)?\s+(?:normal|ref|reference)?\s*:\s*([^\n]+)/gi,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      abnormalFindings.push(`${match[1]}: ${match[2]} ${match[3] || ''} (Reference: ${match[4] || 'see report'})`);
    }
  });

  // Also extract from AI analysis which usually has structured findings
  const analysisLines = aiAnalysis.split('\n').filter(line => 
    line.includes('low') || 
    line.includes('high') || 
    line.includes('deficiency') || 
    line.includes('elevated') ||
    line.includes('abnormal') ||
    line.includes('below') ||
    line.includes('above')
  );

  return [...new Set([...abnormalFindings, ...analysisLines])].join('\n');
}

/**
 * Generate medicine recommendations using Hugging Face Llama 3 model
 * Based on existing lab report analysis
 */
export async function generateMedicineRecommendations(
  reportData: {
    rawText: string;
    aiAnalysis?: string | null;
    structuredData?: any;
    fileName: string;
  }
): Promise<{
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    purpose: string;
    precautions: string[];
  }>;
  generalAdvice: string;
  disclaimerNote: string;
}> {
  if (!hf) {
    throw new Error(
      `Hugging Face client not initialized. ` +
      `HUGGINGFACE_API_KEY is ${apiKey ? 'set but invalid' : 'NOT SET'}. ` +
      `Check your .env.local file and restart the server.`
    );
  }

  const { rawText, aiAnalysis, structuredData, fileName } = reportData;

  // Extract specific abnormal values
  const abnormalValues = extractAbnormalValues(rawText, aiAnalysis || "");

  const prompt = `You are an expert clinical pharmacist and physician analyzing lab results. Your task is to provide SPECIFIC, TARGETED medication recommendations based on ACTUAL ABNORMAL VALUES.

📋 LAB REPORT: ${fileName}

🔬 SPECIFIC ABNORMAL FINDINGS:
${abnormalValues}

📊 AI ANALYSIS SUMMARY:
${aiAnalysis || "No analysis available"}

📄 FULL LAB DATA:
${rawText.substring(0, 3000)}

🎯 CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. **ANALYZE EACH ABNORMAL VALUE INDIVIDUALLY**
   - Look at SPECIFIC test names and their values
   - Compare with reference ranges
   - Identify deficiencies, excesses, or imbalances

2. **PROVIDE SPECIFIC MEDICATIONS, NOT GENERIC ADVICE**
   ❌ DON'T say: "multivitamin" or "balanced diet"
   ✅ DO say: "Vitamin D3 (cholecalciferol) 5000 IU" or "Ferrous sulfate 325mg"

3. **FOR EACH ABNORMAL VALUE, RECOMMEND:**
   - Vitamin D LOW → Vitamin D3 (cholecalciferol) with specific IU
   - Vitamin B12 LOW → Methylcobalamin or Cyanocobalamin injection/oral
   - Iron LOW → Ferrous sulfate or Ferrous gluconate with mg
   - Hemoglobin LOW → Iron supplement + Vitamin C for absorption
   - Calcium LOW → Calcium citrate or Calcium carbonate with mg
   - Thyroid (TSH) HIGH → Levothyroxine (requires doctor prescription)
   - Glucose HIGH → Metformin (requires doctor prescription)
   - Cholesterol HIGH → Atorvastatin or lifestyle changes
   - Liver enzymes HIGH → Silymarin (milk thistle) or investigate cause

4. **DOSAGE MUST BE SPECIFIC:**
   - Use actual numbers: "2000 IU", "325mg", "500mcg"
   - Include frequency: "Once daily", "Twice daily", "Three times weekly"
   - Specify timing: "with meals", "before breakfast", "at bedtime"

5. **DURATION MUST BE ACTIONABLE:**
   - "3 months, then retest"
   - "6-8 weeks, monitor levels"
   - "Ongoing with monthly monitoring"
   - "Until levels normalize (typically 2-3 months)"

6. **PURPOSE MUST REFERENCE ACTUAL LAB VALUES:**
   - ✅ "Address Vitamin D deficiency (current: 18 ng/mL, target: 30-100 ng/mL)"
   - ✅ "Treat iron deficiency anemia (Hemoglobin: 10.2 g/dL, normal: 12-16 g/dL)"
   - ❌ "General health maintenance"

7. **RESPONSE FORMAT - VALID JSON ONLY:**

{
  "medications": [
    {
      "name": "Vitamin D3 (Cholecalciferol)",
      "dosage": "5000 IU",
      "frequency": "Once daily with a fatty meal",
      "duration": "8-12 weeks, then retest levels",
      "purpose": "Severe Vitamin D deficiency: Current level 18 ng/mL, Target 30-100 ng/mL. Low vitamin D linked to bone health, immune function.",
      "precautions": [
        "Take with food containing fat for better absorption",
        "Monitor calcium levels during supplementation",
        "Do not exceed 10,000 IU daily without medical supervision",
        "May interact with certain heart medications (digoxin)"
      ]
    },
    {
      "name": "Ferrous Sulfate",
      "dosage": "325 mg (65 mg elemental iron)",
      "frequency": "Once daily on empty stomach, or with Vitamin C",
      "duration": "3 months minimum, retest hemoglobin and ferritin",
      "purpose": "Iron deficiency anemia: Hemoglobin 10.5 g/dL (normal 12-16), Ferritin 8 ng/mL (normal 12-150). Causing fatigue.",
      "precautions": [
        "Take on empty stomach for best absorption, or with orange juice (Vitamin C)",
        "Avoid taking with dairy, coffee, or tea (reduces absorption)",
        "Common side effects: constipation, dark stools, stomach upset",
        "Take 2 hours apart from thyroid medications if applicable"
      ]
    }
  ],
  "generalAdvice": "Based on your specific lab results showing Vitamin D deficiency (18 ng/mL) and iron deficiency anemia (Hemoglobin 10.5 g/dL), I recommend the targeted supplements above. These deficiencies commonly cause fatigue, weakness, and reduced immunity. Retest after 8-12 weeks to monitor improvement. Include vitamin D-rich foods (fatty fish, fortified milk) and iron-rich foods (red meat, spinach, lentils) in your diet.",
  "disclaimerNote": "These recommendations are based on your specific lab abnormalities and should be discussed with your healthcare provider before starting. Prescription medications require doctor approval. Follow-up testing is essential."
}

🚨 IMPORTANT: 
- Respond with ONLY valid JSON
- NO markdown formatting, NO code blocks, NO extra text
- Base recommendations ONLY on actual abnormal values from the report
- If a value is normal, don't recommend anything for it
- Provide 2-5 specific medications based on actual deficiencies/abnormalities found

Now analyze the lab results and provide SPECIFIC, TARGETED medication recommendations in JSON format:`;

  try {
    console.log("🤖 Calling Hugging Face Llama 3.1 70B...");
    console.log("📊 Extracted abnormal values:", abnormalValues.substring(0, 200));

    // Use chat completion API with streaming
    let generatedText = "";
    
    for await (const chunk of hf.chatCompletionStream({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      messages: [
        {
          role: "system",
          content: "You are an expert clinical pharmacist providing specific medication recommendations based on lab reports. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.2, // Lower temperature for more precise, factual responses
    })) {
      if (chunk.choices && chunk.choices.length > 0) {
        const content = chunk.choices[0]?.delta?.content || "";
        generatedText += content;
      }
    }

    console.log("📝 Raw AI response (first 300 chars):", generatedText.substring(0, 300));

    // Clean up the response
    generatedText = generatedText.trim();

    // Remove markdown code blocks if present
    generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Find the JSON object
    const firstBrace = generatedText.indexOf('{');
    const lastBrace = generatedText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No valid JSON found in AI response");
    }

    const jsonText = generatedText.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (!parsed.medications || !Array.isArray(parsed.medications)) {
      throw new Error("Invalid response: missing medications array");
    }

    // Validate and normalize each medication
    const validatedMedications = parsed.medications.map((med: any) => {
      if (!med.name && !med.medication_name) {
        console.warn("⚠️ Missing medication name:", med);
      }
      
      return {
        name: med.name || med.medication_name || "Unspecified supplement",
        dosage: med.dosage || "As directed",
        frequency: med.frequency || "As directed by healthcare provider",
        duration: med.duration || "As prescribed",
        purpose: med.purpose || "General health support",
        precautions: Array.isArray(med.precautions) ? med.precautions : 
                     typeof med.precautions === 'string' ? [med.precautions] : 
                     ["Consult healthcare provider before use"],
      };
    });

    console.log(`✅ Generated ${validatedMedications.length} specific medication recommendations`);

    return {
      medications: validatedMedications,
      generalAdvice: parsed.generalAdvice || parsed.general_advice || 
        "The recommendations above are based on your specific lab abnormalities. Discuss with your healthcare provider.",
      disclaimerNote: parsed.disclaimerNote || parsed.disclaimer || 
        "⚠️ IMPORTANT: These AI-generated recommendations should be reviewed by a healthcare professional before implementation. Regular monitoring and follow-up testing are essential.",
    };

  } catch (error: any) {
    console.error("❌ Error generating recommendations:", error);

    if (error.message?.includes("JSON")) {
      console.error("JSON parsing failed. Raw response:", error);
      throw new Error("AI response was not in valid format. Please try again.");
    }
    
    throw new Error(`Medicine recommendation failed: ${error.message}`);
  }
}

/**
 * Get simple medicine suggestions without full analysis
 * Useful for quick recommendations based on common conditions
 */
export async function getQuickMedicineSuggestions(
  condition: string
): Promise<string[]> {
  if (!hf) {
    throw new Error("Hugging Face client not initialized.");
  }

  const prompt = `List 3-5 common over-the-counter medications or supplements that may help with ${condition}. Provide only the names, one per line.`;

  try {
    let fullResponse = "";
    
    for await (const chunk of hf.chatCompletionStream({
      model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.2,
    })) {
      if (chunk.choices && chunk.choices.length > 0) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullResponse += content;
      }
    }

    const suggestions = fullResponse
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.includes("consult"))
      .slice(0, 5);

    return suggestions;
  } catch (error) {
    console.error("Error getting quick suggestions:", error);
    return ["Consult your healthcare provider for recommendations"];
  }
}
