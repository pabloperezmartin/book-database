import { Routes, Route, NavLink } from 'react-router-dom';
import { BookList } from './components/BookList';
import { BookForm } from './components/BookForm';
import { Admin } from './components/Admin';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-white/95 text-indigo-700 shadow-sm'
      : 'text-indigo-100 hover:bg-white/15 hover:text-white'
  }`;

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 shadow-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="Books">📚</span>
          <h1 className="text-lg font-bold tracking-tight">Book Library</h1>
          <nav className="ml-auto flex items-center gap-1 bg-indigo-800/30 rounded-full p-0.5">
            <NavLink to="/" end className={tabClass}>
              Library
            </NavLink>
            <NavLink to="/admin" className={tabClass}>
              Admin
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<BookList />} />
          <Route path="/new" element={<BookForm />} />
          <Route path="/edit/:id" element={<BookForm />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
