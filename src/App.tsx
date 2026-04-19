import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Home } from './routes/Home';
import { Languages } from './routes/Languages';
import { LanguagePage } from './routes/LanguagePage';
import { AppShell } from './components/AppShell';

// Code-split the compare view — it pulls in the big force-graph bundle path
// indirectly through shared chart components, but more importantly is an
// optional side-trip the user typically isn't on.
const ComparePage = lazy(() =>
  import('./routes/ComparePage').then((m) => ({ default: m.ComparePage }))
);

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/languages" element={<Languages />} />
        <Route path="/lang/:iso" element={<LanguagePage />} />
        <Route path="/lang/:iso/phoneme/:symbol" element={<LanguagePage />} />
        <Route
          path="/compare/:iso"
          element={
            <Suspense
              fallback={
                <p className="mx-auto max-w-5xl px-6 py-12 text-neutral-500">
                  Loading…
                </p>
              }
            >
              <ComparePage />
            </Suspense>
          }
        />
      </Routes>
    </AppShell>
  );
}
