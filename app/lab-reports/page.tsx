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
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GmailConnector } from "@/components/gmail-connector";
import { LabReportUpload } from "@/components/lab-report-upload";
import { LabGeminiPanel } from "@/components/lab-gemini-panel";
import { HealthGoalsView } from "@/components/health-goals-view";
import { LinkFollowupReport } from "@/components/link-followup-report";

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
  recommendations?: {
    diet: string[];
    exercise: string[];
    lifestyle: string[];
  };
  uploaded_at: string;
}

export default function LabReportsPage() {
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<LabReport | null>(null);
  const [selectedOverviewReport, setSelectedOverviewReport] = useState<LabReport | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

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

  // Auto-select the first report when Health Goals tab is opened if none selected
  useEffect(() => {
    if (activeTab === "goals" && !selectedReport && labReports.length > 0) {
      console.log("Auto-selecting first report for Health Goals");
      setSelectedReport(labReports[0]);
    }
  }, [activeTab, selectedReport, labReports]);

  // Auto-select the first report for overview when reports are loaded
  useEffect(() => {
    if (labReports.length > 0 && !selectedOverviewReport) {
      setSelectedOverviewReport(labReports[0]);
    }
  }, [labReports, selectedOverviewReport]);

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
    <div className="mobile-card-spacing">
      <div className="flex flex-col gap-4 sm:gap-3">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Lab Report Analysis
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Upload and analyze your lab test results with AI-powered insights
            </p>
          </div>
        </div>
        
        {/* Action Buttons - Full width on mobile, side by side with better spacing */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial">
            <GmailConnector />
          </div>
          <div className="flex-1 sm:flex-initial">
            <LabReportUpload onUploadSuccess={fetchLabReports} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-1.5 py-2 sm:px-3 sm:py-2.5">Overview</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm px-1.5 py-2 sm:px-3 sm:py-2.5">Reports</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs sm:text-sm px-1.5 py-2 sm:px-3 sm:py-2.5">Analysis</TabsTrigger>
          <TabsTrigger value="goals" className="text-xs sm:text-sm px-1.5 py-2 sm:px-3 sm:py-2.5">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3 sm:space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Total Reports
                </CardTitle>
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{totalReports}</div>
                <p className="text-xs text-muted-foreground">
                  {labReports.length > 0
                    ? `Last ${new Date(
                        labReports[0]?.uploaded_at
                      ).toLocaleDateString()}`
                    : "No reports"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Normal Results
                </CardTitle>
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{normalReports}</div>
                <p className="text-xs text-muted-foreground">
                  {totalReports > 0
                    ? `${Math.round(
                        (normalReports / totalReports) * 100
                      )}%`
                    : "No data"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Abnormal Results
                </CardTitle>
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{abnormalReports}</div>
                <p className="text-xs text-muted-foreground">
                  Needs attention
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Critical Alerts
                </CardTitle>
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">{criticalReports}</div>
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
          ) : labReports.length > 0 ? (
            <>
              {/* Report Selector */}
              <Card className="border-2 border-primary/20 shadow-md bg-primary/5">
                <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                  <CardTitle className="text-base sm:text-lg">Select Report</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Choose a report to view its analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <Select
                    value={selectedOverviewReport?.id || ""}
                    onValueChange={(value) => {
                      const report = labReports.find((r) => r.id === value);
                      if (report) {
                        setSelectedOverviewReport(report);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a report" />
                    </SelectTrigger>
                    <SelectContent>
                      {labReports.map((report) => (
                        <SelectItem key={report.id} value={report.id}>
                          {report.structured_data?.testType || report.file_name} - {" "}
                          {report.structured_data?.date ||
                            new Date(report.uploaded_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Report Analysis */}
              {selectedOverviewReport?.ai_analysis ? (
                <Card>
                  <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                    <CardTitle className="text-base sm:text-lg">Report Analysis</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      AI-powered analysis of {selectedOverviewReport.structured_data?.testType || selectedOverviewReport.file_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <div className="rounded-lg border p-3 sm:p-4 bg-muted/50 whitespace-pre-wrap text-xs sm:text-sm">
                      {selectedOverviewReport.ai_analysis
                        ?.replace(/\*\*/g, "")
                        .replace(/\*/g, "")
                        .replace(/#{1,6}\s+/g, "")
                        .replace(/`/g, "")}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                    <CardTitle className="text-base sm:text-lg">No Analysis Available</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      This report doesn't have an AI analysis yet
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-base sm:text-lg">No Reports Yet</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
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
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base truncate">
                              {report.structured_data?.testType ||
                                report.file_name}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {report.structured_data?.date ||
                                new Date(
                                  report.uploaded_at
                                ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Mobile Layout */}
                        <div className="flex sm:hidden flex-col gap-2">
                          {/* Badges Row */}
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={hasAbnormal ? "secondary" : "default"}
                              className="text-xs"
                            >
                              {hasAbnormal ? "Abnormal" : "Normal"}
                            </Badge>
                            {hasCritical && (
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Critical
                              </Badge>
                            )}
                          </div>
                          
                          {/* Action Buttons Row */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 px-2"
                              onClick={() => {
                                setSelectedReport(report);
                                setActiveTab("analysis");
                              }}
                            >
                              Analysis
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs h-8 px-2"
                              onClick={() => {
                                setSelectedReport(report);
                                setActiveTab("goals");
                              }}
                            >
                              Goals
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 px-2"
                              onClick={() => handleDelete(report.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Desktop Layout */}
                        <div className="hidden sm:flex items-center gap-2">
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
                            onClick={() => {
                              setSelectedReport(report);
                              setActiveTab("analysis");
                            }}
                          >
                            View Analysis
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report);
                              setActiveTab("goals");
                            }}
                          >
                            Health Goals
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

              {/* Personalized Recommendations */}
              {selectedReport.recommendations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Personalized Recommendations
                    </CardTitle>
                    <CardDescription>
                      Evidence-based suggestions tailored to your lab results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Diet Recommendations */}
                    {selectedReport.recommendations.diet && selectedReport.recommendations.diet.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-lg">🥗</span>
                          </div>
                          <h4 className="font-semibold text-lg">Diet</h4>
                        </div>
                        <div className="space-y-2 pl-10">
                          {selectedReport.recommendations.diet.map((rec, idx) => (
                            <div key={idx} className="flex gap-2 text-sm">
                              <span className="text-primary mt-1">•</span>
                              <p className="flex-1 text-muted-foreground">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exercise Recommendations */}
                    {selectedReport.recommendations.exercise && selectedReport.recommendations.exercise.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-lg">💪</span>
                          </div>
                          <h4 className="font-semibold text-lg">Exercise</h4>
                        </div>
                        <div className="space-y-2 pl-10">
                          {selectedReport.recommendations.exercise.map((rec, idx) => (
                            <div key={idx} className="flex gap-2 text-sm">
                              <span className="text-primary mt-1">•</span>
                              <p className="flex-1 text-muted-foreground">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lifestyle Recommendations */}
                    {selectedReport.recommendations.lifestyle && selectedReport.recommendations.lifestyle.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-lg">🌱</span>
                          </div>
                          <h4 className="font-semibold text-lg">Lifestyle</h4>
                        </div>
                        <div className="space-y-2 pl-10">
                          {selectedReport.recommendations.lifestyle.map((rec, idx) => (
                            <div key={idx} className="flex gap-2 text-sm">
                              <span className="text-primary mt-1">•</span>
                              <p className="flex-1 text-muted-foreground">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-xs text-muted-foreground italic">
                        ⚠️ These recommendations are AI-generated suggestions based on your lab results. 
                        Always consult with your healthcare provider before making significant changes to your diet, exercise routine, or lifestyle.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
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

        <TabsContent value="goals" className="space-y-4">
          {selectedReport ? (
            <>
              <HealthGoalsView 
                reportId={selectedReport.id}
                onLinkFollowup={() => {
                  // Trigger follow-up linking
                  const linkButton = document.getElementById(`link-followup-${selectedReport.id}`);
                  linkButton?.click();
                }}
              />
              <div className="hidden">
                <LinkFollowupReport
                  baselineReportId={selectedReport.id}
                  onProgressAnalyzed={() => {
                    // Refresh goals view
                    fetchLabReports();
                  }}
                  triggerButton={
                    <button id={`link-followup-${selectedReport.id}`} />
                  }
                />
              </div>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Health Goals</CardTitle>
                <CardDescription>
                  Select a report from the "Recent Reports" tab to view health goals
                  and progress tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8">
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    You have {labReports.length} report(s) uploaded
                  </p>
                  <Button
                    variant="default"
                    onClick={() => {
                      setSelectedReport(labReports[0]);
                      console.log("Selected latest report:", labReports[0].id);
                    }}
                  >
                    View Latest Report Goals
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("reports")}
                  >
                    Browse All Reports
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
