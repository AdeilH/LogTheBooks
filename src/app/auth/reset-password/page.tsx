'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function ResetPasswordRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    // Validate email format (basic)
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setError("Please enter a valid email address.");
        setLoading(false);
        return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // This URL points to the page where the user can *set* their new password
        // Supabase will append the necessary token to this URL
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccessMessage('Password reset email sent! Please check your inbox (and spam folder).');
      setEmail(''); // Clear email field on success

    } catch (err: any) {
      console.error('Password reset request error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      // Handle specific errors if needed, e.g., user not found (though Supabase might not always distinguish)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-slate-200">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <h2 className="text-2xl font-bold text-gray-900">Forgot Password?</h2>
            <p className="mt-2 text-sm text-gray-600">
            Enter your email address below, and we'll send you a link to reset your password.
            </p>
        </div>

        {successMessage && (
          <div className="p-4 text-sm text-center text-green-800 bg-green-100 border border-green-200 rounded-md">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-center text-red-800 bg-red-100 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {!successMessage && (
            <form onSubmit={handleResetRequest} className="space-y-6">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
                </label>
                <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="you@example.com"
                />
            </div>

            <div>
                <button
                type="submit"
                disabled={loading}
                className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                </button>
            </div>
            </form>
        )}

        <p className="mt-6 text-sm text-center text-gray-600">
          Remember your password?{' '}
          <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
} 