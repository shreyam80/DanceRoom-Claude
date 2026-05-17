import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import OrganizationNewPage from './pages/OrganizationNewPage'
import OrganizationPage from './pages/OrganizationPage'
import TeamPage from './pages/TeamPage'
import RoutinePage from './pages/RoutinePage'
import VideoReviewPage from './pages/VideoReviewPage'

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

          <Route path="/organizations/new" element={
            <ProtectedRoute><OrganizationNewPage /></ProtectedRoute>
          } />
          <Route path="/organizations/:organizationId" element={
            <ProtectedRoute><OrganizationPage /></ProtectedRoute>
          } />
          <Route path="/teams/:teamId" element={
            <ProtectedRoute><TeamPage /></ProtectedRoute>
          } />

          <Route path="/routines/:routineId" element={
            <ProtectedRoute><RoutinePage /></ProtectedRoute>
          } />

          {/* Placeholder routes — filled in Phase 6–7 */}
          <Route path="/videos/:videoId/review" element={
            <ProtectedRoute><VideoReviewPage /></ProtectedRoute>
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
