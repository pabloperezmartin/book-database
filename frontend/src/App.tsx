import { Routes, Route } from 'react-router-dom';
import { BookList } from './components/BookList';
import { BookForm } from './components/BookForm';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-3 shadow-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <h1 className="text-lg font-bold tracking-tight">Book Library</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<BookList />} />
          <Route path="/new" element={<BookForm />} />
          <Route path="/edit/:id" element={<BookForm />} />
        </Routes>
      </main>
    </div>
  );
}
