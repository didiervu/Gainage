import { Routes, Route, Link } from 'react-router-dom';
import { HomePage } from './HomePage';
import { SessionPage } from './SessionPage';

function App() {
  return (
    <div>
      {/* Vous pouvez mettre ici un header ou une navigation commune */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
      </Routes>
    </div>
  );
}

export default App;