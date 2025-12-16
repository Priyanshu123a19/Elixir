import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeLabReportPdfFromBuffer } from "@/lib/gemini";
import { indexReportForChat } from "@/lib/vectorStore";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Get auth token from header
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Create Supabase client with user's access token for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Set the session to enable RLS
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "", // Not needed for this operation
    });

    // Verify the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const userId = formData.get("userId") as string;

    // Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required. Please sign in." },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Convert file to buffer (most efficient method)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF for RAG using pdf-parse (via wrapper to avoid debug mode)
    let extractedText = "";
    try {
      // Use wrapper to prevent pdf-parse debug code from running in Next.js
      const pdfParse = require("@/lib/pdf-parse-wrapper");
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
      console.log(`Extracted text from PDF (${extractedText.length} characters, ${pdfData.numpages} pages)`);
    } catch (error: any) {
      console.error("PDF text extraction failed:", error);
      extractedText = "Text extraction failed";
    }

    // Analyze extracted text with Groq
    let aiAnalysis: string | null = null;
    try {
      if (extractedText && extractedText !== "Text extraction failed") {
        aiAnalysis = await analyzeLabReportPdfFromBuffer(
          extractedText,
          fileName || file.name
        );
        console.log(`Generated AI analysis (${aiAnalysis.length} characters)`);
      } else {
        console.warn("Skipping AI analysis - no text extracted");
      }
    } catch (error: any) {
      console.error("AI analysis failed:", error);
      // Continue even if analysis fails - we'll store the report with raw text
    }

    // Store in Supabase with both raw text and AI analysis
    const { data: labReport, error: dbError } = await supabase
      .from("lab_reports")
      .insert({
        user_id: userId,
        file_name: fileName || file.name,
        raw_text: extractedText,
        structured_data: null,
        ai_analysis: aiAnalysis,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to save lab report", details: dbError.message },
        { status: 500 }
      );
    }

    // Index the report in vector store for RAG-based chat
    try {
      if (extractedText && extractedText !== "Text extraction failed") {
        await indexReportForChat(labReport.id, extractedText, {
          reportId: labReport.id,
          fileName: labReport.file_name,
          uploadedAt: labReport.uploaded_at,
          userId: userId,
        });
        console.log(`Successfully indexed report ${labReport.id} for chat`);
      }
    } catch (error: any) {
      console.error("Vector store indexing failed:", error);
      // Don't fail the upload if indexing fails, just log it
    }

    return NextResponse.json({
      success: true,
      labReport: {
        id: labReport.id,
        fileName: labReport.file_name,
        uploadedAt: labReport.uploaded_at,
        aiAnalysis: labReport.ai_analysis,
        rawTextLength: extractedText.length,
      },
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to process lab report",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
