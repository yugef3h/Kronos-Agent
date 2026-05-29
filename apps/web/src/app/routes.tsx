import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../components/AppShell';
import { RouteLoading } from '../components/RouteLoading';
import { HomePage } from '../pages/home';

const WorkflowPage = lazy(async () => {
  const module = await import('../pages/workflow/list-page');
  return { default: module.WorkflowPage };
});

const WorkflowDraftPage = lazy(async () => {
  const module = await import('../pages/workflow/draft-page');
  return { default: module.WorkflowDraftPage };
});

const WorkflowConfigPage = lazy(async () => {
  const module = await import('../pages/workflow/config-page');
  return { default: module.WorkflowConfigPage };
});

const RagPage = lazy(async () => {
  const module = await import('../pages/rag');
  return { default: module.RagPage };
});

const lazyRoute = (element: ReactNode) => (
  <Suspense fallback={<RouteLoading />}>
    {element}
  </Suspense>
);

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/workflow" element={lazyRoute(<WorkflowPage />)} />
        <Route path="/workflow/draft" element={lazyRoute(<WorkflowDraftPage />)} />
        <Route path="/workflow/config" element={lazyRoute(<WorkflowConfigPage />)} />
        <Route path="/rag" element={lazyRoute(<RagPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
