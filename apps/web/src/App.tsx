import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { WorkflowDraftPage } from './pages/workflow/draft-page';
import { WorkflowPage } from './pages/workflow/list-page';

const RagPage = lazy(async () => {
  const module = await import('./features/rag');
  return { default: module.RagPage };
});

const App = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflow/draft" element={<WorkflowDraftPage />} />
        <Route
          path="/rag"
          element={(
            <Suspense fallback={<div className="p-6 text-sm text-neutral-500">加载中…</div>}>
              <RagPage />
            </Suspense>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
