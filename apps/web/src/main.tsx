import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { fetchWorkflowExampleApps } from './domains/workflow/app/workflowExampleClient';
import './index.css';

void fetchWorkflowExampleApps().catch((err) => {
  console.warn('[workflow:example] 加载内置示例失败', err);
});
import './common.css';
import './features/markdown-stream/highlight.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
