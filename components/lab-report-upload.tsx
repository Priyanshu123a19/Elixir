"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LabReportUploadProps {
  onUploadSuccess?: () => void;
}

export function LabReportUpload({ onUploadSuccess }: LabReportUploadProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type === "application/pdf" ||
        selectedFile.name.endsWith(".pdf")
      ) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please select a PDF file");
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !supabase) {
      setError("Please select a file and ensure you're signed in");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Get current user first
      const {
        data: { user: userData },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Auth error:", userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }

      if (!userData) {
        throw new Error("Please sign in to upload lab reports");
      }

      // Note: Email confirmation check removed - Supabase might allow unconfirmed users
      // depending on project settings. We'll let the server handle auth validation.

      // Try to get session
      let session = null;
      const {
        data: { session: sessionData },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
      }

      if (sessionData) {
        session = sessionData;
      } else {
        // If no session, try to refresh it
        try {
          const {
            data: { session: refreshedSession },
          } = await supabase.auth.refreshSession();
          session = refreshedSession;
        } catch (refreshError) {
          console.error("Refresh session error:", refreshError);
        }
      }

      if (!session || !session.access_token) {
        // User exists but no session - they need to sign in
        setError(
          "No active session. Please sign in to upload lab reports. If you just signed up, check your email to confirm, then sign in."
        );
        // Redirect to auth page after a short delay
        setTimeout(() => {
          router.push("/auth");
        }, 2000);
        setUploading(false);
        return;
      }

      const user = userData;

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("userId", user.id);

      // Upload to API with auth token
      const response = await fetch("/api/lab/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || "Failed to upload lab report"
        );
      }

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      // Success!
      console.log("Upload successful:", data);
      setFile(null);
      setError(null);

      // Show success message briefly before closing
      setError("Upload successful! Refreshing...");
      setTimeout(() => {
        setOpen(false);
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 1000);

      // Refresh the reports list immediately
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload lab report");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Upload Report
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Lab Report</DialogTitle>
          <DialogDescription>
            Upload a PDF of your lab test results. We'll extract the content and
            provide AI-powered analysis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!file ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your lab report PDF here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="lab-report-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Select PDF File
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div
              className={`rounded-lg border p-3 ${
                error.includes("successful")
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm ${
                  error.includes("successful")
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {error}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFile(null);
                setError(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Analyze
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
