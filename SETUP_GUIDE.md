# Elixir Health - Environment Setup Guide

## 🎉 Migration Complete!

Your application has been successfully migrated from Google Cloud OAuth and Scalekit SSO to a simpler email/password authentication with Resend for email notifications.

## 📋 What Changed

### ✅ Removed
- ❌ Google OAuth (Gmail sign-in)
- ❌ Scalekit SSO integration
- ❌ `@scalekit-sdk/node` package
- ❌ Gmail API routes
- ❌ Scalekit library files

### ✅ Added
- ✨ Resend email service integration
- ✨ New email API route (`/api/email/send`)
- ✨ Email notification functionality
- ✨ Simplified authentication (email/password only)

## 🔑 Required Environment Variables

You need to add **2 new environment variables** to your `.env.local` file:

### 1. RESEND_API_KEY (Required for emails)

**Get your Resend API key:**
1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Copy the key (starts with `re_`)

**Free Tier:**
- ✅ 100 emails per day
- ✅ 3,000 emails per month
- ✅ No credit card required

Add to `.env.local`:
```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

### 2. EMAIL_FROM_ADDRESS (Required for emails)

**For Testing (use immediately):**
```bash
EMAIL_FROM_ADDRESS=onboarding@resend.dev
```

**For Production (requires domain verification):**
1. Add your domain in Resend dashboard
2. Verify DNS records
3. Use your domain email:
```bash
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

### 3. SUPABASE_SERVICE_ROLE_KEY (Optional but recommended)

This is needed for server-side auth operations. Get it from:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **service_role key** (secret)

⚠️ **Warning:** Keep this key secret! Never commit to Git.

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## 📝 Complete .env.local Template

```bash
# ============================================
# Supabase Configuration (REQUIRED)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://mtqqahfppwqycreebpsn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_existing_anon_key

# Optional but recommended for server-side operations
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ============================================
# AI Configuration (REQUIRED for AI features)
# ============================================
GEMINI_API_KEY=your_existing_gemini_key

# ============================================
# Email Configuration (REQUIRED for emails)
# ============================================
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM_ADDRESS=onboarding@resend.dev

# ============================================
# Application Configuration
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Quick Start

### 1. Get Resend API Key (5 minutes)

```bash
# 1. Visit https://resend.com and sign up
# 2. Create API key
# 3. Add to .env.local:
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=onboarding@resend.dev
```

### 2. Restart Development Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 3. Test Email Functionality

1. Open your app at `http://localhost:3000`
2. Sign in with email/password
3. Go to **Lab Reports** page
4. Click **Email Notifications** button
5. Click **Send Test Email**
6. Check your inbox!

## 🎯 What Works Now

### ✅ Authentication
- **Email/Password sign-in** - Works perfectly with Supabase
- **User sessions** - All existing auth flows intact
- **Protected routes** - No changes needed

### ✅ Features
- **Lab Reports** - Upload, view, AI analysis (unchanged)
- **Health Notes** - Create, edit, delete (unchanged)
- **AI Chatbot** - Chat functionality (unchanged)
- **Email Notifications** - NEW! Send emails for:
  - Lab report uploads
  - Health note updates
  - Welcome emails
  - Custom notifications

### ✅ Components Updated
- **Auth Page** - Simplified to email/password only
- **Gmail Connector** - Renamed to Email Notifications
- **User Menu** - Works exactly as before
- **All other pages** - No changes required!

## 📧 Using Email Functionality

### Send Email from Code

```typescript
import { sendEmail } from "@/lib/email";

// Simple email
await sendEmail({
  to: "user@example.com",
  subject: "Test Email",
  html: "<h1>Hello!</h1><p>This is a test email.</p>"
});
```

### Send Health Notifications

```typescript
import { sendHealthNotification } from "@/lib/email";

// Lab report notification
await sendHealthNotification({
  to: user.email,
  notificationType: "lab_report",
  data: {
    date: "2024-01-15",
    fileName: "Blood Test Results"
  }
});

// Health note notification
await sendHealthNotification({
  to: user.email,
  notificationType: "note",
  data: {
    title: "Daily Health Log",
    date: "2024-01-15"
  }
});
```

### Send Welcome Email

```typescript
import { sendWelcomeEmail } from "@/lib/email";

await sendWelcomeEmail(user.email, user.name);
```

## 🔒 Security Notes

### What's Secure:
- ✅ Resend uses industry-standard TLS encryption
- ✅ API keys are stored in environment variables
- ✅ Email validation happens server-side
- ✅ User authentication required for all email operations

### Best Practices:
- 🔐 Never commit `.env.local` to Git
- 🔐 Use different API keys for dev/production
- 🔐 Rotate API keys periodically
- 🔐 Monitor Resend dashboard for suspicious activity

## 🐛 Troubleshooting

### Email not sending?

**Check:**
1. ✅ `RESEND_API_KEY` is set correctly
2. ✅ `EMAIL_FROM_ADDRESS` is `onboarding@resend.dev` (for testing)
3. ✅ Server restarted after adding env vars
4. ✅ User is authenticated

**Debug:**
```bash
# Check environment variables
node -e "console.log(process.env.RESEND_API_KEY)"

# Check Resend dashboard for logs
https://resend.com/logs
```

### Authentication not working?

**Check:**
1. ✅ Supabase env vars are correct
2. ✅ Email/password entered correctly
3. ✅ User account exists in Supabase

**Debug:**
```bash
# Check Supabase Auth logs
https://app.supabase.com/project/_/auth/users
```

### Rate limits?

**Resend Free Tier Limits:**
- 100 emails per day
- 3,000 emails per month

**Solution:**
- Upgrade to Resend Pro ($20/month for 50K emails)
- Or use a different email service (SendGrid, Postmark)

## 📚 API Endpoints

### POST /api/email/send

Send a custom email (authenticated users only).

**Request:**
```json
{
  "to": "user@example.com",
  "subject": "Your Subject",
  "html": "<h1>Email content</h1>"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": { "id": "email_id" }
}
```

## 🎓 Next Steps

### 1. Get Production Ready
- [ ] Add custom domain to Resend
- [ ] Update `EMAIL_FROM_ADDRESS` to your domain
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Update `NEXT_PUBLIC_APP_URL` for production

### 2. Add More Features
- [ ] Email verification on signup
- [ ] Password reset via email
- [ ] Appointment reminders
- [ ] Weekly health summary emails

### 3. Monitor & Optimize
- [ ] Set up Resend webhooks
- [ ] Track email open rates
- [ ] Monitor delivery status
- [ ] Add unsubscribe functionality

## 💡 Tips

### Email Best Practices:
- ✉️ Keep subject lines under 50 characters
- ✉️ Use responsive HTML templates
- ✉️ Include unsubscribe links (for production)
- ✉️ Test emails before sending to users

### Performance:
- ⚡ Send emails asynchronously (don't block UI)
- ⚡ Batch emails when possible
- ⚡ Use queue systems for high volume

## 📞 Support

### Resend Support:
- Documentation: [resend.com/docs](https://resend.com/docs)
- Email: support@resend.com
- Discord: [resend.com/discord](https://resend.com/discord)

### Supabase Support:
- Documentation: [supabase.com/docs](https://supabase.com/docs)
- Discord: [discord.supabase.com](https://discord.supabase.com)

## ✨ Summary

Your Elixir Health application is now running with:
- ✅ Simple email/password authentication (Supabase)
- ✅ Email notifications (Resend)
- ✅ No Google Cloud Console dependencies
- ✅ No Scalekit SSO complexity
- ✅ All existing features working

**You only need to add 2 environment variables:**
1. `RESEND_API_KEY` (get from resend.com)
2. `EMAIL_FROM_ADDRESS` (use `onboarding@resend.dev` for testing)

That's it! 🎉
