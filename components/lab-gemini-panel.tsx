"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export function LabGeminiPanel() {
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/lab/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze lab report");
      }
      setAnalysis(data.analysis);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <CardTitle>AI Lab Report Assistant</CardTitle>
        </div>
        <CardDescription>
          Ask questions about your lab reports and get personalized insights. I'll analyze your results in context and explain what they mean for your health.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask me anything about your lab reports, for example:
"What do my cholesterol levels indicate?"
"Are my blood sugar levels in a healthy range?"
"Can you explain my kidney function results?"
"What should I discuss with my doctor based on these results?"`}
          rows={6}
        />
        <div className="flex justify-end">
          <Button onClick={handleAnalyze} disabled={loading || !input.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>Ask</>
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {analysis && (
          <div className="mt-4 border rounded-md p-3 text-sm whitespace-pre-wrap bg-muted/40">
            {analysis
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .replace(/#{1,6}\s+/g, "")
              .replace(/`/g, "")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
