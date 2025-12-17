import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { correlateSymptoms, type SymptomCorrelation } from "@/lib/groq";
import { sendEmail } from "@/lib/email";

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
        { error: "Unauthorized - No access token" },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Verify user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { symptoms, daysExperiencing, reportId } = body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return NextResponse.json(
        { error: "Symptoms are required" },
        { status: 400 }
      );
    }

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `Analyzing symptoms for user ${user.id}: ${symptoms.map((s) => s.name).join(", ")}`
    );

    // Fetch the specific lab report
    const { data: report, error: reportError } = await supabase
      .from("lab_reports")
      .select("id, file_name, raw_text, structured_data, ai_analysis, uploaded_at")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (reportError || !report) {
      console.error("Error fetching lab report:", reportError);
      return NextResponse.json(
        { error: "Lab report not found" },
        { status: 404 }
      );
    }

    console.log(`Analyzing symptoms against report: ${report.file_name}`);

    // Correlate symptoms with lab values using AI (pass single report as array)
    const analysis: SymptomCorrelation = await correlateSymptoms(
      symptoms,
      [report], // Single report in array
      daysExperiencing || 0
    );

    console.log(
      `Generated symptom correlation with ${analysis.correlations.length} correlations`
    );

    // Save symptom check to database
    const { data: savedCheck, error: saveError } = await supabase
      .from("symptom_checks")
      .insert({
        user_id: user.id,
        symptoms: symptoms,
        lab_report_ids: [reportId], // Single report ID
        ai_analysis: analysis.insights,
        correlations: analysis.correlations,
        severity_score: Math.max(...symptoms.map((s) => s.severity)),
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving symptom check:", saveError);
      // Continue anyway, return the analysis
    } else {
      console.log(`Saved symptom check with ID: ${savedCheck.id}`);
    }

    // Send email notification for symptom analysis
    try {
      const getSeverityColor = (severity: number) => {
        if (severity >= 8) return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' };
        if (severity >= 5) return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
      };

      const formatSymptoms = (symptoms: any[]) => 
        symptoms.map(symptom => {
          const colors = getSeverityColor(symptom.severity);
          return `
            <div style="background-color: ${colors.bg}; padding: 12px; border-radius: 6px; margin: 8px 0; border-left: 3px solid ${colors.border};">
              <p style="margin: 0; color: ${colors.text}; font-weight: 500;">${symptom.name}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">Severity: ${symptom.severity}/10</p>
            </div>
          `;
        }).join('');

      const formatCorrelations = (correlations: any[]) => 
        correlations.map(corr => `
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 3px solid #8b5cf6;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937;">${corr.symptom}</h4>
            <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Related Test:</strong> ${corr.labValue}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #4b5563;"><strong>Correlation:</strong> ${corr.correlation}</p>
            ${corr.explanation ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">${corr.explanation}</p>` : ''}
          </div>
        `).join('');

      await sendEmail({
        to: user.email!,
        subject: '🔍 Your Symptom Analysis Results Are Ready',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Symptom Analysis Complete</h2>
            <p>Hi there,</p>
            <p>We've analyzed your symptoms in correlation with your lab report and generated personalized insights.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Analysis Details:</h3>
              <p style="margin: 5px 0;"><strong>Report:</strong> ${report.file_name}</p>
              <p style="margin: 5px 0;"><strong>Analysis Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Symptoms Analyzed:</strong> ${symptoms.length}</p>
              ${daysExperiencing ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${daysExperiencing} days</p>` : ''}
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #1f2937; margin-bottom: 12px;">📋 Your Symptoms:</h3>
              ${formatSymptoms(symptoms)}
            </div>
            
            ${analysis.correlations && analysis.correlations.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #1f2937; margin-bottom: 12px;">🔗 Lab Value Correlations:</h3>
              ${formatCorrelations(analysis.correlations)}
            </div>
            ` : ''}
            
            ${analysis.insights ? `
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="margin-top: 0; color: #1e40af;">💡 AI Insights:</h3>
              <p style="margin: 10px 0; color: #1f2937; white-space: pre-wrap;">${analysis.insights}</p>
            </div>
            ` : ''}
            
            ${analysis.recommendations && analysis.recommendations.length > 0 ? `
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
              <h3 style="margin-top: 0; color: #065f46;">✅ Recommendations:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${analysis.recommendations.map(rec => `<li style="margin: 8px 0; color: #1f2937;">${rec}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${analysis.urgencyLevel ? `
            <div style="background-color: ${analysis.urgencyLevel === 'high' ? '#fee2e2' : analysis.urgencyLevel === 'medium' ? '#fef3c7' : '#dbeafe'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${analysis.urgencyLevel === 'high' ? '#ef4444' : analysis.urgencyLevel === 'medium' ? '#f59e0b' : '#3b82f6'};">
              <h3 style="margin-top: 0; color: ${analysis.urgencyLevel === 'high' ? '#991b1b' : analysis.urgencyLevel === 'medium' ? '#92400e' : '#1e40af'};">⚕️ Urgency Level: ${analysis.urgencyLevel.toUpperCase()}</h3>
              ${analysis.urgencyLevel === 'high' ? '<p style="margin: 10px 0; color: #991b1b; font-weight: 500;">Please consult with a healthcare provider as soon as possible.</p>' : ''}
            </div>
            ` : ''}
            
            <div style="margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/symptom-checker" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Full Analysis
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>⚠️ Important:</strong> This analysis is AI-generated and should not replace professional medical advice. If you're experiencing severe symptoms, please seek immediate medical attention.
            </p>
          </div>
        `,
      });
      console.log(`Symptom analysis email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the analysis if email fails
    }

    return NextResponse.json({
      success: true,
      analysis,
      reportInfo: {
        fileName: report.file_name,
        uploadedAt: report.uploaded_at,
      },
      checkId: savedCheck?.id,
    });
  } catch (error) {
    console.error("Error in symptom checker:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze symptoms",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
