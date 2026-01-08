import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/AppShell';
import { HomePage } from '../pages/home';
import { WorkflowConfigPage } from '../pages/workflow/config-page';
import { WorkflowDraftPage } from '../pages/workflow/draft-page';
import { WorkflowPage } from '../pages/workflow/list-page';

const RagPage = lazy(async () => {
  const module = await import('../pages/rag');
  return { default: module.RagPage };
});

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflow/draft" element={<WorkflowDraftPage />} />
        <Route path="/workflow/config" element={<WorkflowConfigPage />} />
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
