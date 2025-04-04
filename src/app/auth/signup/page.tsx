'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Ensure this matches the `site_url` in your Supabase config +
          // the path to your callback route (if using one)
          // emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Check if user needs email confirmation (based on Supabase project settings)
      if (data.user?.identities?.length === 0) {
        // Email confirmation is likely required.
        setSuccessMessage('Sign up successful! Please check your email to verify your account.');
        setEmail('');
        setPassword('');
      } else if (data.user) {
        // User signed up and auto-confirmed (or confirmation is off)
        setSuccessMessage('Sign up successful! You can now sign in.');
        setEmail('');
        setPassword('');
      } else {
        // Should not happen in typical flow
        setError('Sign up attempted, but no user data returned. Please check your email or try again.');
      }

    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'An unexpected error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-stretch justify-center min-h-screen bg-white">
      {/* Left Side: Decorative */}
       <div className="relative hidden w-1/2 bg-gradient-to-br from-green-500 to-teal-600 lg:block">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-white">
           <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 mb-6 text-teal-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h2 className="mb-4 text-3xl font-bold text-center">Join BookLogs Today</h2>
          <p className="text-lg text-center text-teal-100">
            Start logging your reads and discover new favorites.
          </p>
        </div>
      </div>

      {/* Right Side: Form */}
       <div className="flex items-center justify-center w-full lg:w-1/2">
        <div className="w-full max-w-md p-8 space-y-6 md:p-12">
          <div className="lg:hidden text-center mb-8">
             <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
             <h1 className="text-2xl font-bold text-gray-900">BookLogs</h1>
          </div>
          <h2 className="text-2xl font-semibold text-center text-gray-900 md:text-3xl">Create Account</h2>

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
            <form onSubmit={handleSignUp} className="space-y-6">
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
                  className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password (min. 6 characters)
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="relative flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-transparent rounded-md group hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-sm text-center text-gray-600">
            {successMessage ? 'Go back to' : 'Already have an account?'}{' '}
            <Link href="/" className="font-medium text-teal-600 hover:text-teal-500">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
