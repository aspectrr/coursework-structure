import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Today from './pages/Today';
import Calendar from './pages/Calendar';
import Admin from './pages/Admin';
import CourseDetail from './pages/CourseDetail';
import ItemPlayer from './pages/ItemPlayer';

export default function App() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/courses/:slug/items/:id" element={<ItemPlayer />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const { pathname } = useLocation();
  const nav = (path: string, label: string) => (
    <Link to={path} className={`hover:text-accent ${pathname === path ? 'text-accent' : ''}`}>{label}</Link>
  );
  return (
    <header className="border-b border-ink-200 bg-ink-50/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
        <Link to="/" className="font-serif text-xl tracking-tight">coursework</Link>
        <nav className="flex gap-4 text-sm text-ink-700">
          {nav('/', 'Today')}
          {nav('/calendar', 'Calendar')}
        </nav>
        <div className="ml-auto text-xs text-ink-500">
          <Link to="/admin" className={`hover:text-accent ${pathname === '/admin' ? 'text-accent' : ''}`}>admin</Link>
        </div>
      </div>
    </header>
  );
}
