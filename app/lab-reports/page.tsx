"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GmailConnector } from "@/components/gmail-connector";
import { LabReportUpload } from "@/components/lab-report-upload";
import { LabGeminiPanel } from "@/components/lab-gemini-panel";
import { LabReportChat } from "@/components/lab-report-chat";

interface LabReport {
  id: string;
  file_name: string;
  raw_text: string;
  structured_data?: {
    testType?: string;
    date?: string;
    testResults?: Array<{
      name: string;
      value: string;
      unit?: string;
      referenceRange?: string;
      status?: "normal" | "high" | "low" | "critical";
    }>;
  };
  ai_analysis?: string;
  uploaded_at: string;
}

export default function LabReportsPage() {
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<LabReport | null>(null);

  const fetchLabReports = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log("No user found, cannot fetch reports");
        setLoading(false);
        return;
      }

      console.log("Fetching lab reports for user:", user.id);

      // Get session token for RLS
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/lab/reports?userId=${user.id}`, {
        headers,
      });
      const data = await response.json();

      console.log("Lab reports response:", data);

      if (data.success) {
        console.log(
          "Setting lab reports:",
          data.labReports?.length || 0,
          "reports"
        );
        setLabReports(data.labReports || []);
      } else {
        console.error("Failed to fetch reports:", data.error);
      }
    } catch (error) {
      console.error("Error fetching lab reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabReports();
  }, []);

  const handleDelete = async (reportId: string) => {
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Get session token for RLS
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/lab/reports?id=${reportId}&userId=${user.id}`,
        {
          method: "DELETE",
          headers,
        }
      );

      if (response.ok) {
        setLabReports(labReports.filter((r) => r.id !== reportId));
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
      }
    } catch (error) {
      console.error("Error deleting lab report:", error);
    }
  };

  // Calculate statistics
  const totalReports = labReports.length;
  const normalReports = labReports.filter((r) => {
    const results = r.structured_data?.testResults || [];
    return results.every((t) => t.status === "normal" || !t.status);
  }).length;
  const abnormalReports = totalReports - normalReports;
  const criticalReports = labReports.filter((r) => {
    const results = r.structured_data?.testResults || [];
    return results.some((t) => t.status === "critical");
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Lab Report Analysis
          </h2>
          <p className="text-muted-foreground">
            Upload and analyze your lab test results with AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GmailConnector />
          <LabReportUpload onUploadSuccess={fetchLabReports} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Recent Reports</TabsTrigger>
          <TabsTrigger value="analysis">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Reports
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalReports}</div>
                <p className="text-xs text-muted-foreground">
                  {labReports.length > 0
                    ? `Last uploaded ${new Date(
                        labReports[0]?.uploaded_at
                      ).toLocaleDateString()}`
                    : "No reports yet"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Normal Results
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{normalReports}</div>
                <p className="text-xs text-muted-foreground">
                  {totalReports > 0
                    ? `${Math.round(
                        (normalReports / totalReports) * 100
                      )}% of all reports`
                    : "No data"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Abnormal Results
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{abnormalReports}</div>
                <p className="text-xs text-muted-foreground">
                  Requires attention
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Critical Alerts
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{criticalReports}</div>
                <p className="text-xs text-muted-foreground">Action needed</p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : labReports.length > 0 && labReports[0]?.ai_analysis ? (
            <Card>
              <CardHeader>
                <CardTitle>Latest Report Analysis</CardTitle>
                <CardDescription>
                  AI-powered analysis of your most recent lab results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4 bg-muted/50 whitespace-pre-wrap text-sm">
                  {labReports[0].ai_analysis
                    ?.replace(/\*\*/g, "")
                    .replace(/\*/g, "")
                    .replace(/#{1,6}\s+/g, "")
                    .replace(/`/g, "")}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Reports Yet</CardTitle>
                <CardDescription>
                  Upload your first lab report to get AI-powered analysis
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <LabGeminiPanel />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Lab Reports</CardTitle>
              <CardDescription>
                View and manage your uploaded lab reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : labReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No lab reports uploaded yet</p>
                  <p className="text-sm">
                    Upload your first report to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {labReports.map((report) => {
                    const hasAbnormal =
                      report.structured_data?.testResults?.some(
                        (t) =>
                          t.status === "high" ||
                          t.status === "low" ||
                          t.status === "critical"
                      );
                    const hasCritical =
                      report.structured_data?.testResults?.some(
                        (t) => t.status === "critical"
                      );

                    return (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">
                              {report.structured_data?.testType ||
                                report.file_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {report.structured_data?.date ||
                                new Date(
                                  report.uploaded_at
                                ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={hasAbnormal ? "secondary" : "default"}
                          >
                            {hasAbnormal ? "Abnormal" : "Normal"}
                          </Badge>
                          {hasCritical && (
                            <Badge variant="outline">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Critical
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {selectedReport ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Detailed Test Results</CardTitle>
                      <CardDescription>
                        {selectedReport.structured_data?.testType ||
                          selectedReport.file_name}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReport(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedReport.structured_data?.testResults &&
                  selectedReport.structured_data.testResults.length > 0 ? (
                    <div className="space-y-4">
                      {selectedReport.structured_data.testResults.map(
                        (test, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{test.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Range: {test.referenceRange || "N/A"}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-semibold">
                                {test.value} {test.unit || ""}
                              </p>
                              <Badge
                                variant={
                                  test.status === "normal" || !test.status
                                    ? "default"
                                    : test.status === "critical"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {test.status === "normal"
                                  ? "Normal"
                                  : test.status === "high"
                                  ? "High"
                                  : test.status === "low"
                                  ? "Low"
                                  : test.status === "critical"
                                  ? "Critical"
                                  : "Unknown"}
                              </Badge>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No structured test results found. Raw text available
                      below.
                    </p>
                  )}

                  {selectedReport.ai_analysis && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold mb-2">AI Analysis</h4>
                      <div className="rounded-lg border p-4 bg-muted/50 whitespace-pre-wrap text-sm">
                        {selectedReport.ai_analysis
                          ?.replace(/\*\*/g, "")
                          .replace(/\*/g, "")
                          .replace(/#{1,6}\s+/g, "")
                          .replace(/`/g, "")}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chat Interface */}
              <LabReportChat
                reportId={selectedReport.id}
                fileName={selectedReport.file_name}
              />
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Test Results</CardTitle>
                <CardDescription>
                  Select a report from the "Recent Reports" tab to view detailed
                  analysis
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
