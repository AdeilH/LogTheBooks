ALTER TABLE public.books
ADD CONSTRAINT unique_book_title_author UNIQUE (title, author);


