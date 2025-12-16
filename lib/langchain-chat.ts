import { ChatGroq } from "@langchain/groq";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { searchReportContext } from "./vectorStore";

/**
 * Initialize the Groq chat model for RAG
 */
export function getChatModel() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  return new ChatGroq({
    apiKey,
    model: "llama-3.3-70b-versatile",
    temperature: 0.3, // Lower temperature for more accurate medical information
    maxTokens: 2048,
  });
}

/**
 * Interface for chat message history
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Chat with lab report using RAG (Retrieval Augmented Generation)
 * This provides context-aware responses based on the actual report content
 */
export async function chatWithLabReportRAG(
  reportId: string,
  reportContent: string,
  question: string,
  metadata: {
    reportId: string;
    fileName: string;
    uploadedAt: string;
    userId: string;
  },
  conversationHistory: ChatMessage[] = [],
  aiAnalysis?: string | null
): Promise<{ answer: string; sources: any[] }> {
  try {
    console.log(`Starting RAG chat for report ${reportId}`);
    console.log(`Question: ${question}`);

    // Step 1: Retrieve relevant context from vector store
    // Get more chunks for broader questions
    const numChunks = question.toLowerCase().includes("summary") || 
                      question.toLowerCase().includes("overall") ||
                      question.toLowerCase().includes("liver") ||
                      question.toLowerCase().includes("all") ? 6 : 4;
    
    const relevantDocs = await searchReportContext(
      reportId,
      question,
      reportContent,
      metadata,
      numChunks
    );

    // Extract context from retrieved documents
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    console.log(`Retrieved ${relevantDocs.length} relevant chunks, total context length: ${context.length} chars`);
    
    if (context.length < 100) {
      console.warn("WARNING: Very little context retrieved! Context:", context);
    }

    // Step 2: Build the prompt with context
    const systemPrompt = `You are an expert medical AI assistant analyzing a patient's lab report. You have ALREADY RECEIVED the lab report data below - you do NOT need to ask for it.

PATIENT'S LAB REPORT DATA (ALREADY PROVIDED):
${context}
${aiAnalysis ? `\n\nAI ANALYSIS SUMMARY:\n${aiAnalysis}` : ""}

YOUR TASK:
- Answer questions using the SPECIFIC VALUES and findings from the lab report above
- Quote exact test names, values, units, and reference ranges from the data
- Explain what abnormal values mean in simple terms
- Do NOT ask the patient for lab values - you already have them above
- If asked about tests not in this report, say "That test is not included in this report"
- Always remind them to discuss results with their healthcare provider

RESPONSE STYLE:
- Use plain, conversational language
- No markdown formatting (* or **) 
- Reference specific numbers from the report
- Be reassuring and educational

Now answer the patient's question based on the lab data provided above.`;

    // Step 3: Setup conversation with memory
    const model = getChatModel();
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
      outputKey: "output",
    });

    // Load conversation history into memory
    for (const msg of conversationHistory) {
      if (msg.role === "user") {
        await memory.chatHistory.addUserMessage(msg.content);
      } else {
        await memory.chatHistory.addMessage(new AIMessage(msg.content));
      }
    }

    // Create prompt template with history
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(systemPrompt),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // Step 4: Create conversation chain
    const chain = new ConversationChain({
      llm: model,
      memory,
      prompt,
    });

    // Step 5: Get response
    const response = await chain.invoke({
      input: question,
    });

    console.log(`Generated response length: ${response.response.length}`);

    // Extract sources for citation
    const sources = relevantDocs.map((doc) => ({
      chunkIndex: doc.metadata.chunkIndex,
      preview: doc.pageContent.substring(0, 150) + "...",
    }));

    return {
      answer: response.response,
      sources,
    };
  } catch (error) {
    console.error("Error in RAG chat:", error);
    throw new Error(`Failed to process chat: ${error}`);
  }
}

/**
 * Generate follow-up question suggestions based on report content
 */
export async function generateFollowUpQuestions(
  reportContent: string,
  aiAnalysis?: string | null
): Promise<string[]> {
  try {
    const model = getChatModel();

    const prompt = `Based on this lab report, suggest 3 specific questions the patient might want to ask:

LAB REPORT EXCERPT:
${reportContent.substring(0, 3000)}

${aiAnalysis ? `ANALYSIS:\n${aiAnalysis.substring(0, 1000)}` : ""}

Generate 3 clear, specific questions a patient would naturally ask about their results. Format as a simple list without numbering or markdown.`;

    const response = await model.invoke(prompt);
    const text = response.content.toString();

    // Parse the response into questions
    const questions = text
      .split("\n")
      .filter((line) => line.trim().length > 10)
      .slice(0, 3);

    return questions;
  } catch (error) {
    console.error("Error generating follow-up questions:", error);
    // Return default questions if generation fails
    return [
      "What do my test results mean?",
      "Are any of my values abnormal?",
      "What should I do about my results?",
    ];
  }
}

/**
 * Analyze report and extract key findings for quick summary
 */
export async function getReportSummary(
  reportContent: string
): Promise<string> {
  try {
    const model = getChatModel();

    const prompt = `Provide a brief 2-3 sentence summary of this lab report focusing on key findings:

${reportContent.substring(0, 5000)}

Use plain text, no markdown formatting.`;

    const response = await model.invoke(prompt);
    return response.content.toString();
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Lab report uploaded successfully. Ask questions to learn more about your results.";
  }
}
