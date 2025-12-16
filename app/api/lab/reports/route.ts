import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Get auth token from header (optional, for RLS)
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(accessToken && {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }),
    });

    // Set session if token provided
    if (accessToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: "",
      });
    }

    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400 }
      );
    }

    // Verify user if token provided
    if (accessToken) {
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

      // Ensure userId matches authenticated user
      if (userId !== user.id) {
        return NextResponse.json(
          { error: "User ID mismatch" },
          { status: 403 }
        );
      }
    }

    const { data: labReports, error } = await supabase
      .from("lab_reports")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch lab reports", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      labReports: labReports || [],
    });
  } catch (error: any) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch lab reports",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!reportId || !userId) {
      return NextResponse.json(
        { error: "Report ID and User ID required" },
        { status: 400 }
      );
    }

    // Verify user
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

    // Ensure userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json({ error: "User ID mismatch" }, { status: 403 });
    }

    const { error } = await supabase
      .from("lab_reports")
      .delete()
      .eq("id", reportId)
      .eq("user_id", userId);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to delete lab report", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete lab report",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

