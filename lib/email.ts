import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev'
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Email sending failed:', error);
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
}

// Helper for health-related notifications
export async function sendHealthNotification({
  to,
  notificationType,
  data
}: {
  to: string;
  notificationType: 'lab_report' | 'appointment' | 'medication' | 'note';
  data: any;
}) {
  const subjects = {
    lab_report: 'New Lab Report Available',
    appointment: 'Appointment Reminder',
    medication: 'Medication Reminder',
    note: 'Health Note Updated'
  };

  const htmlTemplates = {
    lab_report: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your Lab Report is Ready</h2>
        <p>A new lab report has been uploaded to your Elixir Health account.</p>
        <p><strong>Date:</strong> ${data.date || 'N/A'}</p>
        <p><strong>Report:</strong> ${data.fileName || 'Lab Report'}</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/lab-reports" 
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Your Report
          </a>
        </p>
      </div>
    `,
    appointment: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Appointment Reminder</h2>
        <p>${data.message}</p>
        <p><strong>Date:</strong> ${data.date || 'N/A'}</p>
        <p><strong>Time:</strong> ${data.time || 'N/A'}</p>
      </div>
    `,
    medication: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Medication Reminder</h2>
        <p>${data.message}</p>
        <p><strong>Medication:</strong> ${data.medication || 'N/A'}</p>
        <p><strong>Dosage:</strong> ${data.dosage || 'N/A'}</p>
      </div>
    `,
    note: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Health Note Updated</h2>
        <p>Your health note has been updated in Elixir Health.</p>
        <p><strong>Title:</strong> ${data.title || 'Health Note'}</p>
        <p><strong>Date:</strong> ${data.date || 'N/A'}</p>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/notes" 
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            View Your Notes
          </a>
        </p>
      </div>
    `
  };

  return sendEmail({
    to,
    subject: subjects[notificationType],
    html: htmlTemplates[notificationType]
  });
}

// Helper for sending welcome emails
export async function sendWelcomeEmail(to: string, userName?: string) {
  return sendEmail({
    to,
    subject: 'Welcome to Elixir Health',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Elixir Health${userName ? `, ${userName}` : ''}!</h2>
        <p>Thank you for joining Elixir Health. We're excited to help you manage your health data.</p>
        <h3 style="color: #555;">What you can do:</h3>
        <ul style="line-height: 1.6;">
          <li>Upload and analyze lab reports</li>
          <li>Keep secure health notes</li>
          <li>Chat with our AI health assistant</li>
          <li>Track your health over time</li>
        </ul>
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}" 
             style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Get Started
          </a>
        </p>
      </div>
    `
  });
}
