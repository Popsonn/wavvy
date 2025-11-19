'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';

interface InterviewData {
  job_title: string;
  work_model?: string;
  location?: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  years_experience: string;
  salary_expectations: string;
  location_confirmed: boolean;
  consent_given: boolean;
}

export default function RegisterPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [interview, setInterview] = useState<InterviewData | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    years_experience: '',
    salary_expectations: '',
    location_confirmed: false,
    consent_given: false,
  });

  useEffect(() => {
    async function fetchInterview() {
      try {
        const response = await fetch(`/api/interview/${interview_id}`);
        
        if (!response.ok) {
          throw new Error('Interview not found');
        }
        
        const data = await response.json();
        setInterview(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load interview';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchInterview();
  }, [interview_id]);

  const needsLocationConfirmation = 
    interview?.location?.trim() &&
    interview?.work_model && 
    interview.work_model.toLowerCase() !== 'remote';

  const normalizePhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return '+234' + cleaned.slice(1);
    }
    
    if (cleaned.startsWith('234')) {
      return '+' + cleaned;
    }
    
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return '+234' + cleaned;
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Name is required';
    }

    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      return 'Valid email is required';
    }

    if (!formData.years_experience || Number(formData.years_experience) < 0) {
      return 'Years of experience must be a positive number';
    }

    if (!formData.salary_expectations.trim()) {
      return 'Salary expectations are required';
    }

    if (!formData.consent_given) {
      return 'You must consent to recording and data processing to continue';
    }

    if (needsLocationConfirmation && !formData.location_confirmed) {
      return 'Please confirm you can work in the specified location';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const normalizedPhone = formData.phone.trim() 
        ? normalizePhoneNumber(formData.phone.trim())
        : undefined;

      const response = await fetch(`/api/interview/${interview_id}/candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: normalizedPhone,
          years_experience: Number(formData.years_experience),
          salary_expectations: formData.salary_expectations.trim(),
          location_confirmed: needsLocationConfirmation ? formData.location_confirmed : undefined,
          consent_given: formData.consent_given,
          consent_timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to register');
      }

      const { candidate_id } = await response.json();
      router.push(`/interview/${interview_id}/preview?candidate_id=${candidate_id}`);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit registration';
      setError(message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#667eea] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:shadow-lg transition-all"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">
            Candidate Registration
          </h1>
          <p className="text-white/90 text-lg">
            {interview?.job_title}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                placeholder="Oluwaseun Adeyemi"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                placeholder="oluwaseun@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                placeholder="0803 456 7890"
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter as 0803 456 7890 or +234 803 456 7890
              </p>
            </div>

            <div>
              <label htmlFor="years_experience" className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="years_experience"
                min="0"
                step="0.5"
                value={formData.years_experience}
                onChange={(e) => setFormData({ ...formData, years_experience: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                placeholder="e.g., 2"
                required
              />
            </div>

            <div>
              <label htmlFor="salary_expectations" className="block text-sm font-medium text-gray-700 mb-2">
                Salary Expectations <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="salary_expectations"
                value={formData.salary_expectations}
                onChange={(e) => setFormData({ ...formData, salary_expectations: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent transition-all"
                placeholder="e.g., ₦150,000 per month"
                required
              />
            </div>

            {/* Combined Consents Section */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Required Confirmations
              </h4>
              
              {/* Consent Checkbox - Always Shown */}
              <label className="flex items-start cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.consent_given}
                  onChange={(e) => setFormData({ ...formData, consent_given: e.target.checked })}
                  className="mt-1 mr-3 h-5 w-5 text-[#667eea] border-gray-300 rounded focus:ring-[#667eea] cursor-pointer"
                  required
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    I consent to being recorded during this interview. My video responses will be stored securely and used solely for recruitment purposes. <span className="text-red-500">*</span>
                  </span>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Video recordings are retained for review purposes and may be deleted after the recruitment process concludes.
                  </p>
                </div>
              </label>
              
              {/* Location Checkbox - Conditionally Shown */}
              {needsLocationConfirmation && (
                <label className="flex items-start cursor-pointer group pt-1 border-t border-blue-200">
                  <input
                    type="checkbox"
                    checked={formData.location_confirmed}
                    onChange={(e) => setFormData({ ...formData, location_confirmed: e.target.checked })}
                    className="mt-1 mr-3 h-5 w-5 text-[#667eea] border-gray-300 rounded focus:ring-[#667eea] cursor-pointer"
                    required
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 pt-3">
                    I confirm I can work <strong className="text-gray-900">{interview.work_model}</strong> in{' '}
                    <strong className="text-gray-900">{interview.location}</strong> <span className="text-red-500">*</span>
                  </span>
                </label>
              )}
            </div>

            {error && (
              <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-100"
            >
              {submitting ? 'Submitting...' : 'Continue to Interview →'}
            </button>

            <div className="text-center">
              <a
                href={`/interview/${interview_id}`}
                className="text-sm text-gray-600 hover:text-[#667eea] font-medium transition-colors"
              >
                ← Back to interview preview
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}