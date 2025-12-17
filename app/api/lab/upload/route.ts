import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
  analyzeLabReportPdfFromBuffer, 
  analyzeLabReportEnhanced,
  extractStructuredDataEnhanced,
  generatePersonalizedRecommendations,
  generateHealthGoals 
} from "@/lib/groq";
import { indexReportForChat } from "@/lib/vectorStore";
import { sendEmail } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper function to generate health goals asynchronously
async function generateHealthGoalsAsync(
  reportId: string,
  userId: string,
  rawText: string,
  aiAnalysis: string | null,
  structuredData: any,
  supabase: any
) {
  try {
    console.log(`Generating health goals for report ${reportId}...`);
    const goals = await generateHealthGoals(rawText, aiAnalysis, structuredData);
    
    if (goals && goals.length > 0) {
      const goalsToInsert = goals.map((goal) => ({
        report_id: reportId,
        user_id: userId,
        ...goal,
      }));

      const { error } = await supabase
        .from("health_goals")
        .insert(goalsToInsert);

      if (error) {
        console.error("Failed to save health goals:", error);
      } else {
        console.log(`Successfully generated ${goals.length} health goals for report ${reportId}`);
      }
    }
  } catch (error: any) {
    console.error("Health goals generation failed:", error);
    // Don't fail the upload if goal generation fails
  }
}

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

    // Extract text from PDF using enhanced parser
    let extractedText = "";
    let pageCount = 1;
    let structuredData: any = null;
    
    try {
      const { parseEnhanced } = require("@/lib/pdf-enhanced-parser");
      const pdfData = await parseEnhanced(buffer);
      
      extractedText = pdfData.cleanText;
      pageCount = pdfData.numpages;
      
      console.log(`Enhanced extraction: ${extractedText.length} chars, ${pageCount} pages, ${pdfData.tables.length} tables detected`);
      
      // Store table info if detected
      if (pdfData.tables.length > 0) {
        console.log(`Detected tables: ${pdfData.tables.map((t: any) => t.header).join(', ')}`);
      }
    } catch (error: any) {
      console.error("Enhanced PDF extraction failed, falling back to basic:", error);
      // Fallback to basic extraction
      try {
        const pdfParse = require("@/lib/pdf-parse-wrapper");
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        pageCount = pdfData.numpages || 1;
        console.log(`Basic extraction: ${extractedText.length} characters, ${pageCount} pages`);
      } catch (fallbackError: any) {
        console.error("PDF text extraction completely failed:", fallbackError);
        extractedText = "Text extraction failed";
      }
    }

    // Analyze extracted text with enhanced multi-stage analysis for large reports
    let aiAnalysis: string | null = null;
    try {
      if (extractedText && extractedText !== "Text extraction failed") {
        console.log(`Starting analysis for ${pageCount}-page report...`);
        
        // Use enhanced analysis for multi-page or large reports
        if (pageCount > 1 || extractedText.length > 5000) {
          aiAnalysis = await analyzeLabReportEnhanced(
            extractedText,
            fileName || file.name,
            pageCount
          );
          console.log(`Generated enhanced AI analysis (${aiAnalysis.length} characters)`);
        } else {
          // Use standard analysis for small single-page reports
          aiAnalysis = await analyzeLabReportPdfFromBuffer(
            extractedText,
            fileName || file.name
          );
          console.log(`Generated standard AI analysis (${aiAnalysis.length} characters)`);
        }
      } else {
        console.warn("Skipping AI analysis - no text extracted");
      }
    } catch (error: any) {
      console.error("AI analysis failed:", error);
      // Continue even if analysis fails - we'll store the report with raw text
    }

    // Extract structured data with enhanced method for better accuracy
    try {
      if (extractedText && extractedText !== "Text extraction failed") {
        console.log("Extracting structured data...");
        structuredData = await extractStructuredDataEnhanced(extractedText);
        console.log(`Extracted ${structuredData?.testResults?.length || 0} structured test results`);
      }
    } catch (error: any) {
      console.error("Structured data extraction failed:", error);
      // Continue without structured data
    }

    // Generate personalized recommendations
    let recommendations: any = null;
    try {
      if (extractedText && extractedText !== "Text extraction failed") {
        const recs = await generatePersonalizedRecommendations(extractedText, aiAnalysis);
        recommendations = recs;
        console.log(`Generated personalized recommendations`);
      }
    } catch (error: any) {
      console.error("Recommendations generation failed:", error);
      // Continue even if recommendations fail
    }

    // Store in Supabase with raw text, structured data, AI analysis, and recommendations
    const { data: labReport, error: dbError } = await supabase
      .from("lab_reports")
      .insert({
        user_id: userId,
        file_name: fileName || file.name,
        raw_text: extractedText,
        structured_data: structuredData,
        ai_analysis: aiAnalysis,
        recommendations: recommendations,
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

    // Generate health goals for the report (don't wait for this)
    generateHealthGoalsAsync(labReport.id, userId, extractedText, aiAnalysis, structuredData, supabase);

    // Send email notification for successful upload
    try {
      await sendEmail({
        to: user.email!,
        subject: '🔬 Lab Report Uploaded Successfully',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Lab Report Upload Confirmed</h2>
            <p>Hi there,</p>
            <p>Your lab report has been successfully uploaded and analyzed by our AI system.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Report Details:</h3>
              <p style="margin: 5px 0;"><strong>File Name:</strong> ${fileName || file.name}</p>
              <p style="margin: 5px 0;"><strong>Upload Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Pages:</strong> ${pageCount}</p>
              <p style="margin: 5px 0;"><strong>Tests Found:</strong> ${structuredData?.testResults?.length || 'Processing'}</p>
            </div>
            
            ${aiAnalysis ? `
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e40af;">✨ AI Analysis Complete</h3>
              <p style="margin: 5px 0;">Your report has been analyzed and insights are ready to view.</p>
            </div>
            ` : ''}
            
            <div style="margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/lab-reports" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Your Reports
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated notification from your Health Dashboard.
            </p>
          </div>
        `,
      });
      console.log(`Email notification sent to ${user.email}`);
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the upload if email fails
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
