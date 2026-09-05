import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/700.css';
import App from './App';
import Today from './pages/Today';
import Calendar from './pages/Calendar';
import Admin from './pages/Admin';
import CourseDetail from './pages/CourseDetail';
import ItemPlayer from './pages/ItemPlayer';
import './globals.css';

// Hash routing: the bundled app loads from the tauri:// protocol where path
// rewrites aren't available; the hash keeps deep links (course/item routes) working.
render(
  () => (
    <Router transformUrl={(url) => url.replace(/^#/, '')} root={App}>
      <Route path="/" component={Today} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/admin" component={Admin} />
      <Route path="/courses/:slug" component={CourseDetail} />
      <Route path="/courses/:slug/items/:id" component={ItemPlayer} />
    </Router>
  ),
  document.getElementById('root')!,
);
