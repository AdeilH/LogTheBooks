'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenFound, setTokenFound] = useState(false); // Track if token was detected

  // Check for access token in URL fragment on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
        // We don't *need* to extract the token itself here for updateUser,
        // Supabase client handles it when the user is logged in via the link.
        // We just need to know that the user likely arrived via the reset link.
        setTokenFound(true);
    } else {
        setError("Invalid or missing password reset token. Please request a new reset link.");
    }

    // Also check if user session exists (Supabase client sets it after redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !hash.includes('access_token=')) {
          // Double check: If no session and no token in hash, something is wrong.
          setError("No active session or password reset token found. Please sign in or request a new reset link.");
          setTokenFound(false);
      }
    });

  }, []);

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Add password strength validation if desired (e.g., minimum length)
    if (password.length < 6) {
         setError("Password must be at least 6 characters long.");
         return;
     }

    setLoading(true);

    try {
      // Supabase client automatically uses the session established by the reset link
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage('Password updated successfully! You can now sign in with your new password.');
      // Clear fields after success
      setPassword('');
      setConfirmPassword('');
      // Optionally redirect after a delay
      setTimeout(() => router.push('/'), 3000);

    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-slate-200">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <h2 className="text-2xl font-bold text-gray-900">Update Your Password</h2>
        </div>

        {successMessage && (
          <div className="p-4 text-sm text-center text-green-800 bg-green-100 border border-green-200 rounded-md">
            <p>{successMessage}</p>
            <Link href="/" className="mt-2 inline-block font-medium text-indigo-600 hover:text-indigo-500">
                Go to Sign In
            </Link>
          </div>
        )}

        {error && (
          <div className="p-4 text-sm text-center text-red-800 bg-red-100 border border-red-200 rounded-md">
            <p>{error}</p>
             {!tokenFound && (
                 <Link href="/auth/reset-password" className="mt-2 inline-block font-medium text-indigo-600 hover:text-indigo-500">
                    Request a new link
                </Link>
             )}
          </div>
        )}

        {/* Only show form if token was likely present and no success message */} 
        {tokenFound && !successMessage && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
                </label>
                <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter new password (min. 6 chars)"
                />
            </div>
             <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
                </label>
                <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Confirm new password"
                />
            </div>

            <div>
                <button
                type="submit"
                disabled={loading}
                className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                {loading ? 'Updating Password...' : 'Update Password'}
                </button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
} 