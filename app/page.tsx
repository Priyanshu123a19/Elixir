"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  StickyNote,
  Upload,
  Plus,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

export default function Home() {
  const [stats, setStats] = useState({
    labReports: 0,
    notes: 0,
    recentReports: [] as any[],
    recentNotes: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch lab reports
      const { data: labReports } = await supabase
        .from("lab_reports")
        .select("id, file_name, uploaded_at, ai_analysis")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(5);

      // Fetch notes
      const { data: notes } = await supabase
        .from("notes")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setStats({
        labReports: labReports?.length || 0,
        notes: notes?.length || 0,
        recentReports: labReports || [],
        recentNotes: notes || [],
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-card-spacing">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Recent Lab Reports */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Recent Lab Reports</h2>
              <Link href="/lab-reports">
                <Button variant="ghost" size="sm" className="text-blue-600 text-xs sm:text-sm">
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Upload</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </Link>
            </div>
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-0">
                {stats.recentReports.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {stats.recentReports.slice(0, 3).map((report) => (
                      <Link
                        key={report.id}
                        href="/lab-reports"
                        className="block p-3 sm:p-4 hover:bg-gray-50 transition-colors tap-target"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">
                                {report.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(
                                  report.uploaded_at
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                      No lab reports yet
                    </p>
                    <Link href="/lab-reports">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm">
                        <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                        <span className="hidden sm:inline">Upload Your First Report</span>
                        <span className="sm:hidden">Upload Report</span>
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Notes */}
          <div>
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Recent Notes</h2>
              <Link href="/notes">
                <Button variant="ghost" size="sm" className="text-blue-600 text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">New Note</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </Link>
            </div>
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-0">
                {stats.recentNotes.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {stats.recentNotes.slice(0, 3).map((note) => (
                      <Link
                        key={note.id}
                        href="/notes"
                        className="block p-3 sm:p-4 hover:bg-gray-50 transition-colors tap-target"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <StickyNote className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">
                                {note.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(note.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <StickyNote className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                      No notes yet
                    </p>
                    <Link href="/notes">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                        <span className="hidden sm:inline">Create Your First Note</span>
                        <span className="sm:hidden">Create Note</span>
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
