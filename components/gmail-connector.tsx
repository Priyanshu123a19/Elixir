"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  Loader2,
  CheckCircle2,
  Bell,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase-client";

export function GmailConnector() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSendTestEmail = async () => {
    if (!supabase) {
      alert("Email service not configured");
      return;
    }

    setIsLoading(true);
    setEmailSent(false);

    try {
      const { data: { user }, data: { session } } = await supabase.auth.getUser();

      if (!user?.email) {
        alert("Please sign in to send test emails");
        setIsLoading(false);
        return;
      }

      // Get session for authorization
      const { data: { session: userSession } } = await supabase.auth.getSession();
      
      if (!userSession?.access_token) {
        alert("Session expired. Please sign in again.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userSession.access_token}`,
        },
        body: JSON.stringify({
          to: user.email,
          subject: "Elixir Health - Email Notifications Enabled",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Email Notifications Enabled</h2>
              <p>You've successfully enabled email notifications for Elixir Health!</p>
              <p>You'll receive updates about:</p>
              <ul style="line-height: 1.8;">
                <li>New lab reports uploaded</li>
                <li>Health note updates</li>
                <li>Important health reminders</li>
              </ul>
              <p style="margin-top: 20px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/lab-reports" 
                   style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                  View Your Dashboard
                </a>
              </p>
            </div>
          `
        }),
      });

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Failed to send email:", error);
      alert(`Failed to send email: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bell className="mr-2 h-4 w-4" />
          Email Notifications
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email Notifications</DialogTitle>
          <DialogDescription>
            Get notified when new lab reports are uploaded or health notes are updated
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Enable Email Notifications
              </CardTitle>
              <CardDescription>
                Receive instant updates about your health data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!emailSent ? (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      We'll send you notifications for:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>New lab reports uploaded to your account</li>
                      <li>Updates to your health notes</li>
                      <li>Important health reminders (coming soon)</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Test Email...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Test Email
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">Test Email Sent!</p>
                    <p className="text-xs text-muted-foreground">
                      Check your inbox for the test notification
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Email notifications are sent securely using Resend. You can manage your
                notification preferences anytime.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
