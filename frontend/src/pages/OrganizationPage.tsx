import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface Team {
  team_id: string
  name: string
  description: string | null
}

interface Organization {
  organization_id: string
  name: string
  type: string | null
  teams: Team[]
}

export default function OrganizationPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')
  const [teamError, setTeamError] = useState('')
  const [teamLoading, setTeamLoading] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    api.get(`/organizations/${organizationId}`)
      .then(r => setOrg(r.data))
      .catch(() => setError('Organization not found'))
      .finally(() => setLoading(false))
  }, [organizationId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault()
    setTeamError('')
    setTeamLoading(true)
    try {
      const res = await api.post('/teams', {
        organization_id: organizationId,
        name: teamName,
        description: teamDesc || null,
      })
      setOrg(prev => prev ? { ...prev, teams: [...prev.teams, res.data] } : prev)
      setTeamName('')
      setTeamDesc('')
      setShowTeamForm(false)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTeamError(detail || 'Failed to create team')
    } finally {
      setTeamLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }
  if (error || !org) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">{error || 'Not found'}</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">{org.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{org.name}</h1>
          {org.type && <p className="text-gray-500 text-sm mt-1 capitalize">{org.type}</p>}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Teams</h2>
          {profile?.role === 'choreographer' && !showTeamForm && (
            <button
              onClick={() => setShowTeamForm(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
            >
              + New team
            </button>
          )}
        </div>

        {showTeamForm && (
          <form onSubmit={handleCreateTeam} className="bg-white border border-brand-200 rounded-xl p-5 mb-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-900">New team</h3>
            <input
              type="text"
              required
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Team name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="text"
              value={teamDesc}
              onChange={e => setTeamDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {teamError && <p className="text-sm text-red-600">{teamError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowTeamForm(false); setTeamError('') }}
                className="flex-1 border border-gray-300 text-gray-700 py-1.5 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={teamLoading}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-1.5 rounded-lg text-sm font-medium"
              >
                {teamLoading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {org.teams.length === 0 && !showTeamForm ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">No teams yet. Create your first team above.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {org.teams.map(team => (
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
        )}
      </main>
    </div>
  )
}
