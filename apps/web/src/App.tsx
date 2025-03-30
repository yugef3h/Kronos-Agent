import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { MemoryPage } from './pages/MemoryPage';
import { WorkflowPage } from './pages/WorkflowPage';

const App = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
