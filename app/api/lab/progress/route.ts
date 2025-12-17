import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyzeProgressBetweenReports, updateGoalStatus } from "@/lib/groq";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// POST - Link a follow-up report and analyze progress
export async function POST(req: NextRequest) {
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
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "",
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const { baselineReportId, followupReportId, notes } = await req.json();

    if (!baselineReportId || !followupReportId) {
      return NextResponse.json(
        { error: "Baseline and follow-up report IDs required" },
        { status: 400 }
      );
    }

    // Fetch both reports
    const { data: baselineReport, error: baselineError } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("id", baselineReportId)
      .eq("user_id", user.id)
      .single();

    const { data: followupReport, error: followupError } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("id", followupReportId)
      .eq("user_id", user.id)
      .single();

    if (baselineError || followupError || !baselineReport || !followupReport) {
      return NextResponse.json(
        { error: "One or both reports not found" },
        { status: 404 }
      );
    }

    // Check if relationship already exists
    const { data: existingRelationship } = await supabase
      .from("report_relationships")
      .select("*")
      .eq("baseline_report_id", baselineReportId)
      .eq("followup_report_id", followupReportId)
      .single();

    let relationshipId: string;

    if (existingRelationship) {
      relationshipId = existingRelationship.id;
    } else {
      // Create relationship
      const { data: relationship, error: relError } = await supabase
        .from("report_relationships")
        .insert({
          user_id: user.id,
          baseline_report_id: baselineReportId,
          followup_report_id: followupReportId,
          relationship_type: "follow_up",
          notes: notes || null,
        })
        .select()
        .single();

      if (relError) {
        console.error("Failed to create relationship:", relError);
        return NextResponse.json(
          { error: "Failed to link reports", details: relError.message },
          { status: 500 }
        );
      }

      relationshipId = relationship.id;
    }

    // Fetch health goals for baseline report
    const { data: healthGoals } = await supabase
      .from("health_goals")
      .select("*")
      .eq("report_id", baselineReportId);

    // Analyze progress using AI
    console.log("Analyzing progress between reports...");
    const progressAnalysis = await analyzeProgressBetweenReports(
      baselineReport,
      followupReport,
      healthGoals || undefined
    );

    // Save progress tracking data
    const progressItems = progressAnalysis.progress_items.map((item) => ({
      relationship_id: relationshipId,
      user_id: user.id,
      metric_name: item.metric_name,
      baseline_value: item.baseline_value,
      followup_value: item.followup_value,
      unit: item.unit,
      reference_range: item.reference_range,
      improvement_percentage: item.improvement_percentage,
      status: item.status,
      ai_insight: item.ai_insight,
    }));

    if (progressItems.length > 0) {
      // Delete existing progress items for this relationship
      await supabase
        .from("progress_tracking")
        .delete()
        .eq("relationship_id", relationshipId);

      // Insert new progress items
      const { error: progressError } = await supabase
        .from("progress_tracking")
        .insert(progressItems);

      if (progressError) {
        console.error("Failed to save progress:", progressError);
      }
    }

    // Update health goal statuses based on progress
    if (healthGoals && healthGoals.length > 0 && progressAnalysis.progress_items.length > 0) {
      for (const goal of healthGoals) {
        const newStatus = await updateGoalStatus(goal, progressAnalysis.progress_items);
        if (newStatus !== goal.status) {
          await supabase
            .from("health_goals")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", goal.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      relationshipId,
      progressAnalysis,
      message: "Progress analysis completed successfully",
    });
  } catch (error: any) {
    console.error("Link follow-up report error:", error);
    return NextResponse.json(
      { error: "Failed to link follow-up report", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Fetch progress data for a report
export async function GET(req: NextRequest) {
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
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "",
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const reportId = req.nextUrl.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    // Get relationships where this report is either baseline or follow-up
    const { data: relationships, error: relError } = await supabase
      .from("report_relationships")
      .select("*")
      .or(`baseline_report_id.eq.${reportId},followup_report_id.eq.${reportId}`)
      .eq("user_id", user.id);

    if (relError) {
      console.error("Failed to fetch relationships:", relError);
      return NextResponse.json(
        { error: "Failed to fetch progress", details: relError.message },
        { status: 500 }
      );
    }

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({
        success: true,
        hasBaseline: false,
        hasFollowup: false,
        relationships: [],
        progressData: [],
      });
    }

    // Fetch progress tracking data for these relationships
    const relationshipIds = relationships.map(r => r.id);
    const { data: progressData, error: progressError } = await supabase
      .from("progress_tracking")
      .select("*")
      .in("relationship_id", relationshipIds)
      .eq("user_id", user.id);

    if (progressError) {
      console.error("Failed to fetch progress data:", progressError);
    }

    // Determine if this report has baseline or follow-up
    const hasBaseline = relationships.some(r => r.followup_report_id === reportId);
    const hasFollowup = relationships.some(r => r.baseline_report_id === reportId);

    return NextResponse.json({
      success: true,
      hasBaseline,
      hasFollowup,
      relationships: relationships || [],
      progressData: progressData || [],
    });
  } catch (error: any) {
    console.error("Fetch progress error:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress", details: error.message },
      { status: 500 }
    );
  }
}
