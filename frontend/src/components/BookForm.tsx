import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createBook, updateBook, getBook, lookupISBN, BookFormData } from '../api';
import { BarcodeScanner } from './BarcodeScanner';

const TAGS = ['Documentary', 'Portrait', 'Nudity', 'Fashion'] as const;

const TAG_COLORS: Record<string, { on: string; off: string }> = {
  Documentary: { on: 'bg-blue-100 text-blue-800 border-blue-300', off: 'bg-white text-gray-500 border-gray-300' },
  Portrait:    { on: 'bg-green-100 text-green-800 border-green-300', off: 'bg-white text-gray-500 border-gray-300' },
  Nudity:      { on: 'bg-red-100 text-red-800 border-red-300', off: 'bg-white text-gray-500 border-gray-300' },
  Fashion:     { on: 'bg-purple-100 text-purple-800 border-purple-300', off: 'bg-white text-gray-500 border-gray-300' },
};

const EMPTY_FORM: BookFormData = {
  title: '',
  author: '',
  editorial: '',
  year_of_publication: null,
  isbn: '',
  tags: [],
  cover_image: null,
  description: null,
};

type LookupStatus = 'idle' | 'loading' | 'found' | 'not-found';

export function BookForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm] = useState<BookFormData>(EMPTY_FORM);
  const [showScanner, setShowScanner] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');

  useEffect(() => {
    if (!isEditing || !id) return;
    setFetching(true);
    getBook(parseInt(id))
      .then((book) =>
        setForm({
          title: book.title,
          author: book.author,
          editorial: book.editorial,
          year_of_publication: book.year_of_publication,
          isbn: book.isbn,
          tags: book.tags,
          cover_image: book.cover_image,
          description: book.description,
        })
      )
      .finally(() => setFetching(false));
  }, [id, isEditing]);

  const handleISBNLookup = async (isbn: string) => {
    setLookupStatus('loading');
    const data = await lookupISBN(isbn);
    if (Object.keys(data).length > 0) {
      setForm((prev) => ({ ...prev, ...data, isbn, tags: prev.tags }));
      setLookupStatus('found');
    } else {
      setLookupStatus('not-found');
    }
    setTimeout(() => setLookupStatus('idle'), 4000);
  };

  const handleScan = (isbn: string) => {
    setShowScanner(false);
    setForm((prev) => ({ ...prev, isbn }));
    handleISBNLookup(isbn);
  };

  const toggleTag = (tag: string) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing && id) {
        await updateBook(parseInt(id), form);
      } else {
        await createBook(form);
      }
      navigate('/');
    } catch {
      alert('Failed to save the book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
      <canvas ref={canvasRef} className="hidden" />

      <div className="pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing ? 'Edit Book' : 'Add New Book'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ISBN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.isbn}
                onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))}
                placeholder="e.g. 9780061965784"
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 whitespace-nowrap"
              >
                📷 Scan
              </button>
              {form.isbn && (
                <button
                  type="button"
                  onClick={() => handleISBNLookup(form.isbn)}
                  disabled={lookupStatus === 'loading'}
                  className="bg-gray-100 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 whitespace-nowrap disabled:opacity-50"
                >
                  🔍
                </button>
              )}
            </div>
            {lookupStatus === 'loading' && (
              <p className="text-xs text-indigo-500 mt-1.5">Looking up book info…</p>
            )}
            {lookupStatus === 'found' && (
              <p className="text-xs text-green-600 mt-1.5">✓ Book info found and filled in automatically</p>
            )}
            {lookupStatus === 'not-found' && (
              <p className="text-xs text-amber-600 mt-1.5">Book not found in Open Library. Please fill in manually.</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Book title"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
              placeholder="Author name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Editorial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editorial / Publisher</label>
            <input
              type="text"
              value={form.editorial}
              onChange={(e) => setForm((prev) => ({ ...prev, editorial: e.target.value }))}
              placeholder="Publisher name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year of Publication</label>
            <input
              type="number"
              min="1000"
              max="2099"
              value={form.year_of_publication ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  year_of_publication: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
              placeholder="e.g. 2023"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const active = form.tags.includes(tag);
                const colors = TAG_COLORS[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      active ? colors.on : colors.off
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value || null }))
              }
              placeholder="Notes, impressions, summary…"
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
            {form.cover_image && (
              <div className="mb-2 relative inline-block">
                <img
                  src={form.cover_image}
                  alt="Cover"
                  className="h-36 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, cover_image: null }))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                  const MAX = 600;
                  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                  const canvas = canvasRef.current!;
                  canvas.width = img.width * scale;
                  canvas.height = img.height * scale;
                  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                  setForm((prev) => ({ ...prev, cover_image: canvas.toDataURL('image/jpeg', 0.8) }));
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : isEditing ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
