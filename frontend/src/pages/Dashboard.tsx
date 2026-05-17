import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface Organization {
  organization_id: string
  name: string
  type: string | null
}

interface Team {
  team_id: string
  name: string
  description: string | null
}

export default function Dashboard() {
  const { profile, profileError, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (!profile) return
    setLoadingData(true)
    if (profile.role === 'choreographer') {
      api.get('/organizations').then(r => setOrgs(r.data)).finally(() => setLoadingData(false))
    } else {
      api.get('/teams').then(r => setTeams(r.data)).finally(() => setLoadingData(false))
    }
  }, [profile])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">
          {profileError ? `Could not load your profile: ${profileError}` : 'Loading your profile…'}
        </p>
        {profileError && (
          <div className="flex gap-3">
            <button onClick={refreshProfile} className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">Retry</button>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Sign out</button>
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
            <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full capitalize">{profile.role}</span>
          </span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Welcome, {profile.full_name}</h2>
            <p className="text-gray-500 mt-1 text-sm">
              {profile.role === 'choreographer' ? 'Manage your organizations and teams.' : 'Your teams and routines.'}
            </p>
          </div>
          {profile.role === 'choreographer' && (
            <button
              onClick={() => navigate('/organizations/new')}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              + New organization
            </button>
          )}
        </div>

        {profile.role === 'choreographer' && (
          loadingData ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : orgs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-500 mb-4">No organizations yet.</p>
              <button
                onClick={() => navigate('/organizations/new')}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Create your first organization
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {orgs.map(org => (
                <button
                  key={org.organization_id}
                  onClick={() => navigate(`/organizations/${org.organization_id}`)}
                  className="bg-white border border-gray-200 hover:border-brand-300 rounded-xl p-5 text-left transition-colors"
                >
                  <div className="font-medium text-gray-900">{org.name}</div>
                  {org.type && <div className="text-sm text-gray-500 mt-0.5 capitalize">{org.type}</div>}
                </button>
              ))}
            </div>
          )
        )}

        {profile.role === 'dancer' && (
          loadingData ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : teams.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm">
                No teams yet. Ask your choreographer to add you using your email:{' '}
                <strong className="text-gray-900">{profile.email}</strong>
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {teams.map(team => (
                <button
                  key={team.team_id}
                  onClick={() => navigate(`/teams/${team.team_id}`)}
                  className="bg-white border border-gray-200 hover:border-brand-300 rounded-xl p-5 text-left transition-colors"
                >
                  <div className="font-medium text-gray-900">{team.name}</div>
                  {team.description && <div className="text-sm text-gray-500 mt-0.5">{team.description}</div>}
                </button>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  )
}
