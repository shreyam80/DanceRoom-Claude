import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { profile, profileError, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Profile still loading or failed — show error with retry instead of blank
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">
          {profileError
            ? `Could not load your profile: ${profileError}`
            : 'Loading your profile…'}
        </p>
        {profileError && (
          <div className="flex gap-3">
            <button
              onClick={refreshProfile}
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
            >
              Retry
            </button>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="text-brand-600 font-bold text-lg">DanceRoom</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {profile.full_name}
            <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full capitalize">
              {profile.role}
            </span>
          </span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome, {profile.full_name}
        </h2>
        <p className="text-gray-500 mb-8">
          {profile.role === 'choreographer'
            ? 'Create an organization to get started.'
            : 'Your teams and feedback will appear here once a choreographer adds you.'}
        </p>

        {profile.role === 'choreographer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/organizations/new')}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl p-6 text-left transition-colors"
            >
              <div className="text-2xl mb-2">🏢</div>
              <div className="font-semibold">Create organization</div>
              <div className="text-brand-200 text-sm mt-1">Set up your studio or team</div>
            </button>
            <button
              onClick={() => navigate('/organizations')}
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-6 text-left transition-colors"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="font-semibold text-gray-900">My organizations</div>
              <div className="text-gray-500 text-sm mt-1">View teams and routines</div>
            </button>
          </div>
        )}

        {profile.role === 'dancer' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-gray-500 text-sm">
              Ask your choreographer to add you using your email:{' '}
              <strong className="text-gray-900">{profile.email}</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
