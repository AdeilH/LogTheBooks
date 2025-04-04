'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

// Define interfaces for our data
interface Book {
  id: number;
  title: string;
  author: string | null;
  cover_image_url: string | null;
}

// Corrected BookLog interface to match potential Supabase return type
interface BookLog {
  id: number;
  user_id: string; // Added user_id
  book_id: number; // Added book_id
  rating: number | null;
  review_text: string | null;
  read_status: string;
  created_at: string; // Added for sorting/display
  // Joined data from 'books' table
  books: { 
    id: number; // Include book id here for easy access
    title: string;
    author: string | null;
    cover_image_url: string | null; 
  } | null; // Can be null if join fails or book deleted
}

interface LogNote {
    id: number;
    log_id: number;
    chapter: string | null;
    note_text: string;
    created_at: string;
}

interface LogChapter {
    id: number;
    log_id: number;
    user_id: string;
    chapter_number: number | null;
    chapter_title: string | null;
    finished_at: string | null;
    created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [rating, setRating] = useState<number | null>(null); // State for logging form
  const [review, setReview] = useState(''); // State for logging form
  const [notes, setNotes] = useState(''); // State for logging form note
  const [chapter, setChapter] = useState(''); // State for logging form chapter context
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loggedBooks, setLoggedBooks] = useState<BookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Modal State for Viewing/Editing Details
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLogForModal, setSelectedLogForModal] = useState<BookLog | null>(null);
  const [modalNotes, setModalNotes] = useState<LogNote[]>([]);
  const [modalChapters, setModalChapters] = useState<LogChapter[]>([]); // Keep chapter state, might be needed if DB has data
  const [loadingModalDetails, setLoadingModalDetails] = useState(false);
  // Edit state within modal
  const [editRating, setEditRating] = useState<number | string>(''); // Use string for select
  const [editReview, setEditReview] = useState('');
  const [isUpdatingLog, setIsUpdatingLog] = useState(false);

  // Form/Action states
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);


  // --- Fetch User and Initial Logs ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadingLogs(true);
      setError(null);

      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        console.error('Dashboard: Error fetching user or no user logged in:', userError);
        router.push('/');
        return;
      }

      setUser(currentUser);
      setLoading(false);

      // Fetch logged books
      try {
        const { data: logsData, error: logsError } = await supabase
          .from('book_logs')
          .select(`
            id, user_id, book_id, rating, review_text, read_status,
            books ( id, title, author, cover_image_url )
          `)
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (logsError) throw logsError;

        const formattedLogs: BookLog[] = (logsData || []).map((log: any) => ({
          ...log,
          books: log.books && !Array.isArray(log.books) ? log.books : null
        }));
        setLoggedBooks(formattedLogs);
      } catch (err: any) {
        console.error("Dashboard: Error fetching logs:", err);
        setError('Could not fetch your logged books.');
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchData();
  }, [router]);

  // --- Debounced Book Search (using contains '%term%') ---
  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      const { data, error: searchError } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url')
        .ilike('title', `%${term}%`) // Search anywhere in title
        .limit(10);

      if (searchError) throw searchError;
      setSearchResults(data || []);
    } catch (err: any) {
      console.error('Error searching books:', err);
      setError('Could not search for books.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(searchTerm);
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, performSearch]);


  // --- Handlers ---

  // Helper to clear messages
  const clearMessages = (delay = 4000) => {
      setTimeout(() => {
          setError(null);
          setSuccessMessage(null);
      }, delay);
  };

  const handleLogBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBook || !user) return;

    setError(null);
    setSuccessMessage(null);
    setIsSubmittingLog(true);
    const currentTimestamp = new Date().toISOString();
    const finalRating = rating;

    try {
      const { data: existingLog, error: checkError } = await supabase
        .from('book_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('book_id', selectedBook.id)
        .maybeSingle();

      if (checkError) throw checkError;

      let logId: number;

      if (existingLog) {
        logId = existingLog.id;
        const { error: updateLogError } = await supabase
          .from('book_logs')
          .update({ rating: finalRating, review_text: review.trim() || null, updated_at: currentTimestamp })
          .eq('id', logId);
        if (updateLogError) throw updateLogError;
      } else {
        const { data: newLogData, error: insertLogError } = await supabase
          .from('book_logs')
          .insert({ user_id: user.id, book_id: selectedBook.id, rating: finalRating, review_text: review.trim() || null, read_status: 'read', created_at: currentTimestamp, updated_at: currentTimestamp })
          .select('id').single();
        if (insertLogError || !newLogData) throw insertLogError || new Error('Failed to create log.');
        logId = newLogData.id;
      }

      // Add Note if provided
      if (notes.trim()) {
        const { error: noteError } = await supabase.from('log_notes').insert({
          log_id: logId,
          user_id: user.id,
          note_text: notes.trim(),
          chapter: chapter.trim() || null,
          created_at: currentTimestamp,
        });
        if (noteError) console.warn('Could not save note:', noteError.message);
      }

      // Add Chapter Log if chapter context was provided for the note
      if (chapter.trim()) {
         const { error: chapterError } = await supabase.from('log_chapters').insert({
            log_id: logId,
            user_id: user.id,
            chapter_title: chapter.trim(), // Save the context as title
            created_at: currentTimestamp
         });
         if (chapterError) console.warn('Could not save chapter log:', chapterError.message);
      }

      setSuccessMessage(`Successfully logged '${selectedBook.title}'!`);
      await fetchLogs(user.id); // Refetch logs to update the list
      resetLogForm();
      clearMessages();

    } catch (err: any) {
      console.error('Dashboard: Error logging book:', err);
      setError(err.message || 'An unexpected error occurred.');
      clearMessages();
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
        setError("Failed to sign out.");
        setLoggingOut(false);
        clearMessages();
    } else {
        setUser(null);
        router.push('/');
    }
  };

  const handleOpenModal = async (log: BookLog) => {
    if (!log.books) return;
    setSelectedLogForModal(log);
    setEditRating(log.rating?.toString() ?? ''); // Use string for select
    setEditReview(log.review_text || '');
    setIsModalOpen(true);
    setLoadingModalDetails(true);
    setError(null);
    setModalNotes([]);
    setModalChapters([]);

    try {
      // Fetch notes and chapters concurrently
      const [notesRes, chaptersRes] = await Promise.all([
        supabase.from('log_notes').select('*').eq('log_id', log.id).order('created_at', { ascending: true }),
        supabase.from('log_chapters').select('*').eq('log_id', log.id).order('created_at', { ascending: true })
      ]);
      if (notesRes.error) throw notesRes.error;
      setModalNotes(notesRes.data || []);
      if (chaptersRes.error) throw chaptersRes.error;
      setModalChapters(chaptersRes.data || []);
    } catch (err: any) {
      console.error("Error fetching modal details:", err);
      setError("Could not load notes/chapters.");
    } finally {
      setLoadingModalDetails(false);
    }
  };

  const handleUpdateLog = async () => {
    if (!selectedLogForModal || !user) return;
    setIsUpdatingLog(true);
    setError(null);
    const finalRating = editRating === '' ? null : Number(editRating);

    try {
        const { error: updateError } = await supabase
            .from('book_logs')
            .update({ rating: finalRating, review_text: editReview.trim() || null, updated_at: new Date().toISOString() })
            .eq('id', selectedLogForModal.id)
            .eq('user_id', user.id);
        if (updateError) throw updateError;

        // Update state immediately
        const updatedLog = { ...selectedLogForModal, rating: finalRating, review_text: editReview.trim() || null };
        setLoggedBooks(prevLogs => prevLogs.map(log => log.id === updatedLog.id ? updatedLog : log));
        setSelectedLogForModal(updatedLog); // Keep modal state updated too

        setSuccessMessage("Log updated successfully!");
        setIsModalOpen(false); // Close modal on successful update
        clearMessages();

    } catch (err: any) {
        console.error("Error updating log:", err);
        setError("Failed to update log."); // Show error in modal
        clearMessages(6000); // Show error longer
    } finally {
        setIsUpdatingLog(false);
    }
  };

  // --- Helper Functions ---
  const resetLogForm = () => {
    setSelectedBook(null);
    setSearchTerm('');
    setSearchResults([]);
    setRating(null); // Reset to null
    setReview('');
    setNotes('');
    setChapter('');
  };

  const fetchLogs = async (userId: string) => {
    if (!userId) return;
    setLoadingLogs(true);
    try {
        const { data: logsData, error: logsError } = await supabase
            .from('book_logs')
            .select(`id, user_id, book_id, rating, review_text, read_status, books ( id, title, author, cover_image_url )`)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (logsError) throw logsError;
        const formattedLogs: BookLog[] = (logsData || []).map((log: any) => ({ ...log, books: log.books && !Array.isArray(log.books) ? log.books : null }));
        setLoggedBooks(formattedLogs);
    } catch (err) {
        console.error("Dashboard: Failed to refetch logs:", err);
        setError('Failed to refresh the log list.');
    } finally {
        setLoadingLogs(false);
    }
  };


  // --- Render Logic ---
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return null; // Should be redirected by useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 p-4 md:p-8 font-sans">
       <header className="mb-8 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-lg shadow">
         <h1 className="text-2xl md:text-3xl font-bold text-gray-800">BookLogs Dashboard</h1>
         <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">{user.email}</span>
            <button
                onClick={handleSignOut}
                disabled={loggingOut}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition duration-150 ease-in-out"
            >
                {loggingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
         </div>
       </header>

       {/* Messages Area */}
       <div className="h-12 mb-4"> {/* Reserve space for messages */}
         {successMessage && (
           <div className="p-3 text-sm text-green-700 bg-green-100 border border-green-200 rounded-md animate-fade-in">
             {successMessage}
           </div>
         )}
         {error && (
           <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md animate-fade-in">
             {error}
           </div>
         )}
       </div>

      {/* Log New Book Section */}
      <section className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">
            {selectedBook ? 'Log Your Read' : 'Find & Log a Book'}
        </h2>

        {!selectedBook ? (
          // Search View
          <>
            <div className="mb-4 flex flex-wrap gap-2 items-center">
               <label htmlFor="search-book" className="sr-only">Search for a book title</label>
               <div className="relative flex-grow min-w-[250px]">
                 <input
                    id="search-book"
                    type="text"
                    placeholder="Start typing a book title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                 />
                 {isSearching && (
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                         <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                 )}
               </div>
               <Link href="/books/add" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-150 ease-in-out">
                 Add New Book
               </Link>
            </div>
            {/* Search Results */}
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {searchTerm && !isSearching && searchResults.length === 0 && (
                 <p className="text-center text-gray-500 py-4">No books found matching "{searchTerm}". You can <Link href="/books/add" className="text-indigo-600 hover:underline">add it</Link>.</p>
              )}
              {searchResults.map((book) => (
                <div key={book.id} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50">
                  <div className="flex items-center gap-3 overflow-hidden">
                      <img src={book.cover_image_url || '/placeholder-cover.svg'} alt={book.title} className="w-10 h-14 object-cover rounded flex-shrink-0 border" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                    <div className="overflow-hidden whitespace-nowrap">
                        <p className="font-medium text-gray-800 truncate">{book.title}</p>
                        <p className="text-sm text-gray-500 truncate">{book.author || 'Unknown Author'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-150 ease-in-out flex-shrink-0 ml-2">
                    Log This
                  </button>
                </div>
              ))}
               {!searchTerm && !isSearching && (
                  <p className="text-center text-gray-400 py-4 px-2 text-sm italic">Type above to find a book.</p>
               )}
            </div>
          </>
        ) : (
          // Log Form for Selected Book
          <form onSubmit={handleLogBook} className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b">
               <img src={selectedBook.cover_image_url || '/placeholder-cover.svg'} alt={selectedBook.title} className="w-12 h-16 object-cover rounded shadow border" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{selectedBook.title}</h3>
                    <p className="text-sm text-gray-600">by {selectedBook.author || 'Unknown Author'}</p>
                </div>
                <button type="button" onClick={resetLogForm} className="ml-auto text-sm text-red-600 hover:underline">Change Book</button>
            </div>

            {/* Rating */}
            <div>
              <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">
                Your Rating (0-10)
              </label>
              <select
                id="rating"
                value={rating ?? ''} // Handle null for select
                onChange={(e) => setRating(e.target.value ? parseInt(e.target.value) : null)}
                className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white"
              >
                 <option value="">No Rating</option>
                 {[...Array(11)].map((_, i) => (
                    <option key={10-i} value={10-i}>{10-i}</option> // Rating 10 -> 0
                 ))}
              </select>
            </div>

            {/* Review */}
            <div>
              <label htmlFor="review" className="block text-sm font-medium text-gray-700">Review / Overall Thoughts</label>
              <textarea
                id="review"
                rows={3}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="What did you think of the book?"
              />
            </div>

             {/* Chapter Context (for note below) */}
            <div>
              <label htmlFor="chapter" className="block text-sm font-medium text-gray-700">Initial Chapter/Context (Optional)</label>
              <input
                id="chapter"
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g., Chapter 5 or Introduction (for note below)"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Add Initial Note (Optional)</label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={`Add specific thoughts or quotes${chapter ? ` for ${chapter}` : ''}...`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button
                    type="button"
                    onClick={resetLogForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmittingLog}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                    {isSubmittingLog ? 'Logging...' : 'Save Log'}
                </button>
            </div>
          </form>
        )}
      </section>

      {/* Section to display existing book logs */}
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Your Reading Log</h2>
        {loadingLogs ? (
          <p className="text-center text-gray-500 py-4">Loading your logs...</p>
        ) : loggedBooks.length === 0 ? (
          <p className="text-center text-gray-500 py-4">You haven't logged any books yet. Start by searching above!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loggedBooks.map((log) => (
              // Log Card - Matches Screenshot Style
              <div key={log.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start gap-4 p-4">
                      {!log.books?.cover_image_url ? (
                        <div className="w-16 h-24 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-400 border">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                      ) : (
                        <img
                          src={log.books.cover_image_url}
                          alt={log.books.title ?? 'Book Cover'}
                          className="w-16 h-24 object-cover rounded flex-shrink-0 border"
                          onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }}
                        />
                      )}
                      <div className="flex-grow overflow-hidden">
                          <h3 className="text-base font-semibold text-gray-800 truncate" title={log.books?.title ?? 'Book title missing'}>{log.books?.title || 'Book title missing'}</h3>
                          <p className="text-sm text-gray-500 mb-1 truncate" title={log.books?.author ?? 'Unknown Author'}>{log.books?.author || 'Unknown Author'}</p>
                          {log.rating !== null && (
                              <p className="text-sm font-medium text-yellow-500 flex items-center">
                                 {[...Array(10)].map((_, i) => (
                                     <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${i < log.rating! ? 'text-yellow-400' : 'text-gray-300'}`} viewBox="0 0 20 20" fill="currentColor">
                                         <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                     </svg>
                                 ))}
                                  <span className="ml-1 text-xs text-gray-500">({log.rating}/10)</span>
                             </p>
                          )}
                      </div>
                  </div>
                  {log.review_text && (
                      <div className="px-4 pb-3 pt-1 border-t border-gray-100 mt-2">
                          <p className="text-sm text-gray-600 line-clamp-3 italic">"{log.review_text}"</p>
                      </div>
                  )}
                  <div className="mt-auto px-4 py-2 bg-gray-50 border-t">
                      <button
                          onClick={() => handleOpenModal(log)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition duration-150 ease-in-out"
                      >
                          View Details / Edit
                      </button>
                  </div>
              </div>
            ))}
          </div>
        )}
      </section>

       {/* Modal for Viewing/Editing Log Details - Reverted Style/Functionality */}
       {isModalOpen && selectedLogForModal && selectedLogForModal.books && (
        <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out animate-fade-in"
            onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative transform transition-all duration-300 ease-in-out scale-95 animate-modal-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Modal Header */}
             <div className="flex justify-between items-start p-4 border-b sticky top-0 bg-white z-10">
                 <div className="flex items-center gap-3">
                    <img src={selectedLogForModal.books.cover_image_url || '/placeholder-cover.svg'} alt="" className="w-10 h-14 object-cover rounded border" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800" title={selectedLogForModal.books.title}>{selectedLogForModal.books.title}</h2>
                        <p className="text-sm text-gray-500">{selectedLogForModal.books.author || 'Unknown Author'}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full">&times;</button>
             </div>

             {/* Modal Body */}
             <div className="p-6 space-y-4">
                 {/* Modal specific error display */}
                 {error && isModalOpen && (
                      <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md animate-fade-in">{error}</div>
                 )}

                {/* Editable Rating and Review */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <div>
                        <label htmlFor="modal-rating" className="block text-sm font-medium text-gray-700 mb-1"> Rating </label>
                        <select id="modal-rating" value={editRating} onChange={(e) => setEditRating(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                             <option value="">No Rating</option>
                             {[...Array(11)].map((_, i) => <option key={10-i} value={10-i}>{10-i}</option>)}
                         </select>
                    </div>
                    <div className="md:col-span-2">
                         <label htmlFor="modal-review" className="block text-sm font-medium text-gray-700 mb-1"> Review / Thoughts </label>
                         <textarea id="modal-review" rows={3} value={editReview} onChange={(e) => setEditReview(e.target.value)} className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Your review..."></textarea>
                    </div>
                 </div>
                 <div className="flex justify-end">
                     <button onClick={handleUpdateLog} disabled={isUpdatingLog} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm">
                         {isUpdatingLog ? 'Saving...' : 'Save Changes'}
                     </button>
                 </div>
                 <hr className="my-4"/>

                 {/* Notes and Chapters Display (Read Only in this reverted version) */} 
                 <div className="space-y-4">
                     <h3 className="text-lg font-semibold text-gray-700 mb-2">Progress & Notes</h3>
                     {loadingModalDetails ? (
                         <p className="text-sm text-gray-500">Loading details...</p>
                     ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* Chapters Display */} 
                            <div>
                                <h4 className="text-sm font-semibold text-gray-600 mb-1">Chapters Logged</h4>
                                 {modalChapters.length === 0 ? (<p className="text-xs text-gray-500 italic">No chapters logged.</p>) : 
                                (<ul className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2 bg-gray-50 text-xs"> {modalChapters.map(chap => (<li key={chap.id} className="flex justify-between"><span>{chap.chapter_title || `Chapter ${chap.chapter_number || 'N/A'}`}</span> <span className="text-gray-400">({new Date(chap.created_at).toLocaleDateString()})</span></li>))} </ul>)}
                            </div>
                            {/* Notes Display */} 
                             <div>
                                <h4 className="text-sm font-semibold text-gray-600 mb-1">Notes</h4>
                                 {modalNotes.length === 0 ? (<p className="text-xs text-gray-500 italic">No notes added.</p>) : 
                                (<ul className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2 bg-gray-50"> {modalNotes.map(note => (<li key={note.id} className="text-xs text-gray-800 bg-white p-1.5 rounded border border-gray-200 shadow-sm"> {note.chapter && <strong className="text-gray-500 text-[10px] block mb-0.5">[{note.chapter}] </strong>} <p className="whitespace-pre-wrap">{note.note_text}</p> <span className="text-[10px] text-gray-400 block text-right">({new Date(note.created_at).toLocaleDateString()})</span></li>))} </ul>)}
                             </div>
                         </div>
                     )}
                 </div>

                 {/* NOTE: Add chapter/note functionality is removed in this reverted version */} 

             </div>
             {/* Modal Footer */}
             <div className="p-4 bg-gray-50 border-t flex justify-end">
                 <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                     Close
                 </button>
             </div>
          </div>
        </div>
       )}

       {/* Basic CSS for modal animation - add to globals.css or use Tailwind config */}
       <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-modal-scale-in { animation: scaleIn 0.2s ease-out forwards; }
       `}</style>

    </div>
  );
}
