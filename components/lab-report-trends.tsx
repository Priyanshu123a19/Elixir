"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface LabReport {
  id: string;
  file_name: string;
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
  uploaded_at: string;
}

interface TrendData {
  date: string;
  value: number;
  status: string;
}

interface LabReportTrendsProps {
  report: LabReport;
  allReports: LabReport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabReportTrends({
  report,
  allReports,
  open,
  onOpenChange,
}: LabReportTrendsProps) {
  const [trendData, setTrendData] = useState<Map<string, TrendData[]>>(
    new Map()
  );

  useEffect(() => {
    if (open) {
      generateTrendData();
    }
  }, [open, report, allReports]);

  const generateTrendData = () => {
    const trends = new Map<string, TrendData[]>();

    // Get all test parameters from current report
    const currentTests = report.structured_data?.testResults || [];

    currentTests.forEach((test) => {
      const parameterName = test.name;
      const data: TrendData[] = [];

      // Find this parameter in all reports
      allReports
        .sort(
          (a, b) =>
            new Date(a.uploaded_at).getTime() -
            new Date(b.uploaded_at).getTime()
        )
        .forEach((rep) => {
          const testResult = rep.structured_data?.testResults?.find(
            (t) => t.name === parameterName
          );

          if (testResult) {
            const numericValue = parseFloat(
              testResult.value.replace(/[^0-9.-]/g, "")
            );

            if (!isNaN(numericValue)) {
              data.push({
                date: new Date(rep.uploaded_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
                value: numericValue,
                status: testResult.status || "normal",
              });
            }
          }
        });

      if (data.length > 1) {
        trends.set(parameterName, data);
      }
    });

    setTrendData(trends);
  };

  const getTrendDirection = (data: TrendData[]) => {
    if (data.length < 2) return "stable";
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const change = ((lastValue - firstValue) / firstValue) * 100;

    if (Math.abs(change) < 5) return "stable";
    return change > 0 ? "up" : "down";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "high":
        return "#f59e0b";
      case "low":
        return "#3b82f6";
      case "critical":
        return "#ef4444";
      default:
        return "#5A7863";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Health Trends Analysis
          </DialogTitle>
          <DialogDescription>
            Track how your lab values have changed over time. Compare results
            from multiple reports to spot trends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Parameters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.structured_data?.testResults?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  In this report
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trending Parameters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trendData.size}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available for comparison
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reports Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allReports.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Historical data points
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trends Charts */}
          {trendData.size > 0 ? (
            <Tabs defaultValue={Array.from(trendData.keys())[0]}>
              <TabsList className="w-full overflow-x-auto flex-wrap h-auto">
                {Array.from(trendData.keys()).map((parameter) => (
                  <TabsTrigger key={parameter} value={parameter}>
                    {parameter}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Array.from(trendData.entries()).map(([parameter, data]) => {
                const trend = getTrendDirection(data);
                const latestValue = data[data.length - 1].value;
                const previousValue = data[data.length - 2]?.value;
                const change = previousValue
                  ? ((latestValue - previousValue) / previousValue) * 100
                  : 0;

                return (
                  <TabsContent key={parameter} value={parameter} className="space-y-4">
                    {/* Parameter Info */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{parameter}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              Latest: {latestValue.toFixed(2)}{" "}
                              {report.structured_data?.testResults?.find(
                                (t) => t.name === parameter
                              )?.unit || ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {trend === "up" && (
                              <Badge variant="outline" className="gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {Math.abs(change).toFixed(1)}%
                              </Badge>
                            )}
                            {trend === "down" && (
                              <Badge variant="outline" className="gap-1">
                                <TrendingDown className="h-3 w-3" />
                                {Math.abs(change).toFixed(1)}%
                              </Badge>
                            )}
                            {trend === "stable" && (
                              <Badge variant="outline">Stable</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={data}>
                            <defs>
                              <linearGradient
                                id={`color${parameter}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#5A7863"
                                  stopOpacity={0.8}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#5A7863"
                                  stopOpacity={0.1}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              style={{ fontSize: "12px" }}
                            />
                            <YAxis style={{ fontSize: "12px" }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(255, 255, 255, 0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#5A7863"
                              strokeWidth={2}
                              fill={`url(#color${parameter})`}
                            />
                          </AreaChart>
                        </ResponsiveContainer>

                        {/* Reference Range */}
                        {report.structured_data?.testResults?.find(
                          (t) => t.name === parameter
                        )?.referenceRange && (
                          <div className="mt-4 p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">
                              Reference Range:{" "}
                              <span className="font-medium text-foreground">
                                {
                                  report.structured_data?.testResults?.find(
                                    (t) => t.name === parameter
                                  )?.referenceRange
                                }
                              </span>
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Data Points Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Historical Values
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {data.map((point, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <span className="text-sm text-muted-foreground">
                                {point.date}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {point.value.toFixed(2)}
                                </span>
                                <Badge
                                  variant={
                                    point.status === "normal"
                                      ? "outline"
                                      : "destructive"
                                  }
                                >
                                  {point.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No trend data available. Upload more reports to see how your
                  health metrics change over time.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
