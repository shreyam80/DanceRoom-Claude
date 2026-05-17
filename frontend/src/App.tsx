import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* Placeholder routes — filled in Phase 4–7 */}
          <Route path="/organizations" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Organizations — coming in Phase 4</div></ProtectedRoute>
          } />
          <Route path="/organizations/new" element={
            <ProtectedRoute><div className="p-8 text-gray-500">New org — coming in Phase 4</div></ProtectedRoute>
          } />
          <Route path="/organizations/:organizationId" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Org detail — coming in Phase 4</div></ProtectedRoute>
          } />
          <Route path="/teams/:teamId" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Team — coming in Phase 4</div></ProtectedRoute>
          } />
          <Route path="/routines/:routineId" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Routine — coming in Phase 5</div></ProtectedRoute>
          } />
          <Route path="/videos/:videoId/review" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Review — coming in Phase 6</div></ProtectedRoute>
          } />
          <Route path="/videos/:videoId/watch" element={
            <ProtectedRoute><div className="p-8 text-gray-500">Watch — coming in Phase 7</div></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
