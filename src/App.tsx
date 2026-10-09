import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Join from './pages/Join'
import Host from './pages/Host'
import Play from './pages/Play'
import { isConfigured } from './lib/supabase'
import SetupHint from './components/SetupHint'

export default function App() {
  if (!isConfigured) return <SetupHint />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Join />} />
      <Route path="/host/:roomId" element={<Host />} />
      <Route path="/play/:roomId" element={<Play />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
