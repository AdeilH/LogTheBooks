'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AddBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TODO: Add logic to check if user is authenticated before rendering/allowing submission
  // This might involve checking the session state or using middleware

  const handleAddBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('books')
        .insert([
          {
            title,
            author: author || null, // Handle optional field
            isbn: isbn || null,     // Handle optional field
            cover_image_url: coverImageUrl || null, // Handle optional field
          },
        ])
        .select(); // Optionally select the inserted data

      if (insertError) {
        throw insertError;
      }

      alert('Book added successfully!');
      // console.log('Added book:', data);
      // Optionally redirect to the book details page or the user's library
      // router.push(`/books/${data[0].id}`);
      router.push('/'); // Redirect home for now

    } catch (err: any) {
      console.error('Error adding book:', err);
      setError(err.message || 'An unexpected error occurred while adding the book.');
      // Handle specific errors like unique constraint violation if needed
      if (err.code === '23505') { // Unique violation (e.g., duplicate ISBN if unique constraint added)
        setError('A book with this identifier might already exist.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">Add a New Book</h1>
        <p className="text-sm text-center text-gray-600">
          Contribute to the library by adding book details.
        </p>
        <form onSubmit={handleAddBook} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="The Great Gatsby"
            />
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700">
              Author
            </label>
            <input
              id="author"
              name="author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="F. Scott Fitzgerald"
            />
          </div>

          <div>
            <label htmlFor="isbn" className="block text-sm font-medium text-gray-700">
              ISBN (Optional)
            </label>
            <input
              id="isbn"
              name="isbn"
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="978-3-16-148410-0"
            />
          </div>

           <div>
            <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700">
              Cover Image URL (Optional)
            </label>
            <input
              id="coverImageUrl"
              name="coverImageUrl"
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="block w-full px-3 py-2 mt-1 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="https://example.com/cover.jpg"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="relative flex justify-center w-full px-4 py-2 mt-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md group hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? 'Adding Book...' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
