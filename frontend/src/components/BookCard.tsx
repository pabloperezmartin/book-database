import { useNavigate, useLocation } from 'react-router-dom';
import { Book, deleteBook, bookCoverUrl } from '../api';

const TAG_COLORS: Record<string, string> = {
  Conceptual: 'bg-sky-50 text-sky-700 ring-sky-200',
  Documentary: 'bg-blue-50 text-blue-700 ring-blue-200',
  Fashion: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  Nudity: 'bg-rose-50 text-rose-700 ring-rose-200',
  Landscape: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Portrait: 'bg-amber-50 text-amber-700 ring-amber-200',
  StreetPhotography: 'bg-violet-50 text-violet-700 ring-violet-200',
  WarPhotography: 'bg-red-50 text-red-700 ring-red-200',
};

interface BookCardProps {
  book: Book;
  onDeleted: (id: number) => void;
  listIds: number[];
}

export function BookCard({ book, onDeleted, listIds }: BookCardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleDelete = async () => {
    if (!confirm(`Delete "${book.title}"?`)) return;
    await deleteBook(book.id);
    onDeleted(book.id);
  };

  const prizeParts = book.prize ? book.prize.split('#') : null;
  const prizeName = prizeParts?.[0];
  const prizeYear = prizeParts?.[1];

  return (
    <div
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/edit/${book.id}`, { state: { from: `/${location.search}`, listIds } })}
    >
      <div className="flex">
        {/* Cover image column */}
        {book.has_cover && (
          <div className="shrink-0 w-20 sm:w-24">
            <img
              src={bookCoverUrl(book.id)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
                {book.title}
              </h3>
              {book.author && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">{book.author}</p>
              )}
            </div>
            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/edit/${book.id}`, { state: { from: `/${location.search}`, listIds } }); }}
                className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1.5 text-xs text-gray-400">
            {book.type && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
                {book.type}
              </span>
            )}
            {book.editorial && <span>{book.editorial}</span>}
            {book.year_of_publication && (
              <>
                {book.editorial && <span className="text-gray-300">·</span>}
                <span>{book.year_of_publication}</span>
              </>
            )}
            {book.collection && (
              <>
                {(book.editorial || book.year_of_publication) && <span className="text-gray-300">·</span>}
                <span className="text-indigo-500 font-medium">{book.collection}</span>
              </>
            )}
            {book.isbn && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-mono text-gray-400">{book.isbn}</span>
              </>
            )}
          </div>

          {/* Prize */}
          {prizeName && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 font-medium">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v1a2 2 0 002 2h1v1.586l-4.293 4.293a1 1 0 00-.207.293l-1 3a1 1 0 001.32 1.32l3-1a1 1 0 00.293-.207L10 11.414l4.586 4.586a1 1 0 00.293.207l3 1a1 1 0 001.32-1.32l-1-3a1 1 0 00-.207-.293L13.414 8H15a2 2 0 002-2V4a2 2 0 00-2-2H5z" clipRule="evenodd" />
              </svg>
              {prizeName}{prizeYear ? ` (${prizeYear})` : ''}
            </div>
          )}

          {/* Description */}
          {book.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{book.description}</p>
          )}

          {/* Tags */}
          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ring-1 ${TAG_COLORS[tag] ?? 'bg-gray-50 text-gray-600 ring-gray-200'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
