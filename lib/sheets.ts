import { google } from 'googleapis';
import { InterviewData, CandidateData } from './db';

const getGoogleSheetsClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return google.sheets({ version: 'v4', auth });
};

interface CandidateResults {
  candidate: CandidateData;
  interview: InterviewData;
  results: {
    overallScore: number;
    overallFeedback: string;
    topStrengths: string[];
    areasToImprove: string[];
    questionScores: Array<{
      question: string;
      transcript: string;
      score: number;
      reasoning: string;
    }>;
  };
  recordings: Array<{
    question_index: number;
    video_url: string;
  }>;
}

export async function exportToGoogleSheets(
  interviewId: string,
  interviewTitle: string,
  candidateData: CandidateResults
): Promise<string> {
  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured');
    }
    
    await ensureHeaders(sheets, spreadsheetId);
    const rowData = prepareRowData(candidateData);
    const existingRowIndex = await findCandidateRow(sheets, spreadsheetId, candidateData.candidate.email);
    
    if (existingRowIndex !== -1) {
      await updateRow(sheets, spreadsheetId, existingRowIndex, rowData);
    } else {
      await appendRow(sheets, spreadsheetId, rowData);
    }
    
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } catch (error: any) {
    throw new Error(`Failed to export to Google Sheets: ${error.message}`);
  }
}

async function ensureHeaders(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:R1',
    });
    
    if (response.data.values && response.data.values[0] && response.data.values[0][0]) {
      return;
    }
  } catch (error) {
    // Continue to create headers
  }
  
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          'Name',
          'Email',
          'Phone',
          'Years Experience',
          'Salary Expectations',
          'Overall Score (/10)',
          'Status',
          'Top Strengths',
          'Areas to Improve',
          'Overall Feedback',
          'Q1 Score',
          'Q2 Score',
          'Q3 Score',
          'Q4 Score',
          'Q5 Score',
          'Recording Links',
          'Submitted At',
          'Processed At',
        ],
      ],
    },
  });
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.4, green: 0.5, blue: 0.9 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ],
    },
  });
}

function prepareRowData(candidateData: CandidateResults): any[] {
  const { candidate, results, recordings } = candidateData;
  
  const questionScores = results.questionScores.map(q => `${q.score}/2`);
  while (questionScores.length < 5) {
    questionScores.push('N/A');
  }
  
  const recordingLinks = recordings
    .map((r, i) => `Q${i + 1}: ${r.video_url}`)
    .join('\n');
  
  return [
    candidate.name,
    candidate.email,
    candidate.phone || 'N/A',
    candidate.years_experience,
    candidate.salary_expectations,
    results.overallScore.toFixed(1),
    candidate.status,
    results.topStrengths.join(', '),
    results.areasToImprove.join(', '),
    results.overallFeedback,
    ...questionScores,
    recordingLinks,
    candidate.registered_at,
    (candidateData.results as any).processedAt || new Date().toISOString(),
  ];
}

async function findCandidateRow(
  sheets: any,
  spreadsheetId: string,
  email: string
): Promise<number> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!B:B',
    });
    
    const values = response.data.values || [];
    return values.findIndex((row: any[]) => row[0] === email);
  } catch {
    return -1;
  }
}

async function appendRow(sheets: any, spreadsheetId: string, rowData: any[]): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowData],
    },
  });
}

async function updateRow(
  sheets: any,
  spreadsheetId: string,
  rowIndex: number,
  rowData: any[]
): Promise<void> {
  const range = `Sheet1!A${rowIndex + 1}:R${rowIndex + 1}`;
  
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowData],
    },
  });
}

export async function shareSpreadsheet(
  spreadsheetId: string,
  emailToShare: string
): Promise<void> {
  try {
    const drive = google.drive({ version: 'v3', auth: getGoogleSheetsClient().context._options.auth });
    
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: emailToShare,
      },
    });
  } catch (error: any) {
    console.error('Failed to share sheet:', error);
  }
}