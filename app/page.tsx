'use client';

import { useState } from 'react';
import { ROLE_TEMPLATES } from '@/lib/roleMapper';

interface FormData {
  job_title: string;
  industry: string;
  location: string;
  seniority: string;
  job_type: string;
  work_model: string;
  role_template: string;
  key_responsibilities: string[];
  required_skills: string[];
  custom_questions: string;
}

interface InterviewResult {
  interview_id: string;
  questions: string[];
  interview_link: string;
}

export default function Home() {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [jobDescription, setJobDescription] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    job_title: '',
    industry: '',
    location: '',
    seniority: 'Mid-level',
    job_type: 'Full-time',
    work_model: 'Remote',
    role_template: 'General Professional',
    key_responsibilities: [],
    required_skills: [],
    custom_questions: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExtract = async () => {
    if (!jobDescription.trim()) {
      setExtractError('Please paste a job description first');
      return;
    }

    setExtracting(true);
    setExtractError('');
    
    try {
      const response = await fetch('/api/extract-job-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract job information');
      }
      
      const extractedData = await response.json();
      
      setFormData({
        job_title: extractedData.job_title || '',
        industry: extractedData.industry || '',
        location: extractedData.location || '',
        seniority: extractedData.seniority || 'Mid-level',
        job_type: extractedData.job_type || 'Full-time',
        work_model: extractedData.work_model || 'Remote',
        role_template: extractedData.role_template || 'General Professional',
        key_responsibilities: extractedData.key_responsibilities?.length > 0 
          ? extractedData.key_responsibilities 
          : [''],
        required_skills: extractedData.required_skills?.length > 0 
          ? extractedData.required_skills 
          : [''],
        custom_questions: '',
      });
      
      setStep('review');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'An error occurred while extracting job information');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanedData = {
      ...formData,
      key_responsibilities: formData.key_responsibilities.filter(r => r.trim()),
      required_skills: formData.required_skills.filter(s => s.trim()),
    };
    
    if (!cleanedData.job_title.trim()) {
      setError('Job title is required');
      return;
    }
    
    if (cleanedData.key_responsibilities.length === 0 && cleanedData.required_skills.length === 0) {
      setError('Please add at least one responsibility or skill to generate relevant interview questions');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await fetch('/api/generate-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cleanedData, num_questions: 5 }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate interview');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the interview');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.interview_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFormData({
      job_title: '',
      industry: '',
      location: '',
      seniority: 'Mid-level',
      job_type: 'Full-time',
      work_model: 'Remote',
      role_template: 'General Professional',
      key_responsibilities: [],
      required_skills: [],
      custom_questions: '',
    });
  };

  const handleBackToPaste = () => {
    setStep('paste');
    resetForm();
  };

  const handleCreateAnother = () => {
    setResult(null);
    setStep('paste');
    setJobDescription('');
    resetForm();
  };

  const updateResponsibility = (index: number, value: string) => {
    const updated = [...formData.key_responsibilities];
    updated[index] = value;
    setFormData({ ...formData, key_responsibilities: updated });
  };

  const removeResponsibility = (index: number) => {
    const updated = formData.key_responsibilities.filter((_, i) => i !== index);
    setFormData({ ...formData, key_responsibilities: updated });
  };

  const addResponsibility = () => {
    setFormData({
      ...formData,
      key_responsibilities: [...formData.key_responsibilities, '']
    });
  };

  const updateSkill = (index: number, value: string) => {
    const updated = [...formData.required_skills];
    updated[index] = value;
    setFormData({ ...formData, required_skills: updated });
  };

  const removeSkill = (index: number) => {
    const updated = formData.required_skills.filter((_, i) => i !== index);
    setFormData({ ...formData, required_skills: updated });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      required_skills: [...formData.required_skills, '']
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center pt-8 pb-6 mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent mb-4 drop-shadow-sm pb-1">
            Wavvy - Create AI Interview
          </h1>
          <p className="text-gray-700 text-lg font-medium">
            Paste your job description and let AI do the work
          </p>
        </div>

        {step === 'paste' && (
          <div className="bg-white p-8 rounded-xl shadow-md">
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-lg text-gray-800">
                Paste Job Description
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Copy and paste your job posting. AI will extract all relevant details.
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full border-2 border-gray-200 p-4 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                rows={12}
                placeholder="Example:&#10;&#10;We're looking for a Retail Sales Assistant to join our team...&#10;&#10;Responsibilities:&#10;- Customer service&#10;- Sales&#10;- Stock management&#10;&#10;Requirements:&#10;- 1+ years experience&#10;- Strong communication skills&#10;..."
              />
              <p className="text-xs text-gray-500 mt-2">
                {jobDescription.length} characters
                {jobDescription.length > 0 && jobDescription.length < 100 && ' (paste more for better results)'}
              </p>
            </div>

            {extractError && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded text-sm">
                {extractError}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={extracting || !jobDescription.trim()}
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded-lg font-semibold hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-100"
            >
              {extracting ? 'Extracting Information...' : 'Extract Job Information →'}
            </button>

            <div className="mt-5 text-center">
              <button
                onClick={() => setStep('review')}
                className="text-[#667eea] hover:text-[#764ba2] font-medium text-sm transition-colors"
              >
                Or fill form manually
              </button>
            </div>
          </div>
        )}

        {step === 'review' && !result && (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Review & Edit Details</h2>
              <button
                type="button"
                onClick={handleBackToPaste}
                className="text-sm text-gray-600 hover:text-[#667eea] font-medium transition-colors"
              >
                ← Back to paste
              </button>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-gray-800">Position Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Job Title *</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                    className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                      placeholder="e.g., Retail"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                      placeholder="e.g., London, UK"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Optional — leave blank for remote or location-flexible roles
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Seniority</label>
                    <select
                      value={formData.seniority}
                      onChange={(e) => setFormData({...formData, seniority: e.target.value})}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    >
                      <option>Entry-level</option>
                      <option>Junior</option>
                      <option>Mid-level</option>
                      <option>Senior</option>
                      <option>Lead/Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Job Type</label>
                    <select
                      value={formData.job_type}
                      onChange={(e) => setFormData({...formData, job_type: e.target.value})}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    >
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Contract</option>
                      <option>Internship</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Work Model</label>
                    <select
                      value={formData.work_model}
                      onChange={(e) => setFormData({...formData, work_model: e.target.value})}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    >
                      <option>Remote</option>
                      <option>Hybrid</option>
                      <option>On-site</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Role Template</label>
                    <select
                      value={formData.role_template}
                      onChange={(e) => setFormData({...formData, role_template: e.target.value})}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    >
                      {ROLE_TEMPLATES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Key Responsibilities</label>
              <div className="space-y-2">
                {formData.key_responsibilities.map((resp, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={resp}
                      onChange={(e) => updateResponsibility(index, e.target.value)}
                      className="flex-1 border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => removeResponsibility(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addResponsibility}
                  className="text-sm text-[#667eea] hover:text-[#764ba2] font-medium transition-colors"
                >
                  + Add responsibility
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Required Skills</label>
              <div className="space-y-2">
                {formData.required_skills.map((skill, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => updateSkill(index, e.target.value)}
                      className="flex-1 border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSkill}
                  className="text-sm text-[#667eea] hover:text-[#764ba2] font-medium transition-colors"
                >
                  + Add skill
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Additional Custom Questions (Optional)</label>
              <textarea
                value={formData.custom_questions}
                onChange={(e) => setFormData({...formData, custom_questions: e.target.value})}
                className="w-full border-2 border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                rows={3}
                placeholder="Any specific questions not covered above?"
              />
            </div>

            {error && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded-lg font-semibold hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-100"
            >
              {loading ? 'Generating Interview...' : 'Generate Interview Questions'}
            </button>
          </form>
        )}

        {result && (
          <div className="bg-white p-8 rounded-xl shadow-md">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Interview Created! 🎉</h2>
              <p className="text-gray-600 text-sm">Share this link with your candidate to start the interview</p>
            </div>
            
            <div className="mb-6">
              <label className="block font-semibold mb-3 text-gray-800">Interview Link:</label>
              <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 font-mono text-sm break-all mb-4">
                {result.interview_link}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-100"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
                
                <a
                  href={result.interview_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-100 text-center"
                >
                  View Interview →
                </a>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-100">
              <label className="block font-semibold mb-3 text-gray-800">Generated Questions:</label>
              <ol className="list-decimal list-inside space-y-2">
                {result.questions.map((q: string, i: number) => (
                  <li key={i} className="text-gray-700 leading-relaxed">{q.replace(/^\d+\.\s*/, '')}</li>
                ))}
              </ol>
            </div>

            <button
              onClick={handleCreateAnother}
              className="mt-6 w-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 p-4 rounded-lg font-semibold hover:from-gray-200 hover:to-gray-300 transition-all"
            >
              Create Another Interview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}