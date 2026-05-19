import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface Team {
  team_id: string
  name: string
  description: string | null
  archived_at: string
}

export default function ArchivedTeamsPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    api.get(`/teams?organization_id=${organizationId}&archived=true`)
      .then(r => setTeams(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [organizationId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleUnarchive(teamId: string) {
    setUnarchiving(teamId)
    try {
      await api.patch(`/teams/${teamId}`, { archived: false })
      setTeams(prev => prev.filter(t => t.team_id !== teamId))
    } finally {
      setUnarchiving(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">Archived Teams</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Archived Teams</h1>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : teams.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No archived teams.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {teams.map(team => (
              <div
                key={team.team_id}
                className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between opacity-70"
              >
                <div>
                  <div className="font-medium text-gray-900">{team.name}</div>
                  {team.description && <div className="text-sm text-gray-500 mt-0.5">{team.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    Archived {new Date(team.archived_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUnarchive(team.team_id)}
                    disabled={unarchiving === team.team_id}
                    className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                  >
                    {unarchiving === team.team_id ? 'Restoring…' : 'Unarchive'}
                  </button>
                  <button
                    onClick={() => navigate(`/teams/${team.team_id}`)}
                    className="text-sm border border-brand-200 hover:bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg font-medium"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
