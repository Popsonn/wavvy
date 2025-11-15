# Wavvy Interview Platform MVP

AI-powered video interview platform that automates candidate screening with intelligent scoring and feedback.

## 🎯 What It Does

**End-to-end AI interview automation:**
- **Recruiters:** Paste job description → AI generates interview questions → Share unique link with candidates
- **Candidates:** Register → Record video answers (3 min/question) → Submit interview
- **AI Processing:** Automatic transcription (Groq Whisper) + scoring (Groq Llama 70B) + feedback generation
- **Results:** Auto-export to Google Sheets + email recruiter with comprehensive candidate analysis

## 🚀 Live Demo

**Deployed App:** https://wavvy-opal.vercel.app/

### Quick Test Flow:
1. Visit homepage and create an interview (paste job details or fill form)
2. Copy the generated interview link
3. Open link in new tab, register as candidate, and record answers
4. Wait ~3-5 minutes for AI processing
5. Check results at https://docs.google.com/spreadsheets/d/15B21-6XSPeTwNsCuuil0p141ly1z3IjltDgmnshLiKM/edit?gid=0#gid=0 (for testing if resend API not configured)

**Note:** Email notifications require Resend API setup (see Environment Setup below)

## 🛠️ Tech Stack

**All Open Source / Free Tier:**
- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** Vercel KV (Redis)
- **Storage:** Vercel Blob (video files)
- **AI:** Groq API (Whisper for transcription, Llama 3.3 70B for scoring)
- **Email:** Resend API
- **Sheets:** Google Sheets API
- **Deployment:** Vercel

## 📋 Implemented Features

### ✅ Phase 1 Requirements Met

**A. Recruiter Setup**
- Simple interview configuration form (job title, seniority, skills, responsibilities)
- AI-powered question generation based on role template
- Auto-generated unique candidate links
- Support for custom questions

**B. Candidate Experience**
- Registration micro-form (name, email, years of experience, salary expectations)
- Professional video recording interface:
  - Self-view window
  - Current question display
  - Progress tracking (X/5 questions)
  - 3-minute timer per question
  - Re-record functionality
- Submission confirmation with email receipt

**C. AI & Scoring**
- Groq Whisper transcription (~5s per video)
- LLM-based scoring rubric (0-2 per question):
  - 0 = Poor (off-topic, incoherent)
  - 1 = Acceptable (basic understanding)
  - 2 = Excellent (detailed, structured, with examples)
- Overall grade normalized to 1.0-9.5 scale
- Auto-generated feedback (strengths, areas to improve)
- Context-aware evaluation based on role seniority and candidate experience

**D. Outputs & Operations**
- Google Sheets export (one sheet per interview):
- Recruiter email notifications with results summary

**E. Guardrails (MVP-level)**
- Basic retention (data expires after 30 days - configurable)
- Camera/mic permissions check
- Random question ordering (anti-cheating)
- Async processing (no user wait time during submission)

## ⚙️ Environment Setup

### Required API Keys (All Free Tier Available)

1. **Groq API** (Transcription + Scoring)
   - Sign up: https://console.groq.com
   - Get API key from dashboard
   - Add to `.env.local`: `GROQ_API_KEY=your_key`

2. **Resend API** (Email Notifications)
   - Sign up: https://resend.com
   - Verify your sender domain or use test mode
   - Add to `.env.local`: `RESEND_API_KEY=your_key`
   - **Important:** Update `FROM_EMAIL` in `.env.local` to your verified email

3. **Google Sheets API** (Results Export)
   - Create project: https://console.cloud.google.com
   - Enable Google Sheets API
   - Create Service Account → Download JSON key
   - Add credentials to `.env.local`:
```
     GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
```
   - Create a Google Sheet and share it with service account email (Editor access)
   - Add sheet ID to `.env.local`: `GOOGLE_SHEET_ID=your_sheet_id`

4. **Vercel KV & Blob** (Database & Storage)
   - Auto-configured when deploying to Vercel
   - For local dev: Create KV database in Vercel dashboard → Copy env vars

### Local Setup
```bash
# Clone repository
git clone <your-repo-url>
cd wavvy-mvp

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your API keys to .env.local (see above)

# Run development server
npm run dev
```

Visit `http://localhost:3000`

## 🧪 Testing Guide

### Full Flow Test

**1. Create Interview (Recruiter)**
```
1. Go to homepage
2. Paste job description OR fill form manually:
   - Job Title: "Senior Software Engineer"
   - Seniority: "Senior"
   - Skills: "React, TypeScript, System Design"
   - Responsibilities: "Lead frontend team, architect scalable solutions"
3. Click "Generate Interview"
4. Copy interview link
```

**2. Complete Interview (Candidate)**
```
1. Open interview link in new browser/incognito
2. Register:
   - Name: "Test Candidate"
   - Email: "test@example.com"
   - Years of Experience: 6
   - Salary Expectations: ₦120,000"
3. Allow camera/mic permissions
4. Record answer for each question (speak clearly!)
5. Click "Next Question" after each recording
6. Submit interview on final question
```

**3. View Results (Recruiter)**
```
Wait 3-5 minutes for AI processing, then:
- Visit `/interview/[id]/results` dashboard
- Check Google Sheet (auto-updated)
- Check email (if Resend configured)
```

### Testing Without Email Setup

If you haven't configured Resend:
- Results still save to database and Google Sheets
- Access results directly via https://docs.google.com/spreadsheets/d/15B21-6XSPeTwNsCuuil0p141ly1z3IjltDgmnshLiKM/edit?gid=0#gid=0 (on request only)
- Email notifications will fail silently (check console logs)

## 📁 Project Structure
```
WAVVY-MVP/
├── .next/
├── app/
│   ├── api/
│   │   ├── extract-job-info/
│   │   │   └── route.ts
│   │   ├── generate-interview/
│   │   │   └── route.ts
│   │   └── interview/[interview_id]/
│   │       ├── candidate/
│   │       │   ├── status/
│   │       │   │   └── route.ts
│   │       │   └── route.ts
│   │       ├── candidates/
│   │       │   └── route.ts
│   │       ├── process/
│   │       │   └── route.ts
│   │       ├── send_confirmation/
│   │       │   └── route.ts
│   │       ├── upload/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── interview/[interview_id]/
│   │   ├── complete/
│   │   │   └── page.tsx
│   │   ├── record/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── results/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── videoRecorder.tsx
├── lib/
│   ├── utils/
│   │   └── video.ts
│   ├── db.ts
│   ├── email.ts
│   ├── groq.ts
│   ├── roleMapper.ts
│   ├── scoring.ts
│   ├── sheets.ts
│   ├── transcription.ts
│   └── utils.ts
├── node_modules/
├── public/
├── .env.example
├── .env.local
├── .gitignore
├── eslint.config.mjs
├── LICENSE
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── README.md
├── requirements.txt
└── tsconfig.json
```

## 🔒 Security & Privacy

- Video uploads secured via Vercel Blob signed URLs
- Environment variables for all sensitive keys
- Service account authentication for Google Sheets
- Automatic data expiration (30 days default)
- No candidate data shared without consent

## 🎯 Success Criteria (Phase 1)

✅ **Recruiter can set up interview in <2 minutes**
✅ **AI generates relevant questions based on job context**
✅ **Candidates complete interview without technical issues**
✅ **Consistent scoring** (same answer → similar score across runs)
✅ **Stable media capture** across Chrome, Firefox
✅ **Results auto-export** to Google Sheets with all required columns
✅ **Processing completes in <5 minutes** per candidate


## 🚀 Deployment

**Vercel (Recommended):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Create KV database in Vercel Storage section
```

---

**Built with 100% open-source technologies as an MVP demonstration of AI-powered interview automation.**