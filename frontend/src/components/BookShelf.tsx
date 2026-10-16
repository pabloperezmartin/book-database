import { useNavigate, useLocation } from 'react-router-dom';
import { Book } from '../api';

const SPINE_COLORS = [
  'from-indigo-800 to-indigo-900',
  'from-emerald-800 to-emerald-900',
  'from-amber-800 to-amber-900',
  'from-rose-800 to-rose-900',
  'from-violet-800 to-violet-900',
  'from-sky-800 to-sky-900',
  'from-slate-700 to-slate-800',
  'from-orange-800 to-orange-900',
  'from-teal-800 to-teal-900',
  'from-fuchsia-800 to-fuchsia-900',
];

function hashColor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = ((h << 5) - h + title.charCodeAt(i)) | 0;
  return SPINE_COLORS[Math.abs(h) % SPINE_COLORS.length];
}

interface BookShelfProps {
  books: Book[];
  listIds: number[];
}

export function BookShelf({ books, listIds }: BookShelfProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2 pb-20">
      {books.map((book) => {
        const hasCover = !!book.cover_image;
        return (
          <div
            key={book.id}
            className="group cursor-pointer"
            style={{ perspective: '800px' }}
            onClick={() =>
              navigate(`/edit/${book.id}`, {
                state: { from: `/${location.search}`, listIds },
              })
            }
          >
            {/* 3D book wrapper */}
            <div
              className="relative w-full transition-transform duration-500 ease-out group-hover:[transform:rotateY(-25deg)] origin-left"
              style={{
                aspectRatio: '2/3',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Front face (cover) */}
              <div
                className="absolute inset-0 rounded-r-md rounded-l-sm overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-500"
                style={{ backfaceVisibility: 'hidden' }}
              >
                {hasCover ? (
                  <img
                    src={book.cover_image!}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-b ${hashColor(book.title)} flex flex-col justify-between p-2.5`}
                  >
                    <div className="min-h-0">
                      <p className="text-white text-xs font-bold leading-tight line-clamp-4">
                        {book.title}
                      </p>
                    </div>
                    <div>
                      {book.author && (
                        <p className="text-white/70 text-[10px] leading-tight line-clamp-2 mt-1">
                          {book.author}
                        </p>
                      )}
                      {book.editorial && (
                        <p className="text-white/50 text-[9px] mt-1 truncate">
                          {book.editorial}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Spine edge highlight */}
                <div className="absolute inset-y-0 left-0 w-[3px] bg-black/20" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>

              {/* Spine (visible when rotated) */}
              <div
                className={`absolute inset-y-0 left-0 w-4 bg-gradient-to-b ${hashColor(book.title)} rounded-l-sm`}
                style={{
                  transform: 'rotateY(-90deg) translateX(-8px)',
                  transformOrigin: 'right',
                  backfaceVisibility: 'hidden',
                }}
              />

              {/* Page edges (right side visible when rotated) */}
              <div
                className="absolute inset-y-[2px] right-0 w-[6px] bg-gradient-to-r from-gray-100 to-gray-50 rounded-r-sm"
                style={{ backfaceVisibility: 'hidden' }}
              />
            </div>

            {/* Title below */}
            <div className="mt-1.5 px-0.5">
              <p className="text-xs font-medium text-gray-800 line-clamp-1 leading-tight">
                {book.title}
              </p>
              {book.author && (
                <p className="text-[10px] text-gray-400 line-clamp-1 leading-tight mt-0.5">
                  {book.author}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
