"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, AlertCircle, TrendingUp, CheckCircle, X, Search, FileText, Calendar } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Common symptoms organized by category
const symptomCategories = [
  {
    category: "🤒 General",
    symptoms: [
      "Fatigue",
      "Fever",
      "Weight Loss",
      "Weight Gain",
      "Weakness",
      "Loss of Appetite",
      "Night Sweats",
    ],
  },
  {
    category: "💪 Physical",
    symptoms: [
      "Muscle Pain",
      "Joint Pain",
      "Back Pain",
      "Dizziness",
      "Numbness",
      "Tingling",
      "Swelling",
    ],
  },
  {
    category: "🧠 Mental & Neurological",
    symptoms: [
      "Headache",
      "Difficulty Concentrating",
      "Memory Problems",
      "Mood Changes",
      "Sleep Problems",
      "Anxiety",
      "Depression",
    ],
  },
  {
    category: "🍽️ Digestive",
    symptoms: [
      "Nausea",
      "Vomiting",
      "Diarrhea",
      "Constipation",
      "Abdominal Pain",
      "Bloating",
      "Heartburn",
    ],
  },
  {
    category: "❤️ Cardiovascular",
    symptoms: [
      "Chest Pain",
      "Palpitations",
      "Shortness of Breath",
      "Irregular Heartbeat",
      "Cold Extremities",
    ],
  },
  {
    category: "🫁 Respiratory",
    symptoms: [
      "Cough",
      "Wheezing",
      "Chest Tightness",
      "Rapid Breathing",
    ],
  },
];

interface SelectedSymptom {
  name: string;
  severity: number;
}

interface SymptomAnalysis {
  correlations: Array<{
    symptom: string;
    labValue: string;
    value: string;
    normalRange: string;
    status: string;
    explanation: string;
  }>;
  insights: string;
  recommendations: string[];
  urgencyLevel: "low" | "medium" | "high";
  urgencyMessage: string;
}

interface LabReport {
  id: string;
  file_name: string;
  uploaded_at: string;
  structured_data?: any;
}

export default function SymptomCheckerPage() {
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [loadingReports, setLoadingReports] = useState(true);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SelectedSymptom[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [daysExperiencing, setDaysExperiencing] = useState<string>("");

  useEffect(() => {
    fetchLabReports();
  }, []);

  const fetchLabReports = async () => {
    if (!supabase) return;

    setLoadingReports(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingReports(false);
        return;
      }

      console.log("Fetching lab reports for user:", user.id);

      // Query Supabase directly instead of using API route
      const { data: reports, error } = await supabase
        .from("lab_reports")
        .select("id, file_name, uploaded_at, structured_data")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false });

      if (error) {
        console.error("Error fetching lab reports:", error);
        setLabReports([]);
      } else {
        console.log(`Found ${reports?.length || 0} lab reports`);
        const reportsArray = Array.isArray(reports) ? reports : [];
        setLabReports(reportsArray);
        // Auto-select the most recent report
        if (reportsArray.length > 0) {
          setSelectedReportId(reportsArray[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching lab reports:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  const toggleSymptom = (symptomName: string) => {
    const existing = selectedSymptoms.find((s) => s.name === symptomName);
    if (existing) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s.name !== symptomName));
    } else {
      setSelectedSymptoms([...selectedSymptoms, { name: symptomName, severity: 5 }]);
    }
  };

  const updateSeverity = (symptomName: string, severity: number) => {
    setSelectedSymptoms(
      selectedSymptoms.map((s) =>
        s.name === symptomName ? { ...s, severity } : s
      )
    );
  };

  const analyzeSymptoms = async () => {
    if (selectedSymptoms.length === 0) {
      alert("Please select at least one symptom");
      return;
    }

    if (!selectedReportId) {
      alert("Please select a lab report to analyze");
      return;
    }

    if (!supabase) {
      alert("Database not configured");
      return;
    }

    setAnalyzing(true);
    setAnalysis(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Please sign in to use symptom checker");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Session expired, please sign in again");
        return;
      }

      const response = await fetch("/api/symptom-checker/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          daysExperiencing: parseInt(daysExperiencing) || 0,
          reportId: selectedReportId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Analysis failed");
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Error analyzing symptoms:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze symptoms");
    } finally {
      setAnalyzing(false);
    }
  };

  const filteredSymptoms = symptomCategories.map((category) => ({
    ...category,
    symptoms: category.symptoms.filter((symptom) =>
      symptom.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter((category) => category.symptoms.length > 0);

  const selectedReport = labReports?.find((r) => r.id === selectedReportId);

  return (
    <div className="mobile-card-spacing">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">🏥 Symptom Checker</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Correlate your symptoms with lab values to get personalized insights
        </p>
      </div>

      {/* Report Selection Card */}
      <Card className="border-primary/20">
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            Select Lab Report
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Choose which lab report you want to analyze your symptoms against
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {loadingReports ? (
            <div className="text-center py-4 text-xs sm:text-sm text-muted-foreground">
              Loading your lab reports...
            </div>
          ) : labReports.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                No lab reports found. Please upload a lab report first.
              </p>
              <Button onClick={() => window.location.href = "/lab-reports"} className="text-xs sm:text-sm">
                Upload Lab Report
              </Button>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {/* Report Selector Box with Border */}
              <div className="border-2 border-primary/30 rounded-lg p-3 sm:p-4 bg-primary/5">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  📋 Select Your Lab Report
                </label>
                <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                  <SelectTrigger className="w-full text-xs sm:text-sm border-2 border-primary/40 focus:ring-2 focus:ring-primary/30">
                    <SelectValue placeholder="Select a lab report" />
                  </SelectTrigger>
                  <SelectContent>
                    {labReports.map((report) => (
                      <SelectItem key={report.id} value={report.id} className="text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{report.file_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({new Date(report.uploaded_at).toLocaleDateString()})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedReport && (
                <div className="bg-muted/50 border-2 border-green-500/30 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{selectedReport.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(selectedReport.uploaded_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Only show symptom selection if a report is selected */}
      {selectedReportId && (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        {/* Symptom Selection */}
        <div className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
              <CardTitle className="text-base sm:text-lg">Step 1: Select Your Symptoms</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Choose all symptoms you are currently experiencing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Input
                  placeholder="Search symptoms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 sm:pl-10 text-xs sm:text-sm"
                />
              </div>

              {/* Selected Symptoms */}
              {selectedSymptoms.length > 0 && (
                <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <h3 className="text-xs sm:text-sm font-semibold">Selected Symptoms:</h3>
                  {selectedSymptoms.map((symptom) => (
                    <div key={symptom.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-medium">{symptom.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSymptom(symptom.name)}
                          className="h-7 w-7 p-0 sm:h-8 sm:w-8"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Severity:</span>
                          <span className="font-semibold">{symptom.severity}/10</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={symptom.severity}
                          onChange={(e) =>
                            updateSeverity(symptom.name, parseInt(e.target.value))
                          }
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Symptom Categories */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {filteredSymptoms.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <h3 className="text-sm font-semibold">{category.category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {category.symptoms.map((symptom) => {
                        const isSelected = selectedSymptoms.some(
                          (s) => s.name === symptom
                        );
                        return (
                          <Badge
                            key={symptom}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer hover:bg-primary/20"
                            onClick={() => toggleSymptom(symptom)}
                          >
                            {symptom}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  How many days have you been experiencing these symptoms?
                </label>
                <Input
                  type="number"
                  placeholder="e.g., 7"
                  value={daysExperiencing}
                  onChange={(e) => setDaysExperiencing(e.target.value)}
                  min="0"
                />
              </div>

              <Button
                onClick={analyzeSymptoms}
                disabled={analyzing || selectedSymptoms.length === 0}
                className="w-full"
              >
                {analyzing ? (
                  <>Analyzing...</>
                ) : (
                  <>
                    <Stethoscope className="mr-2 h-4 w-4" />
                    Analyze My Symptoms
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Results */}
        <div className="space-y-4">
          {analysis ? (
            <>
              {/* Urgency Alert */}
              {analysis.urgencyLevel !== "low" && (
                <Card className={`border-2 ${
                  analysis.urgencyLevel === "high" ? "border-red-500" : "border-yellow-500"
                }`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className={`h-5 w-5 ${
                        analysis.urgencyLevel === "high" ? "text-red-600" : "text-yellow-600"
                      }`} />
                      {analysis.urgencyLevel === "high" ? "High Priority" : "Moderate Concern"}
                    </CardTitle>
                    <CardDescription>{analysis.urgencyMessage}</CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Correlations */}
              {analysis.correlations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>🔬 Lab Value Correlations</CardTitle>
                    <CardDescription>
                      These lab values may be related to your symptoms
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.correlations.map((corr, index) => (
                      <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{corr.labValue}</h4>
                            <p className="text-sm text-muted-foreground">
                              May explain: {corr.symptom}
                            </p>
                          </div>
                          <Badge
                            variant={
                              corr.status === "low" || corr.status === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {corr.status}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Your Value:</span>
                            <span className="font-medium">{corr.value}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Normal Range:</span>
                            <span className="font-medium">{corr.normalRange}</span>
                          </div>
                        </div>
                        <p className="text-sm mt-2">{corr.explanation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>💡 AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{analysis.insights}</p>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>✓ Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Disclaimer */}
              <Card className="border-blue-500">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground italic">
                    ⚕️ This analysis is for informational purposes only and is not a medical diagnosis.
                    Always consult with your healthcare provider for proper medical advice, especially
                    if symptoms persist or worsen.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  Select symptoms and click "Analyze My Symptoms" to see correlations
                  with your lab values
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8 text-muted-foreground">
                <Stethoscope className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>No analysis yet</p>
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
