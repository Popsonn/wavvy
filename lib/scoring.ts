import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface JobContext {
  jobTitle: string;
  seniority?: string;
  industry?: string;
  roleTemplate?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
}

interface CandidateContext {
  yearsExperience: number;
  candidateName?: string;
}

interface QuestionScore {
  question: string;
  transcript: string;
  score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  experienceGapNote?: string;
}

interface OverallResult {
  questionScores: QuestionScore[];
  overallScore: number;
  overallFeedback: string;
  topStrengths: string[];
  areasToImprove: string[];
}

async function retryAPICall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      const isRetryable = 
        lastError.message?.includes('fetch failed') ||
        lastError.message?.includes('ECONNRESET') ||
        (error as any).status === 429 ||
        (error as any).status >= 500;
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
}

export async function scoreAnswer(
  question: string,
  transcript: string,
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<QuestionScore> {
  try {
    if (transcript.startsWith('[Transcription failed')) {
      return {
        question,
        transcript,
        score: 0,
        reasoning: 'Unable to score - transcription failed',
        strengths: [],
        weaknesses: ['No audio transcript available'],
      };
    }

    const prompt = buildScoringPrompt(question, transcript, jobContext, candidateContext);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer with deep knowledge of various industries and seniority levels. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      })
    );

    const responseText = completion.choices[0]?.message?.content || '{}';
    const evaluation = JSON.parse(responseText);

    return normalizeScoreResult(question, transcript, evaluation);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      question,
      transcript,
      score: 1,
      reasoning: `Scoring failed: ${message}`,
      strengths: [],
      weaknesses: ['Unable to evaluate due to technical error'],
    };
  }
}

export async function generateOverallFeedback(
  questionScores: QuestionScore[],
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<OverallResult> {
  try {
    const totalScore = questionScores.reduce((sum, q) => sum + q.score, 0);
    const averageScore = totalScore / questionScores.length;
    const overallScore = parseFloat((1.0 + (averageScore * 4.25)).toFixed(1));

    const prompt = buildFeedbackPrompt(questionScores, jobContext, candidateContext, averageScore, overallScore);

    const completion = await retryAPICall(() =>
      groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert HR interviewer providing constructive, professional feedback. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      })
    );

    const responseText = completion.choices[0]?.message?.content || '{}';
    const summary = JSON.parse(responseText);

    return {
      questionScores,
      overallScore,
      overallFeedback: summary.overallFeedback || 'Overall performance evaluation completed.',
      topStrengths: Array.isArray(summary.topStrengths)
        ? summary.topStrengths.slice(0, 3)
        : ['Communication', 'Problem-solving', 'Technical knowledge'],
      areasToImprove: Array.isArray(summary.areasToImprove)
        ? summary.areasToImprove.slice(0, 3)
        : ['Could provide more specific examples', 'Time management', 'Confidence'],
    };

  } catch (error) {
    return createFallbackFeedback(questionScores);
  }
}

export async function scoreInterview(
  questions: string[],
  transcripts: string[],
  jobContext: JobContext,
  candidateContext: CandidateContext
): Promise<OverallResult> {
  const questionScores: QuestionScore[] = [];

  for (let i = 0; i < questions.length; i++) {
    const score = await scoreAnswer(questions[i], transcripts[i], jobContext, candidateContext);
    questionScores.push(score);

    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return await generateOverallFeedback(questionScores, jobContext, candidateContext);
}

function getCandidateLevel(yearsExperience: number): string {
  if (yearsExperience < 1) return 'Entry-level';
  if (yearsExperience < 3) return 'Junior';
  if (yearsExperience < 5) return 'Mid-level';
  if (yearsExperience < 8) return 'Senior';
  return 'Lead/Manager';
}

function getTypicalYearsForLevel(seniority: string): number {
  const level = seniority?.toLowerCase() || '';
  if (level.includes('entry')) return 0;
  if (level.includes('junior')) return 1;
  if (level.includes('senior')) return 5;
  if (level.includes('lead') || level.includes('manager')) return 8;
  return 3;
}

function getSeniorityExpectations(seniority: string): string {
  const level = seniority?.toLowerCase() || '';
  
  if (level.includes('entry')) {
    return 'For Entry-level roles: Prioritize foundational knowledge, eagerness to learn, and cultural fit. Candidates should demonstrate basic understanding and potential for growth.';
  }
  if (level.includes('junior')) {
    return 'For Junior roles: Look for fundamental skills, learning mindset, and ability to execute with guidance. Candidates should show they can handle core responsibilities with mentorship.';
  }
  if (level.includes('senior')) {
    return 'For Senior roles: Expect strategic thinking, proven track record, leadership examples, and deep domain expertise. Candidates should demonstrate independence and ability to mentor others.';
  }
  if (level.includes('lead') || level.includes('manager')) {
    return 'For Lead/Manager roles: Expect strategic vision, team leadership, cross-functional collaboration, and business impact. Candidates should demonstrate ability to drive results through others.';
  }
  return 'For Mid-level roles: Balance solid fundamentals with growing strategic thinking. Candidates should demonstrate independence on routine tasks and ability to handle complex challenges with minimal guidance.';
}

function getLevelMismatchGuidance(
  jobSeniority: string,
  candidateLevel: string,
  yearsExperience: number
): string {
  const jobLevel = jobSeniority?.toLowerCase() || 'mid-level';
  const candLevel = candidateLevel.toLowerCase();
  
  const jobRank = getRankFromLevel(jobLevel);
  const candRank = getRankFromLevel(candLevel);
  
  if (jobRank === candRank) {
    return `The candidate's ${yearsExperience} years of experience aligns well with this ${jobSeniority} role.`;
  }
  
  if (candRank < jobRank) {
    return `Note: This is a ${jobSeniority} role, but the candidate has ${yearsExperience} years of experience (${candidateLevel} level). Evaluate against ${jobSeniority}-level expectations, but consider whether their answers demonstrate the depth expected for this role OR show strong potential to grow into it with mentorship.`;
  }
  
  return `Note: The candidate has ${yearsExperience} years of experience (${candidateLevel} level) applying for a ${jobSeniority} role. Evaluate against ${jobSeniority}-level expectations, noting where they exceed requirements.`;
}

function getRankFromLevel(level: string): number {
  if (level.includes('entry')) return 1;
  if (level.includes('junior')) return 2;
  if (level.includes('mid')) return 3;
  if (level.includes('senior')) return 4;
  if (level.includes('lead') || level.includes('manager')) return 5;
  return 3;
}

function buildScoringPrompt(
  question: string,
  transcript: string,
  jobContext: JobContext,
  candidateContext: CandidateContext
): string {
  const jobSeniority = jobContext.seniority || 'Mid-level';
  const candidateLevel = getCandidateLevel(candidateContext.yearsExperience);
  const typicalYears = getTypicalYearsForLevel(jobSeniority);
  const experienceGap = candidateContext.yearsExperience - typicalYears;
  
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.slice(0, 5).join(', ')
    : 'General professional skills';

  const shouldIncludeGapNote = experienceGap < -2 || experienceGap > 3;

  return `You are an expert interviewer evaluating a candidate's response for a ${jobSeniority} ${jobContext.jobTitle} position.

ROLE REQUIREMENTS:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${jobSeniority}
Typical Years of Experience: ${typicalYears}+ years
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities:
- ${responsibilities}

Required Skills:
${skills}

${getSeniorityExpectations(jobSeniority)}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Candidate Level: ${candidateLevel}
Experience Gap: ${experienceGap >= 0 ? '+' : ''}${experienceGap} years relative to typical (${experienceGap < -2 ? 'significantly below' : experienceGap > 3 ? 'significantly above' : 'aligned'})

${getLevelMismatchGuidance(jobSeniority, candidateLevel, candidateContext.yearsExperience)}

INTERVIEW QUESTION:
${question}

CANDIDATE'S ANSWER:
"${transcript}"

YOUR TASK:
Evaluate this answer on a 0-2 scale. Your evaluation should be based on whether the answer meets the expectations for a ${jobSeniority} role, while considering the candidate's ${candidateContext.yearsExperience} years of experience.

EVALUATION RUBRIC:

Score 2 (Excellent):
- Directly addresses the question with relevant, specific details
- Demonstrates clear understanding of the role's responsibilities and required skills
- Provides concrete examples or structured reasoning appropriate for a ${jobSeniority} position
- Shows depth of knowledge and practical application expected at this level
- Well-organized and articulate response
- Meets or exceeds ${jobSeniority}-level expectations

Score 1 (Acceptable):
- Addresses the question but lacks depth or specific examples
- Shows basic understanding but misses some key aspects of the role's requirements
- Answer is somewhat generic or could apply to many roles
- Reasoning is present but not fully developed for ${jobSeniority} level
- Shows foundational competency but doesn't fully demonstrate ${jobSeniority}-level expertise

Score 0 (Poor):
- Off-topic, incoherent, or fails to address the question
- Shows lack of understanding of basic role requirements
- No relevant examples or reasoning provided
- Answer is too vague, contradictory, or demonstrates clear gaps in knowledge
- Falls significantly short of ${jobSeniority}-level expectations

EVALUATION GUIDELINES:
- Evaluate primarily against ${jobSeniority}-level expectations for this role
- Consider what type of question this is (behavioral/situational/technical) and adjust expectations accordingly
- For behavioral questions: look for specific situations, actions taken, and results (STAR method)
- For situational questions: look for clear process, logical steps, and sound reasoning
- For technical questions: look for specific knowledge and practical application
- The candidate has ${candidateContext.yearsExperience} years of experience - note in your reasoning if they demonstrate capabilities beyond or below what's typical for their experience level
- Be fair but maintain the standards expected for a ${jobSeniority} role

EDGE CASE HANDLING:
- Very brief answers (under 20 words): Score 0 unless it's a complete, appropriately concise answer to a simple question
- "I don't know" responses: Score 0, but note if the candidate attempted to reason through the problem or showed related knowledge
- Off-topic answers: Score 1 if they demonstrate relevant competencies even while missing the question; Score 0 if completely irrelevant
- Unclear/garbled transcripts: If the answer is difficult to understand due to transcription quality, note this in your reasoning and score based on what can be understood

Provide your evaluation in JSON format:
{
  "score": 0-2,
  "reasoning": "2-3 sentences explaining the score relative to ${jobSeniority}-level expectations. Focus on what they did well or poorly in their answer."${shouldIncludeGapNote ? `,\n  "experienceGapNote": "1-2 sentences evaluating whether their ${candidateContext.yearsExperience} years of experience (${experienceGap >= 0 ? '+' : ''}${experienceGap} years relative to typical ${typicalYears}+ for this role) is sufficient for current readiness in this ${jobSeniority} role. If they fall short of readiness, state what additional experience or skills they need. If their performance suggests they could reach readiness with focused development, note that but be realistic about timeline and effort required."` : ''},
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"]
}

Focus on being fair, objective, and constructive. Your feedback should help the candidate understand what they did well and where they can improve.`;
}

function buildFeedbackPrompt(
  questionScores: QuestionScore[],
  jobContext: JobContext,
  candidateContext: CandidateContext,
  averageScore: number,
  overallScore: number
): string {
  const jobSeniority = jobContext.seniority || 'Mid-level';
  const candidateLevel = getCandidateLevel(candidateContext.yearsExperience);
  
  const responsibilities = jobContext.keyResponsibilities && jobContext.keyResponsibilities.length > 0
    ? jobContext.keyResponsibilities.slice(0, 4).join('\n- ')
    : 'General professional responsibilities';
  const skills = jobContext.requiredSkills && jobContext.requiredSkills.length > 0
    ? jobContext.requiredSkills.join(', ')
    : 'General professional skills';

  const scoresSummary = questionScores
    .map((q, i) => {
      return `Question ${i + 1}: ${q.question}
Score: ${q.score}/2
Answer: "${q.transcript.substring(0, 150)}${q.transcript.length > 150 ? '...' : ''}"
Evaluation: ${q.reasoning}${q.experienceGapNote ? `\nExperience Gap Note: ${q.experienceGapNote}` : ''}`;
    })
    .join('\n\n');

  return `You are an expert interviewer providing comprehensive feedback for a candidate who interviewed for a ${jobSeniority} ${jobContext.jobTitle} position.

ROLE REQUIREMENTS:
Job Title: ${jobContext.jobTitle}
Seniority Level: ${jobSeniority}
${jobContext.industry ? `Industry: ${jobContext.industry}` : ''}
Role Type: ${jobContext.roleTemplate || 'Professional role'}

Key Responsibilities:
- ${responsibilities}

Required Skills:
${skills}

${getSeniorityExpectations(jobSeniority)}

CANDIDATE PROFILE:
Years of Experience: ${candidateContext.yearsExperience}
Candidate Level: ${candidateLevel}

${getLevelMismatchGuidance(jobSeniority, candidateLevel, candidateContext.yearsExperience)}

INTERVIEW PERFORMANCE SUMMARY:
Total Questions: ${questionScores.length}
Average Score: ${averageScore.toFixed(2)}/2.0
Overall Score: ${overallScore}/10

INDIVIDUAL QUESTION PERFORMANCE:
${scoresSummary}

YOUR TASK:
Based on this complete interview performance, provide comprehensive feedback that evaluates the candidate against ${jobSeniority}-level expectations while considering their ${candidateContext.yearsExperience} years of experience.

1. OVERALL FEEDBACK (3-4 sentences):
   - Summarize the candidate's overall performance against ${jobSeniority}-level expectations
   - Comment on their fit for this ${jobSeniority} ${jobContext.jobTitle} role
   - If there's a gap between their experience level (${candidateLevel}) and the role requirements, address whether they demonstrate potential to bridge that gap OR exceed expectations
   - Be balanced - acknowledge both strengths and areas for growth
   - Be honest about current readiness for this ${jobSeniority} role - if they don't yet meet the level, state that clearly while noting any strong potential for growth with mentorship or development

2. TOP 3 STRENGTHS:
   - Identify specific strengths demonstrated across their answers
   - Reference actual competencies or skills they showed
   - Connect strengths to the role's requirements where possible
   - Be specific, not generic (cite evidence from their answers)
   - Note if they demonstrated capabilities beyond their ${candidateLevel} experience level

3. TOP 3 AREAS TO IMPROVE:
   - Identify specific gaps or weaknesses relative to ${jobSeniority}-level expectations
   - Make suggestions actionable and relevant to the role
   - If they're below the required level, be specific about what skills/experience they need to develop
   - If they meet the level, suggest areas for continued growth
   - Be constructive and professional
   - Focus on areas that would help them succeed in this role or advance their career

CRITICAL SAFEGUARDS:
- Base your feedback on their ACTUAL answers and performance, not assumptions
- Evaluate primarily against ${jobSeniority}-level expectations for this role
- Reference the role's specific requirements (responsibilities and skills listed above)
- If they scored well on questions testing key responsibilities, highlight that
- If they struggled with questions about required skills, note that as an area to improve
- Be honest about whether their ${candidateContext.yearsExperience} years of experience translates to readiness for this ${jobSeniority} role
- Make feedback specific to THIS role, not generic interview feedback
- **ONLY provide feedback on competencies and skills that were actually tested in the interview questions above. Do not list required skills as "areas to improve" if they were never assessed in any question. If a skill wasn't tested, do not mention it in the feedback.**

Respond in JSON format:
{
  "overallFeedback": "3-4 sentence summary honestly evaluating their fit for this ${jobSeniority} role, considering their ${candidateLevel} experience level",
  "topStrengths": ["specific strength 1 with evidence", "specific strength 2 with evidence", "specific strength 3 with evidence"],
  "areasToImprove": ["specific area 1 with actionable advice", "specific area 2 with actionable advice", "specific area 3 with actionable advice"]
}`;
}

function normalizeScoreResult(
  question: string,
  transcript: string,
  evaluation: any
): QuestionScore {
  const score = Math.max(0, Math.min(2, evaluation.score || 0));
  const reasoning = evaluation.reasoning || 'No reasoning provided';
  const strengths = Array.isArray(evaluation.strengths)
    ? evaluation.strengths.slice(0, 3)
    : [];
  const weaknesses = Array.isArray(evaluation.weaknesses)
    ? evaluation.weaknesses.slice(0, 3)
    : [];
  const experienceGapNote = evaluation.experienceGapNote || undefined;

  return { 
    question, 
    transcript, 
    score, 
    reasoning, 
    strengths, 
    weaknesses,
    ...(experienceGapNote && { experienceGapNote })
  };
}

function createFallbackFeedback(questionScores: QuestionScore[]): OverallResult {
  const totalScore = questionScores.reduce((sum, q) => sum + q.score, 0);
  const averageScore = totalScore / questionScores.length;
  const overallScore = parseFloat((1.0 + (averageScore * 4.25)).toFixed(1));

  return {
    questionScores,
    overallScore,
    overallFeedback: 'Interview evaluation completed successfully. The candidate demonstrated competency across the assessment areas.',
    topStrengths: ['Communication skills', 'Relevant experience', 'Problem-solving ability'],
    areasToImprove: ['Could provide more specific examples', 'Further skill development recommended', 'Industry knowledge depth'],
  };
}