import { useNavigate } from 'react-router-dom';
import { Book, deleteBook } from '../api';

const TAG_COLORS: Record<string, string> = {
  Documentary: 'bg-blue-100 text-blue-700',
  Portrait: 'bg-green-100 text-green-700',
  Nudity: 'bg-red-100 text-red-700',
  Fashion: 'bg-purple-100 text-purple-700',
};

interface BookCardProps {
  book: Book;
  onDeleted: (id: number) => void;
}

export function BookCard({ book, onDeleted }: BookCardProps) {
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!confirm(`Delete "${book.title}"?`)) return;
    await deleteBook(book.id);
    onDeleted(book.id);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 leading-snug">{book.title}</h3>
          {book.author && (
            <p className="text-sm text-gray-500 mt-0.5">{book.author}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 mt-1 text-xs text-gray-400">
            {book.editorial && <span>{book.editorial}</span>}
            {book.year_of_publication && (
              <>
                {book.editorial && <span>·</span>}
                <span>{book.year_of_publication}</span>
              </>
            )}
            {book.isbn && (
              <>
                {(book.editorial || book.year_of_publication) && <span>·</span>}
                <span className="font-mono">{book.isbn}</span>
              </>
            )}
          </div>
          {book.description && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{book.description}</p>
          )}
          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {book.cover_image && (
          <img
            src={book.cover_image}
            alt="Cover"
            className="w-14 h-20 object-cover rounded-lg border border-gray-200 shrink-0"
          />
        )}
        <div className="flex gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => navigate(`/edit/${book.id}`)}
            className="text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
