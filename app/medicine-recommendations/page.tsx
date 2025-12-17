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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pill,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LabReport {
  id: string;
  file_name: string;
  uploaded_at: string;
  ai_analysis?: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  purpose: string;
  precautions: string[];
}

interface MedicineRecommendation {
  id: string;
  report_id: string;
  medications: Medication[];
  general_advice: string;
  disclaimer_note: string;
  status: "pending" | "reviewed" | "prescribed" | "declined";
  doctor_notes?: string;
  created_at: string;
  updated_at: string;
  lab_reports?: {
    file_name: string;
    uploaded_at: string;
  };
}

export default function MedicineRecommendationsPage() {
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [recommendation, setRecommendation] = useState<MedicineRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRecommendations, setAllRecommendations] = useState<MedicineRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState("generate");

  // Fetch user's lab reports
  const fetchLabReports = async () => {
    if (!supabase) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log("No user found");
        return;
      }

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

      if (data.success) {
        // Filter reports that have AI analysis
        const reportsWithAnalysis = (data.labReports || []).filter(
          (report: LabReport) => report.ai_analysis
        );
        setLabReports(reportsWithAnalysis);
      }
    } catch (error) {
      console.error("Failed to fetch lab reports:", error);
    }
  };

  // Fetch all recommendations for history view (exclude declined)
  const fetchAllRecommendations = async () => {
    if (!supabase) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const response = await fetch("/api/medicine-recommendations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Filter out declined recommendations
        const activeRecommendations = (data.recommendations || []).filter(
          (rec: MedicineRecommendation) => rec.status !== "declined"
        );
        setAllRecommendations(activeRecommendations);
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    }
  };

  // Check for existing recommendation when report is selected
  const checkExistingRecommendation = async (reportId: string) => {
    if (!supabase || !reportId) return;

    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please sign in to view recommendations");
        return;
      }

      const response = await fetch(
        `/api/medicine-recommendations?reportId=${reportId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success && data.recommendation) {
        // Don't show declined recommendations
        if (data.recommendation.status === "declined") {
          setRecommendation(null);
        } else {
          setRecommendation(data.recommendation);
          // Auto-mark as reviewed if it was pending
          if (data.recommendation.status === "pending") {
            updateRecommendationStatus(data.recommendation.id, "reviewed");
          }
        }
      } else {
        setRecommendation(null);
      }
    } catch (error) {
      console.error("Failed to check existing recommendation:", error);
      setRecommendation(null);
    } finally {
      setLoading(false);
    }
  };

  // Generate medicine recommendations
  const generateRecommendations = async () => {
    if (!selectedReportId || !supabase) return;

    try {
      setGenerating(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please sign in to generate recommendations");
        return;
      }

      const response = await fetch("/api/medicine-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId: selectedReportId }),
      });

      const data = await response.json();

      if (data.success) {
        setRecommendation(data.recommendation);
        if (data.isNew) {
          // Refresh history
          fetchAllRecommendations();
        }
      } else {
        setError(data.error || "Failed to generate recommendations");
      }
    } catch (error: any) {
      console.error("Failed to generate recommendations:", error);
      setError(error.message || "An unexpected error occurred");
    } finally {
      setGenerating(false);
    }
  };

  // Update recommendation status
  const updateRecommendationStatus = async (
    recommendationId: string,
    newStatus: string
  ) => {
    if (!supabase) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/medicine-recommendations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recommendationId,
          status: newStatus,
        }),
      });

      // Update local state
      if (recommendation && recommendation.id === recommendationId) {
        setRecommendation({ ...recommendation, status: newStatus as any });
      }

      // Refresh history
      fetchAllRecommendations();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  useEffect(() => {
    fetchLabReports();
    fetchAllRecommendations();
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      checkExistingRecommendation(selectedReportId);
    } else {
      setRecommendation(null);
    }
  }, [selectedReportId]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-500", icon: Clock, label: "Pending Review" },
      reviewed: { color: "bg-blue-500", icon: CheckCircle, label: "Reviewed" },
      prescribed: { color: "bg-green-500", icon: CheckCircle, label: "Prescribed" },
      declined: { color: "bg-red-500", icon: XCircle, label: "Declined" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto mobile-card-spacing">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Pill className="w-6 h-6 sm:w-8 sm:h-8" />
            Medicine Recommendations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Get AI-powered medication suggestions based on your lab reports
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="generate" className="text-xs sm:text-sm">Generate New</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">History</TabsTrigger>
        </TabsList>

        {/* Generate New Recommendations Tab */}
        <TabsContent value="generate" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
              <CardTitle className="text-base sm:text-lg">Select Lab Report</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Choose a lab report to generate medicine recommendations. Only reports with AI analysis are available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
              {/* Report Selector Box with Border */}
              <div className="border-2 border-primary/30 rounded-lg p-3 sm:p-4 bg-primary/5">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  💊 Select Your Lab Report for Medicine Recommendations
                </label>
                <Select
                  value={selectedReportId}
                  onValueChange={setSelectedReportId}
                >
                  <SelectTrigger className="w-full text-xs sm:text-sm border-2 border-primary/40 focus:ring-2 focus:ring-primary/30">
                    <SelectValue placeholder="Select a lab report..." />
                  </SelectTrigger>
                  <SelectContent>
                    {labReports.length === 0 ? (
                      <SelectItem value="none" disabled className="text-xs sm:text-sm">
                        No lab reports available. Upload a report first.
                      </SelectItem>
                    ) : (
                      labReports.map((report) => (
                        <SelectItem key={report.id} value={report.id} className="text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="truncate">{report.file_name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({new Date(report.uploaded_at).toLocaleDateString()})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedReportId && !loading && !recommendation && (
                <Button
                  onClick={generateRecommendations}
                  disabled={generating}
                  className="w-full text-xs sm:text-sm"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Generating Recommendations...</span>
                      <span className="sm:hidden">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Pill className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      <span className="hidden sm:inline">Generate Medicine Recommendations</span>
                      <span className="sm:hidden">Generate</span>
                    </>
                  )}
                </Button>
              )}

              {error && (
                <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-red-800">{error}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {loading && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          )}

          {recommendation && !loading && (
            <div className="space-y-4 sm:space-y-6">
              {/* Disclaimer */}
              <Card className="border-2 border-amber-500 bg-amber-50">
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm sm:text-base text-amber-900">
                        Important Medical Disclaimer
                      </h3>
                      <p className="text-xs sm:text-sm text-amber-800">
                        {recommendation.disclaimer_note}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status and Metadata */}
              <Card>
                <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">Recommendation Details</CardTitle>
                    {getStatusBadge(recommendation.status)}
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    Generated {new Date(recommendation.created_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* General Advice */}
              {recommendation.general_advice && (
                <Card>
                  <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      General Health Advice
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6">
                    <p className="text-xs sm:text-sm leading-relaxed">
                      {recommendation.general_advice}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Medications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    Recommended Medications ({recommendation.medications.length})
                  </CardTitle>
                  <CardDescription>
                    AI-suggested medications based on your lab report findings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {recommendation.medications.map((med, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-3 hover:border-primary transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{med.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {med.purpose}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Dosage:</span>
                          <p className="text-muted-foreground">{med.dosage}</p>
                        </div>
                        <div>
                          <span className="font-medium">Frequency:</span>
                          <p className="text-muted-foreground">{med.frequency}</p>
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span>
                          <p className="text-muted-foreground">{med.duration}</p>
                        </div>
                      </div>

                      {med.precautions && med.precautions.length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="font-medium text-sm flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Precautions:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
                            {med.precautions.map((precaution, idx) => (
                              <li key={idx}>{precaution}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Mark the status of this recommendation to track your progress:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={recommendation.status === "reviewed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateRecommendationStatus(recommendation.id, "reviewed")}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Reviewed
                    </Button>
                    <Button
                      variant={recommendation.status === "prescribed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateRecommendationStatus(recommendation.id, "prescribed")}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Prescribed by Doctor
                    </Button>
                    <Button
                      variant={recommendation.status === "declined" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => updateRecommendationStatus(recommendation.id, "declined")}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendation History</CardTitle>
              <CardDescription>
                View all your past medicine recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allRecommendations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations yet. Generate your first one!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allRecommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedReportId(rec.report_id);
                        setActiveTab("generate");
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {rec.lab_reports?.file_name || "Unknown Report"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {rec.medications.length} medication(s) recommended
                          </p>
                        </div>
                        {getStatusBadge(rec.status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(rec.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(rec.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
