import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { fetchWorkflowExampleApps } from './features/workflow/workflowExampleClient';
import './index.css';

void fetchWorkflowExampleApps().catch((err) => {
  console.warn('[workflow:example] 加载内置示例失败', err);
});
import './common.css';
import './features/markdown-stream/highlight.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
