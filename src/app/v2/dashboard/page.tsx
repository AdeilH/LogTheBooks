'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

// --- Interfaces ---
interface Book {
  id: number;
  title: string;
  author: string | null;
  cover_image_url: string | null;
}

interface Tag {
  id: number;
  name: string;
}

interface BookLog {
  id: number;
  user_id: string;
  book_id: number;
  rating: number | null;
  review_text: string | null;
  read_status: string;
  created_at: string; // Added in DB schema, ensure it's selected if needed
  books: {
    id: number;
    title: string;
    author: string | null;
    cover_image_url: string | null;
  } | null;
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

// --- Component ---
export default function DashboardPageV2() { // Renamed component
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Search and Log State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [notes, setNotes] = useState(''); // Note for initial log
  const [chapter, setChapter] = useState(''); // Chapter context for initial log
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // Log Display State
  const [loggedBooks, setLoggedBooks] = useState<BookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLogForModal, setSelectedLogForModal] = useState<BookLog | null>(null);
  const [modalError, setModalError] = useState<string | null>(null); // Specific error state for modal operations
  const [modalSuccess, setModalSuccess] = useState<string | null>(null); // Specific success state for modal operations
  const [modalNotes, setModalNotes] = useState<LogNote[]>([]);
  const [modalChapters, setModalChapters] = useState<LogChapter[]>([]);
  const [loadingModalDetails, setLoadingModalDetails] = useState(false);
  // Edit state within modal
  const [editRating, setEditRating] = useState<number | string>(''); // String for select
  const [editReview, setEditReview] = useState('');
  const [isUpdatingLog, setIsUpdatingLog] = useState(false);

  // State for editing/adding chapters & notes within modal
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null); // ID of chapter being edited
  const [editChapterTitle, setEditChapterTitle] = useState(''); // Input value for chapter edit
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string | null | undefined>(undefined); // To filter notes: undefined=nothing, null=general, string=specific chapter
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null); // ID of note being edited
  const [editNoteText, setEditNoteText] = useState(''); // Input value for note text edit

  const [showAddChapterForm, setShowAddChapterForm] = useState(false); // Toggle for showing the add chapter form
  const [showAddNoteForm, setShowAddNoteForm] = useState(false); // Toggle for showing the add note form
  const [newChapterTitle, setNewChapterTitle] = useState(''); // Input for new chapter title
  const [newNoteText, setNewNoteText] = useState(''); // Input for new note text

  const [isSavingChapter, setIsSavingChapter] = useState(false); // Loading state for chapter save/add
  const [isSavingNote, setIsSavingNote] = useState(false); // Loading state for note save/add

  // Tag State
  const [modalLogTags, setModalLogTags] = useState<Tag[]>([]); // Tags specifically for the log in the modal
  const [userTags, setUserTags] = useState<Tag[]>([]); // All tags created by the user
  const [selectedFilterTagId, setSelectedFilterTagId] = useState<number | null>(null); // For filtering the main log list
  const [newTagInput, setNewTagInput] = useState(''); // Input field for adding a new tag
  const [isSavingTag, setIsSavingTag] = useState(false); // Loading state for tag operations

  // General Messages
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  // --- Effects ---

  // Clear messages automatically
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  // Fetch User and Initial Logs
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        console.error('DashboardV2: No user found, redirecting.', userError);
        router.push('/');
        return;
      }
      setUser(currentUser);
      setLoading(false);

      // Also fetch all user tags for filtering options
      const { data: allTagsData, error: tagsError } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', currentUser.id)
        .order('name');

      if (tagsError) {
        console.error("DashboardV2: Error fetching user tags:", tagsError);
        // Don't block the whole dashboard, but maybe show a specific error?
        setError("Could not load tag filter options."); 
      } else {
        setUserTags(allTagsData || []);
      }
    };
    fetchUserData();
  }, [router]);

  // Debounced Book Search
  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const { data, error: searchError } = await supabase.from('books').select('id, title, author, cover_image_url').ilike('title', `%${term}%`).limit(10);
      if (searchError) throw searchError;
      setSearchResults(data || []);
    } catch (err: any) {
      console.error('Error searching books:', err);
      setError('Could not perform book search.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => { performSearch(searchTerm); }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, performSearch]);

  // Clear search results when a book is selected
  useEffect(() => {
    if (selectedBook) {
      setSearchResults([]);
      setSearchTerm(selectedBook.title);
    }
  }, [selectedBook]);

  // --- Handlers ---

  const fetchLogs = async (userId: string, tagId: number | null = null) => {
    if (!userId) return;
    setLoadingLogs(true); // Start loading indicator

    try {
      let query = supabase
        .from('book_logs')
        .select(`
          id, user_id, book_id, rating, review_text, read_status, created_at,
          books ( id, title, author, cover_image_url ),
          log_tags ( tag_id )  // Select related tags to check existence
        `)
        .eq('user_id', userId);

      // Apply tag filtering if a tagId is provided
      if (tagId !== null) {
        // We need logs WHERE a log_tags entry exists with the given tag_id.
        // Using `.filter()` on the joined table is a common way.
        query = query.filter('log_tags.tag_id', 'eq', tagId);
        // An alternative, potentially more performant for many tags, is an RPC function.
      }

      // Add sorting after filtering
      query = query.order('created_at', { ascending: false });

      // Execute the query
      const { data: logsData, error: logsError } = await query;

      if (logsError) throw logsError;

      const formattedLogs: BookLog[] = (logsData || []).map((log: any) => ({ ...log, books: log.books && !Array.isArray(log.books) ? log.books : null }));

      // If filtering, ensure only logs that *actually* have the tag are included
      // (The `.filter` above might return logs even if the log_tags entry is null for other reasons)
      const finalLogs = tagId !== null 
          ? formattedLogs.filter(log => (log as any).log_tags && (log as any).log_tags.length > 0)
          : formattedLogs;

      setLoggedBooks(finalLogs);

    } catch (err: any) {
        console.error("DashboardV2: Error fetching logs:", err);
        setError('Could not fetch your logged books.');
        setLoggedBooks([]); // Clear logs on error
    } finally {
        setLoadingLogs(false); // Stop loading indicator regardless of success/fail
    }
  };

  // Effect to refetch logs when filter tag or user changes
  useEffect(() => {
    if (user) {
      fetchLogs(user.id, selectedFilterTagId); // Pass the filter ID
    }
  }, [selectedFilterTagId, user]); // Re-run when filter changes or user loads

  const handleLogBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBook || !user) return;
    setError(null);
    setSuccessMessage(null);
    setIsSubmittingLog(true);

    const currentTimestamp = new Date().toISOString();
    // rating state is number | null
    const finalRating = rating;

    try {
      const { data: existingLog, error: checkError } = await supabase.from('book_logs').select('id').eq('user_id', user.id).eq('book_id', selectedBook.id).maybeSingle();
      if (checkError) throw checkError;

      let logId: number;
      if (existingLog) {
        logId = existingLog.id;
        const { error: updateLogError } = await supabase.from('book_logs').update({ rating: finalRating, review_text: review.trim() || null, updated_at: currentTimestamp }).eq('id', logId);
        if (updateLogError) throw updateLogError;
      } else {
        const { data: newLogData, error: insertLogError } = await supabase.from('book_logs').insert({ user_id: user.id, book_id: selectedBook.id, rating: finalRating, review_text: review.trim() || null, read_status: 'read', created_at: currentTimestamp, updated_at: currentTimestamp }).select('id').single();
        if (insertLogError || !newLogData) throw insertLogError || new Error('Failed to create log.');
        logId = newLogData.id;
      }

      // Add initial Note if provided
      if (notes.trim()) {
        const { error: noteError } = await supabase.from('log_notes').insert({ log_id: logId, user_id: user.id, note_text: notes.trim(), chapter: chapter.trim() || null, created_at: currentTimestamp });
        if (noteError) console.warn('Could not save initial note:', noteError.message);
      }

      // Add initial Chapter if provided
      if (chapter.trim()) {
        const { error: chapterError } = await supabase.from('log_chapters').insert({ log_id: logId, user_id: user.id, chapter_title: chapter.trim(), created_at: currentTimestamp });
        if (chapterError) console.warn('Could not save initial chapter log:', chapterError.message);
      }

      setSuccessMessage(`Successfully logged '${selectedBook.title}'!`);
      await fetchLogs(user.id);
      resetLogForm();

    } catch (err: any) {
      console.error('DashboardV2: Error logging book:', err);
      setError(err.message || 'An unexpected error occurred.');
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
    } else {
      router.push('/');
    }
  };

  const handleOpenModal = async (log: BookLog) => {
    if (!log.books) {
      setError("Log details unavailable.");
      return;
    }
    setSelectedLogForModal(log);

    // Ensure user is available before proceeding with user-specific fetches
    if (!user) {
        setModalError("User session lost. Please refresh.");
        setLoadingModalDetails(false);
        return;
    }

    setEditRating(log.rating?.toString() ?? ''); // String for select
    setEditReview(log.review_text || '');
    setIsModalOpen(true);
    setLoadingModalDetails(true);
    setError(null);
    setModalNotes([]);
    setModalChapters([]);
    setModalLogTags([]);
    setNewTagInput('');

    try {
      const [notesRes, chaptersRes, logTagsRes, userTagsRes] = await Promise.all([
        supabase.from('log_notes').select('*').eq('log_id', log.id).order('created_at', { ascending: true }),
        supabase.from('log_chapters').select('*').eq('log_id', log.id).order('created_at', { ascending: true }),
        supabase.from('log_tags').select('tags(id, name)').eq('log_id', log.id).eq('user_id', user.id),
        supabase.from('tags').select('id, name').eq('user_id', user.id).order('name')
      ]);
      if (notesRes.error) throw notesRes.error;
      setModalNotes(notesRes.data || []);
      if (chaptersRes.error) throw chaptersRes.error;
      setModalChapters(chaptersRes.data || []);
      if (logTagsRes.error) throw logTagsRes.error;
      const currentLogTags = (logTagsRes.data || []).map((item: any) => item.tags).filter((tag): tag is Tag => tag !== null);
      setModalLogTags(currentLogTags);
      if (userTagsRes.error) throw userTagsRes.error;
      setUserTags(userTagsRes.data || []);
    } catch (err: any) {
      console.error("Error fetching modal details:", err);
      setModalError("Could not load log details (notes/chapters/tags).");
    } finally {
      setLoadingModalDetails(false);
    }
  };

  const handleUpdateLog = async () => {
    if (!selectedLogForModal || !user) return;
    setError(null);
    setIsUpdatingLog(true);
    const finalRating = editRating === '' ? null : Number(editRating);
    try {
      const { error: updateError } = await supabase.from('book_logs').update({ rating: finalRating, review_text: editReview.trim() || null, updated_at: new Date().toISOString() }).eq('id', selectedLogForModal.id).eq('user_id', user.id);
      if (updateError) throw updateError;
      const updatedLog = { ...selectedLogForModal, rating: finalRating, review_text: editReview.trim() || null };
      setLoggedBooks(prevLogs => prevLogs.map(log => log.id === updatedLog.id ? updatedLog : log));
      setSelectedLogForModal(updatedLog);
      setSuccessMessage("Log updated successfully!");
      setModalSuccess("Overall log updated."); // Set modal-specific success
      // Keep modal open to see updates
      // setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error updating log:", err);
      setModalError("Failed to update overall log."); // Set modal-specific error
    } finally {
      setIsUpdatingLog(false);
    }
  };

  // --- Helper Functions ---
  const resetLogForm = () => {
    setSelectedBook(null);
    setSearchTerm('');
    setSearchResults([]);
    setRating(null);
    setReview('');
    setNotes('');
    setChapter('');
  };

  // Reset edit/add states when modal opens/closes or saves happen
  const resetModalEditStates = () => {
    setEditingChapterId(null);
    setEditChapterTitle('');
    setEditingNoteId(null);
    setEditNoteText('');

    setShowAddChapterForm(false);
    setShowAddNoteForm(false);
    setNewChapterTitle('');
    setNewNoteText('');

    setSelectedChapterTitle(undefined);

    setModalError(null);
    setModalSuccess(null);
    setIsUpdatingLog(false);

    setModalLogTags([]);
    setNewTagInput('');
    setIsSavingTag(false);
  };

  // Fetch only modal details (notes and chapters)
  const fetchModalDetails = async (logId: number) => {
    if (!logId) return;
    setLoadingModalDetails(true);
    setModalError(null);
    try {
      const [notesRes, chaptersRes, logTagsRes] = await Promise.all([
        supabase.from('log_notes').select('*').eq('log_id', logId).order('created_at', { ascending: true }),
        supabase.from('log_chapters').select('*').eq('log_id', logId).order('created_at', { ascending: true }),
        supabase.from('log_tags').select('tags(id, name)').eq('log_id', logId)
      ]);
      if (notesRes.error) throw notesRes.error;
      setModalNotes(notesRes.data || []);
      if (chaptersRes.error) throw chaptersRes.error;
      setModalChapters(chaptersRes.data || []);
      if (logTagsRes.error) throw logTagsRes.error;
      const currentLogTags = (logTagsRes.data || []).map((item: any) => item.tags).filter((tag): tag is Tag => tag !== null);
      setModalLogTags(currentLogTags);
    } catch (err: any) {
      console.error("Error fetching modal details:", err);
      setModalError("Could not reload notes/chapters/tags details.");
    } finally {
      setLoadingModalDetails(false);
    }
  };

  // --- Chapter Edit/Add Handlers ---
  const handleSaveChapterEdit = async () => {
    if (!editingChapterId || !selectedLogForModal || !user) return;

    setIsSavingChapter(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      // Find the original chapter title before update
      const originalChapter = modalChapters.find(c => c.id === editingChapterId);
      const originalChapterTitle = originalChapter?.chapter_title; // Could be null

      const { error } = await supabase
        .from('log_chapters')
        .update({ chapter_title: editChapterTitle.trim() || null })
        .eq('id', editingChapterId)
        .eq('user_id', user.id); // Ensure user owns the record

      if (error) throw error;

      setModalSuccess('Chapter updated successfully.');
      await fetchModalDetails(selectedLogForModal.id);
      resetModalEditStates(); // Close edit form

      // Also update the chapter context in associated notes
      const { error: noteUpdateError } = await supabase
        .from('log_notes')
        .update({ chapter: editChapterTitle.trim() || null })
        .eq('log_id', selectedLogForModal.id)
        .eq('chapter', modalChapters.find(c => c.id === editingChapterId)?.chapter_title); // Match notes linked to the *original* title

      if (noteUpdateError) {
        console.error('Error updating notes chapter context:', noteUpdateError);
        // Set a secondary error, maybe append? For now, just log it.
        setModalError("Chapter updated, but failed to update linked notes' context.");
      } else {
        setModalSuccess('Chapter and linked notes updated.');
      }

    } catch (err: any) {
      console.error("Error updating chapter:", err);
      setModalError("Failed to update chapter.");
    } finally {
      setIsSavingChapter(false);
    }
  };

  const handleAddNewChapter = async () => {
    if (!newChapterTitle.trim() || !selectedLogForModal || !user) return;

    setIsSavingChapter(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const { error } = await supabase
        .from('log_chapters')
        .insert({ 
          log_id: selectedLogForModal.id, 
          user_id: user.id, 
          chapter_title: newChapterTitle.trim()
        });

      if (error) throw error;

      setModalSuccess(`Chapter '${newChapterTitle.trim()}' added successfully.`);
      await fetchModalDetails(selectedLogForModal.id);
      resetModalEditStates(); // Hide add form and clear inputs
      setSelectedChapterTitle(undefined); // Reset selected chapter to nothing selected

    } catch (err: any) {
      console.error("Error adding new chapter:", err);
      setModalError("Failed to add new chapter.");
    } finally {
      setIsSavingChapter(false);
    }
  };

  // --- Note Edit/Add Handlers ---
  const handleSaveNoteEdit = async () => {
    if (!editingNoteId || !selectedLogForModal || !user) return;

    setIsSavingNote(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      const { error } = await supabase
        .from('log_notes')
        .update({ note_text: editNoteText.trim() })
        .eq('id', editingNoteId)
        .eq('user_id', user.id); // Ensure user owns the record

      if (error) throw error;

      setModalSuccess('Note updated.');
      await fetchModalDetails(selectedLogForModal.id);
      resetModalEditStates(); // Close edit form

    } catch (err: any) {
      console.error("Error updating note:", err);
      setModalError("Failed to update note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddNewNote = async () => {
    if (!newNoteText.trim() || !selectedLogForModal || !user) return;

    setIsSavingNote(true);
    setModalError(null);
    setModalSuccess(null);

    // Determine context from the new chapter title if available
    const contextForNote = newChapterTitle.trim() || null;

    // Re-determine context based on the *selected* chapter title for adding notes
    const contextForNewNote = selectedChapterTitle; // Can be string or null

    try {
      const { error } = await supabase
        .from('log_notes')
        .insert({ 
          log_id: selectedLogForModal.id, 
          user_id: user.id, 
          note_text: newNoteText.trim(),
          chapter: contextForNewNote
        });

      if (error) throw error;

      setModalSuccess('Note added successfully.');
      await fetchModalDetails(selectedLogForModal.id);
      // Keep selected chapter, just clear the note input and hide form
      setNewNoteText('');
      setShowAddNoteForm(false);

    } catch (err: any) {
      console.error("Error adding new note:", err);
      setModalError("Failed to add new note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  // --- Tag Handlers ---
  const handleAddTag = async () => {
    if (!newTagInput.trim() || !selectedLogForModal || !user) return;

    const tagName = newTagInput.trim().toLowerCase(); // Normalize tag name
    // Prevent adding tags that are already present for this log
    if (modalLogTags.some(tag => tag.name.toLowerCase() === tagName)) {
      setModalError(`Tag "${tagName}" already added to this log.`);
      setNewTagInput('');
      setTimeout(() => setModalError(null), 3000);
      return;
    }

    setIsSavingTag(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      // 1. Find or Create Tag in `tags` table
      let tagId: number;
      const { data: existingTag, error: findError } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', tagName)
        .maybeSingle();

      if (findError) throw new Error(`Error checking for tag: ${findError.message}`);

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        // Tag doesn't exist for user, create it
        const { data: newTag, error: insertTagError } = await supabase
          .from('tags')
          .insert({ user_id: user.id, name: tagName })
          .select('id')
          .single();
        if (insertTagError || !newTag) throw new Error(`Error creating tag: ${insertTagError?.message || 'Unknown error'}`);
        tagId = newTag.id;
        // Optionally update the global userTags state if needed elsewhere, 
        // but for now, just adding to the modal state is sufficient upon success.
        // setUserTags(prev => [...prev, { id: newTag.id, name: tagName }].sort((a, b) => a.name.localeCompare(b.name)));
      }

      // 2. Create the link in `log_tags` table
      const { error: linkError } = await supabase
        .from('log_tags')
        .insert({ 
          log_id: selectedLogForModal.id,
          tag_id: tagId,
          user_id: user.id 
        });

      // Handle potential unique constraint violation (should be prevented by initial check, but as fallback)
      if (linkError && linkError.code === '23505') { 
         // Ignore duplicate error, tag link already exists
         console.warn('Attempted to add duplicate tag link.');
      } else if (linkError) {
         throw new Error(`Error linking tag: ${linkError.message}`);
      }

      // 3. Update UI State
      // Refetch or update locally. Local update is faster.
      const addedTag = { id: tagId, name: tagName }; // Use the normalized name
      setModalLogTags(prev => [...prev, addedTag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagInput('');
      setModalSuccess(`Tag "${tagName}" added.`);
      setTimeout(() => setModalSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error adding tag:", err);
      setModalError(err.message || "Failed to add tag.");
      setTimeout(() => setModalError(null), 5000);
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleRemoveTag = async (tagIdToRemove: number) => {
    if (!selectedLogForModal || !user) return;

    setIsSavingTag(true); // Use the same loading state for simplicity
    setModalError(null);
    setModalSuccess(null);

    try {
      const { error } = await supabase
        .from('log_tags')
        .delete()
        .eq('log_id', selectedLogForModal.id)
        .eq('tag_id', tagIdToRemove)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update UI state locally
      const removedTagName = modalLogTags.find(t => t.id === tagIdToRemove)?.name || ''
      setModalLogTags(prev => prev.filter(tag => tag.id !== tagIdToRemove));
      setModalSuccess(`Tag "${removedTagName}" removed.`);
      setTimeout(() => setModalSuccess(null), 3000);

    } catch (err: any) {
      console.error("Error removing tag:", err);
      setModalError(err.message || "Failed to remove tag.");
      setTimeout(() => setModalError(null), 5000);
    } finally {
      setIsSavingTag(false);
    }
  };

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="ml-3 text-lg font-medium text-slate-700">Loading Dashboard V2...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <p className="text-lg font-semibold text-red-600 mb-4">Authentication required.</p>
          <Link href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // --- Main JSX (Modernized UI) ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex justify-between items-center h-16">
             <div className="flex-shrink-0 flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span className="ml-2 text-xl font-bold text-slate-800">LogTheBooks</span>
             </div>
             <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600 hidden md:inline">{user.email}</span>
                <button onClick={handleSignOut} disabled={loggingOut} className="px-3 py-1.5 text-sm font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-60 transition shadow-sm">
                  {loggingOut ? 'Signing Out...' : 'Sign Out'}
                </button>
             </div>
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
         {/* Global Messages Area */} 
         <div className="px-4 sm:px-0 mb-4 space-y-2 h-10"> {/* Fixed height */} 
            {successMessage && (
                <div className="p-3 text-sm text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md shadow-sm animate-fade-in">
                {successMessage}
                </div>
            )}
            {error && (
                <div className="p-3 text-sm text-red-800 bg-red-100 border border-red-300 rounded-md shadow-sm animate-fade-in">
                {error}
                </div>
            )}
         </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Log/Search Section (Sticky Sidebar) */}
          <section className="lg:col-span-4 bg-white p-5 rounded-lg shadow-lg border border-slate-200 h-fit lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 border-b border-slate-200 pb-2">
              {selectedBook ? 'Log Details for Selected Book' : 'Find & Log a New Read'}
            </h2>

            {!selectedBook ? (
              // Search View
              <div className="space-y-3">
                <div className="relative">
                  <label htmlFor="search-book" className="sr-only">Search book title</label>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                  </div>
                  <input id="search-book" type="text" placeholder="Search by title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm" />
                  {isSearching && (
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                         <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     </div>
                  )}
                </div>

                {/* Search Results */}
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-md bg-slate-50/80 text-sm shadow-inner">
                  {searchTerm && !isSearching && searchResults.length === 0 && (<p className="text-center text-slate-500 py-4 px-2">No books found.</p>)}
                  {searchResults.map((book) => (
                    <div key={book.id} className="flex items-center justify-between p-2 border-b border-slate-200 last:border-b-0 hover:bg-indigo-50 transition duration-150 ease-in-out">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={book.cover_image_url || '/placeholder-cover.svg'} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0 border border-slate-200" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                        <div className="overflow-hidden whitespace-nowrap">
                          <p className="font-medium text-slate-800 truncate text-sm" title={book.title}>{book.title}</p>
                          <p className="text-xs text-slate-500 truncate">{book.author || 'Unknown'}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedBook(book)} className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition shadow-sm">
                        Select
                      </button>
                    </div>
                  ))}
                  {!searchTerm && !isSearching && (<p className="text-center text-slate-400 py-4 px-2 text-xs italic">Type above to search for books.</p>)}
                </div>
                <Link href="/books/add" className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500">
                  + Add New Book to Library
                </Link>
              </div>
            ) : (
              // Log Form View
              <form onSubmit={handleLogBook} className="space-y-4 text-sm">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200">
                  <img src={selectedBook.cover_image_url || '/placeholder-cover.svg'} alt="" className="w-14 h-[84px] object-cover rounded shadow-md border border-slate-200 flex-shrink-0" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                  <div className="flex-grow">
                    <h3 className="font-semibold text-slate-800 leading-snug">{selectedBook.title}</h3>
                    <p className="text-xs text-slate-500">{selectedBook.author || 'Unknown Author'}</p>
                  </div>
                  <button type="button" onClick={resetLogForm} className="text-slate-400 hover:text-red-600 flex-shrink-0 p-1 rounded-full hover:bg-red-100 transition" title="Change Book">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  </button>
                </div>

                <div>
                  <label htmlFor="rating" className="block text-xs font-medium text-slate-600 mb-1">Rating (0-10)</label>
                  <select id="rating" value={rating ?? ''} onChange={(e) => setRating(e.target.value ? parseInt(e.target.value) : null)} className="block w-full px-3 py-1.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition bg-white">
                    <option value="">-- No Rating --</option>
                    {[...Array(11)].map((_, i) => <option key={10-i} value={10-i}>{10-i}</option>)} { /* 10 to 0 */}
                  </select>
                </div>

                <div>
                  <label htmlFor="review" className="block text-xs font-medium text-slate-600">Review / Thoughts</label>
                  <textarea id="review" rows={3} value={review} onChange={(e) => setReview(e.target.value)} className="block w-full px-3 py-1.5 mt-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition" placeholder="Overall impressions..."></textarea>
                </div>

                <div>
                  <label htmlFor="chapter" className="block text-xs font-medium text-slate-600">Initial Chapter/Context (Optional)</label>
                  <input id="chapter" type="text" value={chapter} onChange={(e) => setChapter(e.target.value)} className="block w-full px-3 py-1.5 mt-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition" placeholder="e.g., Chapter 5 (for note below)" />
                </div>

                <div>
                  <label htmlFor="notes" className="block text-xs font-medium text-slate-600">Add Initial Note (Optional)</label>
                  <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="block w-full px-3 py-1.5 mt-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition" placeholder={`Specific thoughts or quotes${chapter ? ` for ${chapter}` : ''}...`}></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={resetLogForm} className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingLog} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-60 transition">
                    {isSubmittingLog ? 'Saving...' : 'Save Log'}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Right Column: Reading Log Display */}
          <section className="lg:col-span-8">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 px-4 sm:px-0">Your Reading Log (V2)</h2>

            {/* Tag Filter Section */}
            <div className="mb-4 px-4 sm:px-0">
             <h3 className="text-xs font-semibold uppercase text-slate-500 mb-2">Filter by Tag:</h3>
             <div className="flex flex-wrap gap-2">
                 <button 
                     onClick={() => setSelectedFilterTagId(null)} 
                     className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${ 
                         selectedFilterTagId === null 
                         ? 'bg-indigo-600 text-white' 
                         : 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                     }`}
                 >
                     All Books
                 </button>
                 {userTags.map(tag => (
                     <button 
                         key={tag.id} 
                         onClick={() => setSelectedFilterTagId(tag.id)} 
                         className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${ 
                             selectedFilterTagId === tag.id 
                             ? 'bg-indigo-600 text-white' 
                             : 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                         }`}
                     >
                         {tag.name}
                     </button>
                 ))}
                 {userTags.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No tags created yet. Add tags via the modal.</p>
                 )}
             </div>
            </div>

            {loadingLogs ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                 {[...Array(3)].map((_, i) => ( // Skeleton loaders
                    <div key={i} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 animate-pulse">
                        <div className="flex items-start gap-3">
                            <div className="w-14 h-20 bg-slate-200 rounded flex-shrink-0"></div>
                            <div className="flex-grow space-y-2 mt-1">
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                            </div>
                        </div>
                        <div className="h-3 bg-slate-200 rounded w-full mt-3"></div>
                        <div className="h-6 bg-slate-100 rounded w-1/3 mt-4 ml-auto"></div>
                    </div>
                 ))}
              </div>
            ) : loggedBooks.length === 0 ? (
              <div className="text-center text-slate-500 py-10 px-4 bg-white rounded-lg shadow-md border border-dashed border-slate-300">
                <p className="font-medium">No books logged yet.</p>
                <p className="mt-1 text-sm">Use the panel on the left to find and log your reads!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {loggedBooks.map((log) => (
                  // --- Log Card (Refreshed) ---
                  <div key={log.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col group hover:shadow-lg hover:border-indigo-300 transition-all duration-200">
                    <div className="flex items-start gap-3 p-4">
                      <img src={log.books?.cover_image_url || '/placeholder-cover.svg'} alt={log.books?.title ?? 'Book cover'} className="w-14 h-20 object-cover rounded border border-slate-200 flex-shrink-0 shadow-sm" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                      <div className="flex-grow overflow-hidden mt-0.5">
                        <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors" title={log.books?.title ?? 'Unknown Title'}>
                          {log.books?.title || 'Unknown Title'}
                        </h3>
                        <p className="text-xs text-slate-500 mb-1 truncate" title={log.books?.author ?? 'Unknown Author'}>
                          {log.books?.author || 'Unknown Author'}
                        </p>
                        {log.rating !== null && (
                          <div className="flex items-center -ml-0.5" title={`Rated ${log.rating}/10`}>
                            {[...Array(5)].map((_, i) => ( // 5 stars (each represents 2 rating points)
                              <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${log.rating! > i * 2 ? 'text-amber-400' : 'text-slate-300'}`} viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                             <span className="text-xs text-slate-500 ml-1">({log.rating}/10)</span>
                          </div>
                        )}
                        {/* Display created_at if available */} 
                        {log.created_at && <p className="text-xs text-slate-400 mt-1">Logged: {new Date(log.created_at).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    {log.review_text && (
                      <div className="px-4 pb-2 pt-1 border-t border-slate-100">
                        <p className="text-xs text-slate-600 italic line-clamp-2">"{log.review_text}"</p>
                      </div>
                    )}
                    <div className="mt-auto px-4 py-2 bg-slate-50/70 border-t border-slate-200 flex justify-end">
                      <button onClick={() => handleOpenModal(log)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded">
                        View / Edit Details
                      </button>
                    </div>
                  </div>
                  // --- End Log Card ---
                ))}
              </div>
            )}
          </section>

        </div> {/* End Main Content Grid */}
      </main>

       {/* --- Modal (Modernized - Still uses reverted functionality) --- */}
       {isModalOpen && selectedLogForModal && selectedLogForModal.books && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-200 ease-out animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden transform transition-transform duration-200 ease-out scale-95 animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-start p-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <img src={selectedLogForModal.books.cover_image_url || '/placeholder-cover.svg'} alt="" className="w-10 h-14 object-cover rounded border border-slate-200" onError={(e) => { e.currentTarget.src = '/placeholder-cover.svg'; }} />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800" title={selectedLogForModal.books.title}>{selectedLogForModal.books.title}</h2>
                  <p className="text-sm text-slate-500">{selectedLogForModal.books.author || 'Unknown Author'}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-full hover:bg-slate-100 -mt-1 -mr-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-grow text-sm">
               {/* Modal specific error/success messages */} 
                {modalError && (
                    <div className="p-3 text-xs text-red-800 bg-red-100 border border-red-300 rounded-md shadow-sm animate-fade-in">{modalError}</div>
                 )}
               {modalSuccess && (
                   <div className="p-3 text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md shadow-sm animate-fade-in">
                        {modalSuccess}
                    </div>
               )}

              {/* Edit Rating and Review */} 
              <section className="border border-slate-200 rounded-md p-4 bg-slate-50/50">
                 <h3 className="text-sm font-semibold text-slate-700 mb-3">Edit Overall Log</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    <div className="sm:col-span-1">
                        <label htmlFor="modal-rating" className="block text-xs font-medium text-slate-600 mb-1">Rating (0-10)</label>
                        <select id="modal-rating" value={editRating} onChange={(e) => setEditRating(e.target.value)} className="block w-full px-3 py-1.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition bg-white">
                            <option value="">-- No Rating --</option>
                            {[...Array(11)].map((_, i) => <option key={10-i} value={10-i}>{10-i}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                         <label htmlFor="modal-review" className="block text-xs font-medium text-slate-600 mb-1">Review / Thoughts</label>
                         <textarea id="modal-review" rows={2} value={editReview} onChange={(e) => setEditReview(e.target.value)} className="block w-full px-3 py-1.5 mt-1 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition" placeholder="Overall impressions..."></textarea>
                    </div>
                 </div>
                 <div className="flex justify-end mt-3">
                    <button onClick={handleUpdateLog} disabled={isUpdatingLog} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm">
                        {isUpdatingLog ? 'Saving...' : 'Save Rating/Review'}
                    </button>
                 </div>
              </section>

              {/* Tags Section */}
              <section className="border border-slate-200 rounded-md p-4 bg-slate-50/50">
                 <h3 className="text-sm font-semibold text-slate-700 mb-3">Tags</h3>
                 {/* Display Existing Tags */}
                 <div className="flex flex-wrap gap-1.5 mb-3 min-h-[24px]"> {/* Min height to prevent layout shift */}
                    {modalLogTags.length === 0 && (
                         <p className="text-xs text-slate-500 italic">No tags added yet.</p>
                    )}
                     {modalLogTags.map(tag => (
                         <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                         {tag.name}
                         <button 
                             onClick={() => handleRemoveTag(tag.id)} 
                             title={`Remove tag "${tag.name}"`}
                             className="ml-1.5 flex-shrink-0 text-blue-400 hover:text-blue-700 focus:outline-none disabled:opacity-50"
                             disabled={isSavingTag} // Disable while any tag operation is in progress
                         >
                             &times;
                         </button>
                         </span>
                     ))}
                 </div>
                 {/* Add New Tag Form */}
                 <div className="flex gap-2 items-center">
                     <input 
                         type="text"
                         value={newTagInput}
                         onChange={(e) => setNewTagInput(e.target.value)} 
                         placeholder="Add a tag..."
                         className="flex-grow px-2 py-1 border border-slate-300 rounded-md shadow-sm text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition"
                         // TODO: Consider adding datalist for suggestions from userTags
                     />
                     <button 
                         onClick={handleAddTag} 
                         disabled={!newTagInput.trim() || isSavingTag} 
                         className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
                     >
                         {isSavingTag ? 'Adding...' : 'Add Tag'}
                     </button>
                 </div>
               </section>

              {/* Chapters and Notes Display */}
              <section>
                  <h3 className="text-base font-semibold text-slate-700 mb-3">Progress & Notes</h3>
                   {loadingModalDetails ? (<p className="text-xs text-slate-500 italic">Loading details...</p>) :
                   (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                       {/* --- Chapter Column --- */}
                        <div className="flex flex-col">
                            <h4 className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">Chapters Logged</h4>
                            {/* Chapter List Container */}
                            <div className="flex-grow space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 bg-white shadow-inner mb-1">
                                {modalChapters.length === 0 && !showAddChapterForm && (<p className="text-xs text-slate-400 italic text-center py-1">No chapters logged.</p>)}
                                {modalChapters.map(chap => {
                                    const chapterIdentifier = chap.chapter_title; // Can be null
                                    const displayTitle = chap.chapter_title || `Chapter ${chap.chapter_number || 'N/A'}`;
                                    const isSelected = selectedChapterTitle === chapterIdentifier;
                                    return (
                                        <div key={chap.id} className={`text-xs rounded px-1.5 ${isSelected ? 'bg-indigo-100' : 'hover:bg-slate-50'}`}>
                                            {editingChapterId === chap.id ? (
                                                // --- Edit Chapter Form ---
                                                <div className="p-1.5 bg-indigo-50 border border-indigo-200 rounded">
                                                    <input
                                                        type="text"
                                                        value={editChapterTitle}
                                                        onChange={(e) => setEditChapterTitle(e.target.value)}
                                                        className={`w-full px-1.5 py-0.5 border ${isSavingChapter ? 'border-slate-200 bg-slate-100' : 'border-slate-300'} rounded text-xs mb-1`}
                                                        placeholder="Chapter title/number"
                                                        readOnly={isSavingChapter}
                                                    />
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => setEditingChapterId(null)} className="px-1.5 py-0.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                                                        <button onClick={handleSaveChapterEdit} disabled={isSavingChapter} className="px-1.5 py-0.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">{isSavingChapter ? 'Saving...' : 'Save'}</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // --- Display Chapter ---
                                                <div className="flex justify-between items-center py-1 group cursor-pointer" onClick={() => setSelectedChapterTitle(chapterIdentifier)}>
                                                    <span className={`flex-grow text-slate-700 truncate ${isSelected ? 'font-semibold' : ''}`} title={displayTitle}>{displayTitle}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ml-2 flex-shrink-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent selection
                                                                setEditingChapterId(chap.id);
                                                                setEditChapterTitle(chap.chapter_title || '');
                                                                setSelectedChapterTitle(undefined); // Clear selection when editing starts
                                                                setShowAddChapterForm(false); // Hide add form if open
                                                                setShowAddNoteForm(false); // Hide add form if open
                                                            }}
                                                            title="Edit Chapter"
                                                            className="p-0.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                
                            </div> {/* End Chapter List Container */}

                            {/* --- Add Chapter Button/Form --- */}
                            {!showAddChapterForm && editingChapterId === null && (
                                <button onClick={() => {
                                    setShowAddChapterForm(true);
                                    setSelectedChapterTitle(undefined); // Clear selection when starting to add
                                    setEditingChapterId(null); // Ensure no edit is active
                                    setShowAddNoteForm(false); // Hide note form
                                }} className="w-full mt-1 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-medium flex items-center justify-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                    Add Chapter
                                </button>
                            )}
                            {showAddChapterForm && (
                                <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded mt-1">
                                    <input
                                        type="text"
                                        value={newChapterTitle}
                                        onChange={(e) => setNewChapterTitle(e.target.value)}
                                        className={`w-full px-1.5 py-0.5 border ${isSavingChapter ? 'border-slate-200 bg-slate-100' : 'border-slate-300'} rounded text-xs mb-1`}
                                        placeholder="New chapter title/number"
                                        readOnly={isSavingChapter}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => { setShowAddChapterForm(false); setNewChapterTitle(''); setSelectedChapterTitle(undefined); }} className="px-1.5 py-0.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                                        <button onClick={handleAddNewChapter} disabled={!newChapterTitle.trim() || isSavingChapter} className="px-1.5 py-0.5 text-xs text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">{isSavingChapter ? 'Adding...' : 'Add'}</button>
                                    </div>
                                </div>
                            )}
                        </div> {/* End Chapter Column */}

                       {/* --- Notes Column --- */}
                        <div className={selectedChapterTitle === undefined ? 'opacity-50 pointer-events-none' : ''}> {/* Disable notes section if no chapter selected */}
                            <h4 className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                                Notes {(selectedChapterTitle !== undefined) ?
                                        (selectedChapterTitle === null ? '(General)' : `for "${selectedChapterTitle || 'Untitled Chapter'}"`)
                                        : '(Select Chapter/General)'}
                            </h4>
                            {/* Notes List and Add Form Container */}
                            <div className="flex flex-col min-h-[10rem]">
                                {/* Notes List Container */}
                                <div className="flex-grow space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 bg-white shadow-inner mb-1">
                                    {selectedChapterTitle === undefined && (
                                        <p className="text-xs text-slate-400 italic text-center py-4 px-2">Select a chapter or "General Notes" from the left to view associated notes.</p>
                                    )}
                                    {selectedChapterTitle !== undefined && modalNotes.filter(note => note.chapter === selectedChapterTitle).length === 0 && !showAddNoteForm && !editingNoteId && (
                                        <p className="text-xs text-slate-400 italic text-center py-4 px-2">No notes found for this section.</p>
                                    )}
                                    {selectedChapterTitle !== undefined && modalNotes
                                        .filter(note => note.chapter === selectedChapterTitle)
                                        .map(note => (
                                            <div key={note.id} className="text-xs">
                                                {editingNoteId === note.id ? (
                                                    // --- Edit Note Form ---
                                                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded">
                                                        <textarea
                                                            value={editNoteText}
                                                            onChange={(e) => setEditNoteText(e.target.value)}
                                                            rows={2}
                                                            className={`w-full px-1.5 py-1 border ${isSavingNote ? 'border-slate-200 bg-slate-100' : 'border-slate-300'} rounded text-xs mb-1`}
                                                            placeholder="Note text..."
                                                            readOnly={isSavingNote}
                                                        />
                                                        <div className="flex justify-end gap-1 mt-2">
                                                            <button onClick={() => setEditingNoteId(null)} className="px-1.5 py-0.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                                                            <button onClick={handleSaveNoteEdit} disabled={isSavingNote} className="px-1.5 py-0.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">{isSavingNote ? 'Saving...' : 'Save'}</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // --- Display Note ---
                                                    <div className="text-xs text-slate-800 bg-slate-50/70 p-2 rounded border border-slate-100 shadow-sm group relative">
                                                        <p className="whitespace-pre-wrap mb-1">{note.note_text}</p>
                                                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-1 mt-1">
                                                            <span>{new Date(note.created_at).toLocaleString()}</span>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingNoteId(note.id);
                                                                        setEditNoteText(note.note_text);
                                                                        setShowAddNoteForm(false); // Hide add form if open
                                                                    }}
                                                                    title="Edit Note"
                                                                    className="p-0.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                    ))}
                                </div> {/* End Notes List Container */}

                                {/* --- Add Note Button/Form --- (Only show if a chapter/general is selected) */}
                                {selectedChapterTitle !== undefined && !showAddNoteForm && editingNoteId === null && (
                                    <button onClick={() => setShowAddNoteForm(true)} className="w-full mt-1 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded font-medium flex items-center justify-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                                        Add Note {selectedChapterTitle === null ? '(General)' : `to "${selectedChapterTitle || 'Untitled Chapter'}"`}
                                    </button>
                                )}
                                {showAddNoteForm && (
                                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded mt-1">
                                        <textarea
                                            value={newNoteText}
                                            onChange={(e) => setNewNoteText(e.target.value)}
                                            rows={2}
                                            className={`w-full px-1.5 py-1 border ${isSavingNote ? 'border-slate-200 bg-slate-100' : 'border-slate-300'} rounded text-xs mb-1`}
                                            placeholder="New note text..."
                                            readOnly={isSavingNote}
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-1 mt-1">
                                            <button onClick={() => { setShowAddNoteForm(false); setNewNoteText(''); }} className="px-1.5 py-0.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                                            <button onClick={handleAddNewNote} disabled={!newNoteText.trim() || isSavingNote} className="px-1.5 py-0.5 text-xs text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">{isSavingNote ? 'Adding...' : 'Add'}</button>
                                        </div>
                                    </div>
                                )}
                            </div> {/* End Notes List and Add Form Container */}
                        </div> {/* End Notes Column */}
                    </div> // End Grid
                   )}
              </section> 

            </div> {/* End Modal Body */}

             {/* Modal Footer */}
             <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end flex-shrink-0">
                 <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition">
                     Close
                 </button>
             </div>

          </div> {/* End Modal Content */}
        </div> // End Modal Backdrop
       )}

      {/* Global Styles & Animations */}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-modal-scale-in { animation: scaleIn 0.2s ease-out forwards; }
        /* Basic scrollbar styling for modal lists */
        .max-h-32::-webkit-scrollbar, .max-h-40::-webkit-scrollbar {
            width: 6px;
        }
        .max-h-32::-webkit-scrollbar-track, .max-h-40::-webkit-scrollbar-track {
            background: #f1f5f9; /* slate-100 */
            border-radius: 3px;
        }
        .max-h-32::-webkit-scrollbar-thumb, .max-h-40::-webkit-scrollbar-thumb {
            background: #cbd5e1; /* slate-300 */
            border-radius: 3px;
        }
        .max-h-32::-webkit-scrollbar-thumb:hover, .max-h-40::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; /* slate-400 */
        }
      `}</style>

    </div> // End Page Container
  );
} 