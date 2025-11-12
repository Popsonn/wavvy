# Wavvy Interview Platform MVP

AI-powered video interview platform for recruiters and candidates.

## 🎯 What It Does

- **For Recruiters:** Create AI-generated interview questions, send link to candidates
- **For Candidates:** Record video answers, submit for AI analysis
- **AI Scoring:** Automatic transcription (Groq Whisper), scoring (Groq Llama 70B), feedback generation
- **Results:** Auto-export to Google Sheets + email recruiter with scored results

## 🚀 Live Demo

**Deployed App:** [https://wavvy-opal.vercel.app/]

**Test Credentials:**
- Recruiter email for testing: `[popsondebby@gmail.com]`
- Use [popsondebby@gmail.com] candidate details when registering

## 🛠️ Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** Vercel KV (Redis)
- **Storage:** Vercel Blob (video files)
- **AI:** Groq API (Whisper for transcription, Llama 3.1 70B for scoring)
- **Email:** Resend API
- **Sheets:** Google Sheets API
- **Deployment:** Vercel

## 📋 Features Implemented

### Phase A: Recruiter Setup
- ✅ Interview creation with job details
- ✅ AI question generation based on role/skills
- ✅ Unique shareable interview links

### Phase B: Candidate Experience
- ✅ Registration form (name, email, experience, salary)
- ✅ Video recording interface (3 min per question)
- ✅ Progress tracking (X/5 questions)
- ✅ Re-record functionality
- ✅ Submission confirmation

### Phase C: AI Processing
- ✅ Async background processing (no user wait time)
- ✅ Groq Whisper transcription (~5s per video)
- ✅ AI scoring (0-2 per question, 1.0-9.5 overall)
- ✅ Feedback generation (strengths/weaknesses)

### Phase D: Results Delivery
- ✅ Google Sheets export (one sheet per interview)
- ✅ Recruiter results email (scores, insights, sheet link)
- ✅ Results dashboard (sortable candidate table)

## 🧪 How to Test

### 1. Create an Interview
1. Visit homepage
2. Paste or Fill in job details (title, skills, etc.)
3. Click "Generate Interview"
4. Copy the interview link

### 2. Complete Interview as Candidate
1. Open interview link
2. Register with test details
3. Record answers to 5 questions (speak clearly!)
4. Submit interview

### 3. View Results
- **Email:** Check recruiter email (~5 min after submission)
- **Dashboard:** Visit `/interview/[id]/results`
- **Google Sheet:** Click link in email

## ⚙️ Local Setup (For Reviewers)
```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Run development server
npm run dev
```

**Required API Keys:**
- Groq API (free tier: https://console.groq.com)
- Resend API (free tier: https://resend.com)
- Google Cloud (Sheets API + Service Account)
- Vercel KV + Blob (auto-configured on Vercel)

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

## 🎥 Key Features Highlights

### Async Processing
User submits → instant confirmation → AI processes in background (2-5 min)

### Smart Scoring Rubric
- 0 = Poor (off-topic, incoherent)
- 1 = Acceptable (basic understanding)
- 2 = Excellent (detailed, structured, with examples)

### Professional UX
- Clean, modern interface
- Real-time progress tracking
- Instant feedback
- Mobile-responsive

## 🔒 Security & Privacy

- Video uploads secured with Vercel Blob
- Environment variables for sensitive keys
- Service account for Google Sheets access
- Data expires after 30 days (configurable)

## 📈 Scalability Considerations

- Serverless architecture (auto-scales)
- Async processing (no blocking)
- CDN-cached static assets
- Optimized database queries

## 🐛 Known Limitations (MVP)

- No authentication (public interview links)
- Single recruiter email (no multi-tenant)
- New sheet per interview (not reused)
- Limited error retry logic
- No video playback in dashboard (links only)

## 🚀 Future Enhancements

- [ ] Multi-tenant with authentication
- [ ] Video playback in results dashboard
- [ ] Real-time status updates (WebSockets)
- [ ] Bulk candidate comparison
- [ ] Custom scoring rubrics
- [ ] Interview scheduling
- [ ] Payment integration (Stripe)

## 📝 Notes for Reviewers

**Focus Areas:**
- End-to-end flow (create → record → AI scoring → results)
- Code organization and TypeScript usage
- Async processing architecture
- Error handling
- User experience

**Testing Tips:**
- Speak clearly when recording (affects transcription quality)
- Use the "excellent" example answers for best AI scores
- Check email spam folder for results (Resend test mode)

## 📧 Contact

For questions about this project: [Your Email]

---

Built as an MVP demonstration of AI-powered interview automation.