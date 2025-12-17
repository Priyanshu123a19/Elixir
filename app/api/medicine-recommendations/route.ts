import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateMedicineRecommendations } from "@/lib/huggingface";
import { sendEmail } from "@/lib/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/medicine-recommendations
 * Generate medicine recommendations for a specific lab report
 */
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
      refresh_token: "",
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

    const { reportId } = await req.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    console.log(`Generating medicine recommendations for report ${reportId}`);

    // Check if recommendations already exist for this report
    const { data: existingRec, error: checkError } = await supabase
      .from("medicine_recommendations")
      .select("*")
      .eq("report_id", reportId)
      .eq("user_id", user.id)
      .single();

    if (existingRec && !checkError) {
      console.log(`Found existing recommendations for report ${reportId}`);
      return NextResponse.json({
        success: true,
        recommendation: existingRec,
        isNew: false,
      });
    }

    // Fetch the lab report with existing analysis
    const { data: labReport, error: reportError } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (reportError || !labReport) {
      console.error("Failed to fetch lab report:", reportError);
      return NextResponse.json(
        { error: "Lab report not found or access denied" },
        { status: 404 }
      );
    }

    // Check if the report has AI analysis
    if (!labReport.ai_analysis) {
      return NextResponse.json(
        { error: "Lab report must have AI analysis before generating medicine recommendations. Please ensure the report was fully processed." },
        { status: 400 }
      );
    }

    console.log(`Found lab report: ${labReport.file_name}`);
    console.log(`AI Analysis length: ${labReport.ai_analysis?.length || 0} chars`);
    console.log(`Raw text length: ${labReport.raw_text?.length || 0} chars`);

    // Generate medicine recommendations using Hugging Face Llama 3
    const recommendations = await generateMedicineRecommendations({
      rawText: labReport.raw_text,
      aiAnalysis: labReport.ai_analysis,
      structuredData: labReport.structured_data,
      fileName: labReport.file_name,
    });

    console.log(`Generated ${recommendations.medications.length} medication recommendations`);

    // Store recommendations in database
    const { data: savedRecommendation, error: saveError } = await supabase
      .from("medicine_recommendations")
      .insert({
        user_id: user.id,
        report_id: reportId,
        medications: recommendations.medications,
        general_advice: recommendations.generalAdvice,
        disclaimer_note: recommendations.disclaimerNote,
        status: "pending",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save recommendations:", saveError);
      return NextResponse.json(
        { error: "Failed to save recommendations", details: saveError.message },
        { status: 500 }
      );
    }

    console.log(`Successfully saved recommendations with ID: ${savedRecommendation.id}`);

    // Send email notification for medicine recommendations
    try {
      const formatMedications = (medications: any[]) => 
        medications.map(med => `
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 3px solid #3b82f6;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">${med.name}</h4>
            <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Type:</strong> ${med.type}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Purpose:</strong> ${med.purpose}</p>
            ${med.dosage ? `<p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Dosage:</strong> ${med.dosage}</p>` : ''}
            ${med.timing ? `<p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Timing:</strong> ${med.timing}</p>` : ''}
            ${med.sideEffects ? `<p style="margin: 5px 0; font-size: 14px; color: #ef4444;"><strong>⚠️ Side Effects:</strong> ${med.sideEffects}</p>` : ''}
          </div>
        `).join('');

      await sendEmail({
        to: user.email!,
        subject: '💊 Your Personalized Health Recommendations Are Ready',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Your Health Recommendations</h2>
            <p>Hi there,</p>
            <p>Based on your lab report analysis, we've generated personalized health recommendations for you.</p>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-weight: 500;">⚕️ Report: ${labReport.file_name}</p>
            </div>
            
            ${recommendations.medications && recommendations.medications.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #1f2937; margin-bottom: 15px;">💊 Recommended Medications/Supplements:</h3>
              ${formatMedications(recommendations.medications)}
            </div>
            ` : ''}
            
            ${recommendations.generalAdvice ? `
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="margin-top: 0; color: #1e40af;">📋 General Health Advice:</h3>
              <p style="margin: 10px 0; color: #1f2937; white-space: pre-wrap;">${recommendations.generalAdvice}</p>
            </div>
            ` : ''}
            
            ${recommendations.disclaimerNote ? `
            <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <h3 style="margin-top: 0; color: #991b1b;">⚠️ Important Disclaimer:</h3>
              <p style="margin: 10px 0; color: #991b1b; font-size: 14px;">${recommendations.disclaimerNote}</p>
            </div>
            ` : ''}
            
            <div style="margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/medicine-recommendations" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Full Recommendations
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>Note:</strong> These recommendations are AI-generated and should not replace professional medical advice. Always consult with your healthcare provider before making significant changes.
            </p>
          </div>
        `,
      });
      console.log(`Medicine recommendations email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the recommendation generation if email fails
    }

    return NextResponse.json({
      success: true,
      recommendation: savedRecommendation,
      isNew: true,
    });
  } catch (error: any) {
    console.error("Medicine recommendation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate medicine recommendations",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/medicine-recommendations?reportId=xxx
 * Get existing medicine recommendations for a report
 */
export async function GET(req: NextRequest) {
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

    // Create Supabase client
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

    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "",
    });

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

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("reportId");

    if (reportId) {
      // Get recommendations for specific report
      const { data, error } = await supabase
        .from("medicine_recommendations")
        .select(`
          *,
          lab_reports (
            file_name,
            uploaded_at
          )
        `)
        .eq("report_id", reportId)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" - that's okay
        console.error("Failed to fetch recommendation:", error);
        return NextResponse.json(
          { error: "Failed to fetch recommendation" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        recommendation: data || null,
      });
    } else {
      // Get all recommendations for user
      const { data, error } = await supabase
        .from("medicine_recommendations")
        .select(`
          *,
          lab_reports (
            file_name,
            uploaded_at
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch recommendations:", error);
        return NextResponse.json(
          { error: "Failed to fetch recommendations" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        recommendations: data || [],
      });
    }
  } catch (error: any) {
    console.error("Get recommendations error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recommendations",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/medicine-recommendations
 * Update recommendation status or doctor notes
 */
export async function PATCH(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

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

    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "",
    });

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

    const { recommendationId, status, doctorNotes } = await req.json();

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (status) {
      updateData.status = status;
    }
    
    if (doctorNotes !== undefined) {
      updateData.doctor_notes = doctorNotes;
    }

    const { data, error } = await supabase
      .from("medicine_recommendations")
      .update(updateData)
      .eq("id", recommendationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update recommendation:", error);
      return NextResponse.json(
        { error: "Failed to update recommendation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recommendation: data,
    });
  } catch (error: any) {
    console.error("Update recommendation error:", error);
    return NextResponse.json(
      {
        error: "Failed to update recommendation",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
