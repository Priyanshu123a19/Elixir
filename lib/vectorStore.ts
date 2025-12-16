import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

// In-memory vector stores cache (keyed by reportId)
// Note: For production, use persistent storage like Chroma, Pinecone, or Supabase pgvector
const vectorStoreCache = new Map<string, MemoryVectorStore>();

/**
 * Get embeddings instance for Google Gemini
 */
export function getEmbeddings() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return new GoogleGenerativeAIEmbeddings({
    apiKey,
    modelName: "text-embedding-004",
  });
}

/**
 * Index a lab report into vector store for RAG-based chat
 * This splits the report into chunks and creates embeddings
 */
export async function indexReportForChat(
  reportId: string,
  reportContent: string,
  metadata: {
    reportId: string;
    fileName: string;
    uploadedAt: string;
    userId: string;
  }
): Promise<MemoryVectorStore> {
  try {
    console.log(
      `Indexing report ${reportId}, content length: ${reportContent.length}`
    );

    // Split the report into chunks for better retrieval
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });

    const chunks = await textSplitter.splitText(reportContent);
    console.log(`Split into ${chunks.length} chunks`);

    // Create documents with metadata
    const documents = chunks.map(
      (chunk, index) =>
        new Document({
          pageContent: chunk,
          metadata: {
            ...metadata,
            chunkIndex: index,
            totalChunks: chunks.length,
          },
        })
    );

    // Create vector store from documents
    const embeddings = getEmbeddings();
    const vectorStore = await MemoryVectorStore.fromDocuments(
      documents,
      embeddings
    );

    // Cache the vector store
    vectorStoreCache.set(reportId, vectorStore);
    console.log(`Successfully indexed report ${reportId}`);

    return vectorStore;
  } catch (error) {
    console.error(`Error indexing report ${reportId}:`, error);
    throw new Error(`Failed to index report: ${error}`);
  }
}

/**
 * Get vector store for a specific report
 * Returns cached version if available, otherwise creates new one
 */
export async function getReportVectorStore(
  reportId: string,
  reportContent?: string,
  metadata?: {
    reportId: string;
    fileName: string;
    uploadedAt: string;
    userId: string;
  }
): Promise<MemoryVectorStore | null> {
  // Check cache first
  const cached = vectorStoreCache.get(reportId);
  if (cached) {
    console.log(`Using cached vector store for report ${reportId}`);
    return cached;
  }

  // If not cached and content provided, create new one
  if (reportContent && metadata) {
    console.log(`Creating new vector store for report ${reportId}`);
    return await indexReportForChat(reportId, reportContent, metadata);
  }

  // Not found and can't create
  console.warn(`Vector store not found for report ${reportId}`);
  return null;
}

/**
 * Search for relevant chunks in a report's vector store
 */
export async function searchReportContext(
  reportId: string,
  query: string,
  reportContent?: string,
  metadata?: {
    reportId: string;
    fileName: string;
    uploadedAt: string;
    userId: string;
  },
  topK: number = 3
): Promise<Document[]> {
  try {
    const vectorStore = await getReportVectorStore(
      reportId,
      reportContent,
      metadata
    );

    if (!vectorStore) {
      throw new Error(`Vector store not found for report ${reportId}`);
    }

    // Perform similarity search
    const relevantDocs = await vectorStore.similaritySearch(query, topK);
    console.log(
      `Found ${relevantDocs.length} relevant chunks for query: "${query.substring(0, 50)}..."`
    );

    return relevantDocs;
  } catch (error) {
    console.error(`Error searching report context:`, error);
    throw error;
  }
}

/**
 * Clear vector store cache for a specific report
 */
export function clearReportVectorStore(reportId: string): boolean {
  return vectorStoreCache.delete(reportId);
}

/**
 * Clear all cached vector stores (for cleanup)
 */
export function clearAllVectorStores(): void {
  vectorStoreCache.clear();
  console.log("Cleared all vector store cache");
}

/**
 * Get cache statistics
 */
export function getVectorStoreStats() {
  return {
    cachedReports: vectorStoreCache.size,
    reportIds: Array.from(vectorStoreCache.keys()),
  };
}
