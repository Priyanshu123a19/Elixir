"use client";

import { useState, useEffect } from "react";
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
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Upload,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HealthGoal {
  id: string;
  goal_category: string;
  goal_title: string;
  goal_description: string;
  target_metric?: string;
  target_value?: string;
  priority: string;
  status: string;
  created_at: string;
}

interface ProgressItem {
  metric_name: string;
  baseline_value: string;
  followup_value: string;
  unit: string;
  reference_range: string;
  improvement_percentage: number | null;
  status: string;
  ai_insight: string;
}

interface HealthGoalsViewProps {
  reportId: string;
  onLinkFollowup?: () => void;
}

const categoryIcons: Record<string, string> = {
  diet: "🥗",
  exercise: "💪",
  lifestyle: "🌱",
  medication: "💊",
  monitoring: "📊",
};

const priorityColors: Record<string, string> = {
  critical: "destructive",
  high: "secondary",
  medium: "default",
  low: "outline",
};

const statusLabels: Record<string, { label: string; icon: any }> = {
  completed: { label: "Completed", icon: CheckCircle2 },
  in_progress: { label: "In Progress", icon: TrendingUp },
  active: { label: "Active", icon: Circle },
  not_started: { label: "Not Started", icon: Circle },
};

export function HealthGoalsView({ reportId, onLinkFollowup }: HealthGoalsViewProps) {
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressData, setProgressData] = useState<{
    hasBaseline: boolean;
    hasFollowup: boolean;
    progressItems: ProgressItem[];
    overallSummary?: string;
    achievementRate?: number;
    celebrationMessage?: string;
  } | null>(null);

  useEffect(() => {
    fetchHealthGoals();
    fetchProgressData();
  }, [reportId]);

  const fetchHealthGoals = async () => {
    if (!supabase) {
      console.log("Supabase client not available");
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching health goals for report:", reportId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session found");
        setLoading(false);
        return;
      }

      console.log("Making request to health-goals API...");
      const response = await fetch(`/api/lab/health-goals?reportId=${reportId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Health goals response:", data);
      
      if (data.success) {
        console.log("Setting goals:", data.goals?.length || 0, "goals found");
        setGoals(data.goals || []);
      } else {
        console.error("Failed to fetch goals:", data.error);
      }
    } catch (error) {
      console.error("Error fetching health goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressData = async () => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/lab/progress?reportId=${reportId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setProgressData({
          hasBaseline: data.hasBaseline,
          hasFollowup: data.hasFollowup,
          progressItems: data.progressData || [],
        });
      }
    } catch (error) {
      console.error("Error fetching progress data:", error);
    }
  };

  const generateGoals = async () => {
    if (!supabase) return;

    try {
      setGenerating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session found");
        return;
      }

      const response = await fetch("/api/lab/health-goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId }),
      });

      const data = await response.json();
      if (data.success) {
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error("Error generating health goals:", error);
    } finally {
      setGenerating(false);
    }
  };

  const updateGoalStatus = async (goalId: string, newStatus: string) => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch("/api/lab/health-goals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ goalId, status: newStatus }),
      });

      if (response.ok) {
        setGoals(goals.map(g => g.id === goalId ? { ...g, status: newStatus } : g));
      }
    } catch (error) {
      console.error("Error updating goal status:", error);
    }
  };

  const groupedGoals = goals.reduce((acc, goal) => {
    if (!acc[goal.goal_category]) {
      acc[goal.goal_category] = [];
    }
    acc[goal.goal_category].push(goal);
    return acc;
  }, {} as Record<string, HealthGoal[]>);

  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const totalGoals = goals.length;
  const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Health Goals
          </CardTitle>
          <CardDescription>
            AI-generated health goals based on your lab results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {loading ? "Checking for health goals..." : "No health goals found yet"}
            </p>
            {!loading && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Health goals are automatically generated when you upload a report.
                  <br />
                  If this is a newly uploaded report, they may still be processing.
                </p>
                <Button onClick={generateGoals} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Goals...
                    </>
                  ) : (
                    "Generate Health Goals Now"
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Summary Card - Only show if there's progress data */}
      {progressData && progressData.hasBaseline && progressData.progressItems.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>Progress Update</CardTitle>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {progressData.achievementRate || 0}% Achieved
              </Badge>
            </div>
            {progressData.celebrationMessage && (
              <CardDescription className="text-base font-medium">
                {progressData.celebrationMessage}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progressData.progressItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 border rounded-lg bg-background">
                  <div className="flex-1">
                    <p className="font-medium">{item.metric_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.baseline_value} → {item.followup_value} {item.unit}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.ai_insight}
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
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Goals Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Health Goals
              </CardTitle>
              <CardDescription>
                {completedGoals} of {totalGoals} goals completed ({completionRate}%)
              </CardDescription>
            </div>
            {!progressData?.hasFollowup && (
              <Button onClick={onLinkFollowup} variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Upload Follow-up Report
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Goals by Category */}
          {Object.entries(groupedGoals).map(([category, categoryGoals]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{categoryIcons[category] || "📌"}</span>
                <h4 className="font-semibold capitalize">{category}</h4>
                <Badge variant="outline">{categoryGoals.length}</Badge>
              </div>
              <div className="space-y-2 pl-10">
                {categoryGoals.map((goal) => {
                  const StatusIcon = statusLabels[goal.status]?.icon || Circle;
                  return (
                    <Dialog key={goal.id}>
                      <DialogTrigger asChild>
                        <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                          <StatusIcon
                            className={`h-5 w-5 mt-0.5 ${
                              goal.status === "completed"
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{goal.goal_title}</p>
                              <Badge variant={priorityColors[goal.priority] as any}>
                                {goal.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {goal.goal_description}
                            </p>
                            {goal.target_metric && (
                              <p className="text-xs text-primary mt-2">
                                Target: {goal.target_metric} - {goal.target_value}
                              </p>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <span className="text-2xl">{categoryIcons[category]}</span>
                            {goal.goal_title}
                          </DialogTitle>
                          <DialogDescription className="space-y-4 pt-4">
                            <div>
                              <p className="text-sm text-foreground">{goal.goal_description}</p>
                            </div>
                            {goal.target_metric && (
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Target Metric
                                </p>
                                <p className="font-medium">
                                  {goal.target_metric}: {goal.target_value}
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant={priorityColors[goal.priority] as any}>
                                {goal.priority} priority
                              </Badge>
                              <Badge variant="outline">
                                {statusLabels[goal.status]?.label || goal.status}
                              </Badge>
                            </div>
                            <div className="flex gap-2 pt-4">
                              {goal.status !== "completed" && (
                                <Button
                                  onClick={() => updateGoalStatus(goal.id, "in_progress")}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  disabled={goal.status === "in_progress"}
                                >
                                  Start Working
                                </Button>
                              )}
                              {goal.status !== "completed" && (
                                <Button
                                  onClick={() => updateGoalStatus(goal.id, "completed")}
                                  variant="default"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Mark Complete
                                </Button>
                              )}
                            </div>
                          </DialogDescription>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Note */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                These goals are AI-generated based on your lab results. Always consult
                with your healthcare provider before making significant changes to your
                health routine.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
