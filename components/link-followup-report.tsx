"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Calendar
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface LabReport {
  id: string;
  file_name: string;
  uploaded_at: string;
  structured_data?: {
    testType?: string;
    date?: string;
  };
}

interface LinkFollowupReportProps {
  baselineReportId: string;
  onProgressAnalyzed?: (data: any) => void;
  triggerButton?: React.ReactNode;
}

export function LinkFollowupReport({
  baselineReportId,
  onProgressAnalyzed,
  triggerButton,
}: LinkFollowupReportProps) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [progressResult, setProgressResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      fetchReports();
    }
  }, [open]);

  const fetchReports = async () => {
    if (!supabase) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/lab/reports?userId=${user.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Filter out the baseline report itself
        const otherReports = (data.labReports || []).filter(
          (r: LabReport) => r.id !== baselineReportId
        );
        setReports(otherReports);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAndAnalyze = async () => {
    if (!selectedReportId || !supabase) return;

    try {
      setAnalyzing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch("/api/lab/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          baselineReportId,
          followupReportId: selectedReportId,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setProgressResult(data.progressAnalysis);
        if (onProgressAnalyzed) {
          onProgressAnalyzed(data);
        }
        // Don't auto-close - let user close manually to review progress
      } else {
        alert("Failed to analyze progress: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error linking follow-up report:", error);
      alert("An error occurred while analyzing progress");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Link Follow-up Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Link Follow-up Lab Report
          </DialogTitle>
          <DialogDescription>
            Select a newer lab report to track your progress and see how your health
            goals are progressing
          </DialogDescription>
        </DialogHeader>

        {analyzing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Analyzing Progress...</p>
              <p className="text-sm text-muted-foreground">
                Comparing your lab results and updating health goals
              </p>
            </div>
          </div>
        )}

        {progressResult && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <div>
                <p className="font-semibold text-lg">{progressResult.celebration_message}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {progressResult.overall_summary}
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {progressResult.achievement_rate}% Achievement Rate
              </Badge>
            </div>

            {/* Show top improvements */}
            {progressResult.progress_items && progressResult.progress_items.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm font-medium text-center mb-3">Key Changes:</p>
                {progressResult.progress_items.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.metric_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.baseline_value} → {item.followup_value} {item.unit}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.status === "improved" || item.status === "normalized"
                          ? "default"
                          : item.status === "worsened"
                          ? "destructive"
                          : "secondary"
                      }
                      className="ml-2"
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="default"
                onClick={() => {
                  setOpen(false);
                  setProgressResult(null);
                  setSelectedReportId(null);
                  setNotes("");
                }}
                className="flex-1"
              >
                Done - View Updated Goals
              </Button>
            </div>
          </div>
        )}

        {!analyzing && !progressResult && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No other lab reports found</p>
                <p className="text-sm">Upload a new report first</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">
                    Select follow-up report:
                  </p>
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedReportId === report.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {report.structured_data?.testType || report.file_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {report.structured_data?.date ||
                              new Date(report.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      {selectedReportId === report.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Notes (Optional)
                  </label>
                  <Textarea
                    placeholder="Add any notes about this follow-up (e.g., 'After 3 months of dietary changes')"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <p className="text-muted-foreground">
                    We'll compare the reports, track progress on your health goals,
                    and show improvement metrics
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkAndAnalyze}
                    disabled={!selectedReportId}
                    className="flex-1"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Analyze Progress
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
