import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { saveInterview } from '@/lib/db';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface InterviewConfig {
  job_title: string;
  industry?: string;
  location?: string;
  seniority?: string;
  job_type?: string;
  work_model?: string;
  role_template: string;
  key_responsibilities?: string[];
  required_skills?: string[];
  custom_questions?: string;
  num_questions: number;
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export async function POST(req: NextRequest) {
  try {
    const config: InterviewConfig = await req.json();

    if (!config.job_title?.trim()) {
      return NextResponse.json(
        { error: "Job title is required" },
        { status: 400 }
      );
    }

    const contextInfo = buildContextInfo(config);
    const prompt = buildPrompt(contextInfo, config);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const questionsText = completion.choices[0]?.message?.content || '';
    const questions = parseQuestions(questionsText);

    if (questions.length < 3) {
      return NextResponse.json(
        { error: "Failed to generate valid questions. Please try again." },
        { status: 500 }
      );
    }

    const interviewId = crypto.randomUUID().slice(0, 8);
    const baseUrl = getBaseUrl();
    const interviewLink = `${baseUrl}/interview/${interviewId}`;

    await saveInterview(interviewId, {
      job_title: config.job_title,
      industry: config.industry,
      location: config.location,
      seniority: config.seniority,
      job_type: config.job_type,
      work_model: config.work_model,
      role_template: config.role_template,
      key_responsibilities: config.key_responsibilities,
      required_skills: config.required_skills,
      custom_questions: config.custom_questions,
      questions: questions,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      interview_id: interviewId,
      questions: questions,
      interview_link: interviewLink
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function buildContextInfo(config: InterviewConfig): string {
  let context = `Job Title: ${config.job_title}`;
  
  if (config.industry) context += `\nIndustry: ${config.industry}`;
  if (config.seniority) context += `\nSeniority Level: ${config.seniority}`;
  if (config.job_type) context += `\nJob Type: ${config.job_type}`;
  if (config.work_model) context += `\nWork Model: ${config.work_model}`;

  if (config.key_responsibilities?.length) {
    context += `\nKey Responsibilities:\n${config.key_responsibilities.map(r => `- ${r}`).join('\n')}`;
  }

  if (config.required_skills?.length) {
    context += `\nRequired Skills:\n${config.required_skills.map(s => `- ${s}`).join('\n')}`;
  }

  return context;
}

function buildPrompt(contextInfo: string, config: InterviewConfig): string {
  return `You are an expert recruiter generating interview questions for a professional-level position.

Here is the job context:

${contextInfo}

Role Template: ${config.role_template}

Custom Questions / Topics: ${config.custom_questions || 'None'}

YOUR TASK: Generate ${config.num_questions} targeted interview questions for this role.

GUIDELINES:

1. Responsibility-Based Questions
   - Focus on the listed responsibilities
   - Create scenario-based or behavioral questions where candidates explain how they would handle tasks in realistic situations
   - Keep questions focused on one main scenario
   - If a responsibility or skill lacks detail, make a reasonable, realistic scenario based on professional standards

2. Skill Assessment Questions
   - Test actual proficiency, not just familiarity
   - Include practical or problem-solving scenarios

3. Seniority-Based Complexity
   - Junior: Clear, guided scenarios
   - Mid-level: Multi-step scenarios with trade-offs
   - Senior: Strategic scenarios requiring judgment and prioritization

4. Trade-Offs & Judgment
   - Prioritize core job responsibilities first
   - If the role involves customer interaction, financial handling, sensitive data, compliance, safety, or risk — consider including a realistic trade-off or ethical scenario
   - Do not force trade-offs where they do not naturally apply
   - Adjust scenario complexity based on seniority level

5. Follow-Up / Probing Questions
   - For a few questions (not all), add a brief follow-up probe in parentheses to encourage deeper reflection
   - If including a follow-up, add it in parentheses on the SAME line as the main question
   - Keep follow-ups concise (typically around 10-15 words)

6. Custom Topics
   - If custom topics are provided, incorporate them naturally into questions

7. Question Quality Standards
   - Questions should be concise and answerable in a 2-3 minute video response (typically 40-60 words)
   - Avoid compound questions (multiple questions in one)
   - Avoid generic questions like "Tell me about yourself" or "What are your strengths?"
   - Avoid yes/no questions or overly broad questions
   - Questions should be specific to the role, not generic

With only ${config.num_questions} questions to generate, prioritize the most critical competencies for the role.

Trust your professional judgment to create meaningful, role-specific questions that are well-suited for a video interview format.

Output Format:
- Each question must start with a number followed by a period (1., 2., 3., ...)
- If including a follow-up probe, add it in parentheses on the SAME line
- Example: 1. Describe a time you prioritized conflicting tasks. (What would you do differently?)
- Return ONLY the numbered questions, no extra text`;
}

function parseQuestions(text: string): string[] {
  return text
    .split('\n')
    .filter(q => q.trim() && /^\d+\./.test(q.trim()))
    .map(q => q.trim());
}