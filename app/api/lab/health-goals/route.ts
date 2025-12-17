import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateHealthGoals } from "@/lib/groq";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// GET - Fetch health goals for a report
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

    // Fetch health goals for the report
    const { data: goals, error: goalsError } = await supabase
      .from("health_goals")
      .select("*")
      .eq("report_id", reportId)
      .eq("user_id", user.id)
      .order("priority", { ascending: false });

    if (goalsError) {
      console.error("Database error:", goalsError);
      return NextResponse.json(
        { error: "Failed to fetch health goals", details: goalsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, goals: goals || [] });
  } catch (error: any) {
    console.error("Fetch health goals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch health goals", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Generate and save health goals for a report
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

    const { reportId } = await req.json();
    if (!reportId) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    // Fetch the lab report
    const { data: report, error: reportError } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("id", reportId)
      .eq("user_id", user.id)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: "Lab report not found" },
        { status: 404 }
      );
    }

    // Check if goals already exist
    const { data: existingGoals } = await supabase
      .from("health_goals")
      .select("id")
      .eq("report_id", reportId)
      .limit(1);

    if (existingGoals && existingGoals.length > 0) {
      // Goals already exist, fetch and return them
      const { data: goals } = await supabase
        .from("health_goals")
        .select("*")
        .eq("report_id", reportId)
        .order("priority", { ascending: false });

      return NextResponse.json({
        success: true,
        goals: goals || [],
        message: "Goals already exist for this report",
      });
    }

    // Generate health goals using AI
    console.log("Generating health goals for report:", reportId);
    const goals = await generateHealthGoals(
      report.raw_text,
      report.ai_analysis,
      report.structured_data
    );

    if (!goals || goals.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate health goals" },
        { status: 500 }
      );
    }

    // Save goals to database
    const goalsToInsert = goals.map((goal) => ({
      report_id: reportId,
      user_id: user.id,
      ...goal,
    }));

    const { data: savedGoals, error: saveError } = await supabase
      .from("health_goals")
      .insert(goalsToInsert)
      .select();

    if (saveError) {
      console.error("Failed to save health goals:", saveError);
      return NextResponse.json(
        { error: "Failed to save health goals", details: saveError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      goals: savedGoals,
      message: "Health goals generated successfully",
    });
  } catch (error: any) {
    console.error("Generate health goals error:", error);
    return NextResponse.json(
      { error: "Failed to generate health goals", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update health goal status
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

    const { goalId, status } = await req.json();
    if (!goalId || !status) {
      return NextResponse.json(
        { error: "Goal ID and status required" },
        { status: 400 }
      );
    }

    // Update goal status
    const { data: updatedGoal, error: updateError } = await supabase
      .from("health_goals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", goalId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update goal:", updateError);
      return NextResponse.json(
        { error: "Failed to update goal", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      goal: updatedGoal,
    });
  } catch (error: any) {
    console.error("Update health goal error:", error);
    return NextResponse.json(
      { error: "Failed to update health goal", details: error.message },
      { status: 500 }
    );
  }
}
