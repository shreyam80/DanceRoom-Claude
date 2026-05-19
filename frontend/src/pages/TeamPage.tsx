import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface User {
  user_id: string
  full_name: string
  email: string
  username: string
  role: string
}

interface TeamMember {
  team_member_id: string
  user_id: string
  role: string
  status: string
  user: User | null
}

interface Subgroup {
  subgroup_id: string
  name: string
}

interface SubgroupMember {
  user_id: string
  user: User | null
}

interface SubgroupDetail extends Subgroup {
  members: SubgroupMember[]
}

interface Routine {
  routine_id: string
  title: string
  unread_comment_count: number
  has_unwatched_video: boolean
}

interface Team {
  team_id: string
  organization_id: string
  name: string
  description: string | null
  archived_at: string | null
  members: TeamMember[]
  subgroups: Subgroup[]
  routines: Routine[]
  archived_routines: Routine[]
}

type ConfirmState =
  | { type: 'remove-member'; userId: string; name: string }
  | { type: 'delete-subgroup'; subgroupId: string; name: string }
  | { type: 'archive-team' }
  | { type: 'delete-team' }
  | null

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [memberEmail, setMemberEmail] = useState('')
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberError, setMemberError] = useState('')
  const [memberSuccess, setMemberSuccess] = useState('')

  const [showSubgroupForm, setShowSubgroupForm] = useState(false)
  const [newSubgroupName, setNewSubgroupName] = useState('')
  const [subgroupLoading, setSubgroupLoading] = useState(false)
  const [subgroupError, setSubgroupError] = useState('')

  const [editingSubgroupId, setEditingSubgroupId] = useState<string | null>(null)
  const [editingSubgroupName, setEditingSubgroupName] = useState('')
  const [editingSubgroupLoading, setEditingSubgroupLoading] = useState(false)

  const [expandedSubgroup, setExpandedSubgroup] = useState<string | null>(null)
  const [subgroupDetails, setSubgroupDetails] = useState<Record<string, SubgroupDetail>>({})
  const [addingToSubgroup, setAddingToSubgroup] = useState<Record<string, string>>({})
  const [sgMemberLoading, setSgMemberLoading] = useState<Record<string, boolean>>({})
  const [sgMemberError, setSgMemberError] = useState<Record<string, string>>({})

  const [showRoutineForm, setShowRoutineForm] = useState(false)
  const [routineTitle, setRoutineTitle] = useState('')
  const [routineLoading, setRoutineLoading] = useState(false)
  const [routineError, setRoutineError] = useState('')

  const [showArchivedRoutines, setShowArchivedRoutines] = useState(false)

  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!teamId) return
    api.get(`/teams/${teamId}`)
      .then(r => setTeam(r.data))
      .catch(() => setError('Team not found'))
      .finally(() => setLoading(false))
  }, [teamId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault()
    setMemberError('')
    setMemberSuccess('')
    setMemberLoading(true)
    try {
      const res = await api.post(`/teams/${teamId}/members`, { email: memberEmail })
      setTeam(prev => prev ? { ...prev, members: [...prev.members, res.data] } : prev)
      setMemberSuccess(`${res.data.user?.full_name || memberEmail} added to the team.`)
      setMemberEmail('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } }; message?: string }
      const detail = axiosErr?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : axiosErr?.message ?? 'Failed to add member'
      setMemberError(msg)
    } finally {
      setMemberLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    setActing(true)
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      setTeam(prev => prev ? { ...prev, members: prev.members.filter(m => m.user_id !== userId) } : prev)
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  async function handleCreateSubgroup(e: FormEvent) {
    e.preventDefault()
    setSubgroupError('')
    setSubgroupLoading(true)
    try {
      const res = await api.post('/subgroups', { team_id: teamId, name: newSubgroupName })
      setTeam(prev => prev ? { ...prev, subgroups: [...prev.subgroups, res.data] } : prev)
      setNewSubgroupName('')
      setShowSubgroupForm(false)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSubgroupError(detail || 'Failed to create subgroup')
    } finally {
      setSubgroupLoading(false)
    }
  }

  async function handleRenameSubgroup(subgroupId: string) {
    setEditingSubgroupLoading(true)
    try {
      const res = await api.patch(`/subgroups/${subgroupId}`, { name: editingSubgroupName })
      setTeam(prev => prev ? {
        ...prev,
        subgroups: prev.subgroups.map(sg => sg.subgroup_id === subgroupId ? { ...sg, name: res.data.name } : sg),
      } : prev)
      setSubgroupDetails(prev => prev[subgroupId] ? { ...prev, [subgroupId]: { ...prev[subgroupId], name: res.data.name } } : prev)
      setEditingSubgroupId(null)
    } finally {
      setEditingSubgroupLoading(false)
    }
  }

  async function handleDeleteSubgroup(subgroupId: string) {
    setActing(true)
    try {
      await api.delete(`/subgroups/${subgroupId}`)
      setTeam(prev => prev ? { ...prev, subgroups: prev.subgroups.filter(sg => sg.subgroup_id !== subgroupId) } : prev)
      if (expandedSubgroup === subgroupId) setExpandedSubgroup(null)
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  async function handleExpandSubgroup(subgroupId: string) {
    if (expandedSubgroup === subgroupId) {
      setExpandedSubgroup(null)
      return
    }
    setExpandedSubgroup(subgroupId)
    if (!subgroupDetails[subgroupId]) {
      const res = await api.get(`/subgroups/${subgroupId}`)
      setSubgroupDetails(prev => ({ ...prev, [subgroupId]: res.data }))
    }
  }

  async function handleAddSubgroupMember(subgroupId: string) {
    const userId = addingToSubgroup[subgroupId]
    if (!userId) return
    setSgMemberLoading(prev => ({ ...prev, [subgroupId]: true }))
    setSgMemberError(prev => ({ ...prev, [subgroupId]: '' }))
    try {
      await api.post(`/subgroups/${subgroupId}/members`, { user_id: userId })
      const memberUser = team?.members.find(m => m.user_id === userId)?.user ?? null
      setSubgroupDetails(prev => ({
        ...prev,
        [subgroupId]: {
          ...prev[subgroupId],
          members: [...(prev[subgroupId]?.members ?? []), { user_id: userId, user: memberUser }],
        },
      }))
      setAddingToSubgroup(prev => ({ ...prev, [subgroupId]: '' }))
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSgMemberError(prev => ({ ...prev, [subgroupId]: detail || 'Failed to add member' }))
    } finally {
      setSgMemberLoading(prev => ({ ...prev, [subgroupId]: false }))
    }
  }

  async function handleRemoveSubgroupMember(subgroupId: string, userId: string) {
    try {
      await api.delete(`/subgroups/${subgroupId}/members/${userId}`)
      setSubgroupDetails(prev => ({
        ...prev,
        [subgroupId]: {
          ...prev[subgroupId],
          members: prev[subgroupId]?.members.filter(m => m.user_id !== userId) ?? [],
        },
      }))
    } catch {
      // silent — they can try again
    }
  }

  async function handleCreateRoutine(e: FormEvent) {
    e.preventDefault()
    setRoutineError('')
    setRoutineLoading(true)
    try {
      const res = await api.post('/routines', { team_id: teamId, title: routineTitle })
      navigate(`/routines/${res.data.routine_id}`)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setRoutineError(detail || 'Failed to create routine')
      setRoutineLoading(false)
    }
  }

  async function handleUnarchiveRoutine(routineId: string) {
    try {
      await api.patch(`/routines/${routineId}`, { archived: false })
      setTeam(prev => {
        if (!prev) return prev
        const unarchived = prev.archived_routines.find(r => r.routine_id === routineId)
        if (!unarchived) return prev
        return {
          ...prev,
          routines: [...prev.routines, { ...unarchived, archived_at: null } as unknown as Routine],
          archived_routines: prev.archived_routines.filter(r => r.routine_id !== routineId),
        }
      })
    } catch {
      // silent
    }
  }

  async function handleArchiveTeam() {
    setActing(true)
    try {
      await api.patch(`/teams/${teamId}`, { archived: true })
      navigate(-1)
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  async function handleDeleteTeam() {
    setActing(true)
    try {
      await api.delete(`/teams/${teamId}`)
      navigate(-1)
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  const isChoreographer = profile?.role === 'choreographer'
  const dancers = team?.members.filter(m => m.role === 'dancer') ?? []

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }
  if (error || !team) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">{error || 'Not found'}</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">{team.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{team.name}</h1>
            {team.description && <p className="text-gray-500 text-sm mt-1">{team.description}</p>}
          </div>
          {isChoreographer && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setConfirm({ type: 'archive-team' })}
                className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                Archive team
              </button>
              <button
                onClick={() => setConfirm({ type: 'delete-team' })}
                className="border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                Delete team
              </button>
            </div>
          )}
        </div>

        {/* Members */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Members</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {team.members.length === 0 && (
              <div className="px-5 py-4 text-sm text-gray-400">No members yet.</div>
            )}
            {team.members.map(m => (
              <div key={m.team_member_id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{m.user?.full_name ?? m.user_id}</span>
                  <span className="ml-2 text-xs text-gray-400">{m.user?.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{m.role}</span>
                  {isChoreographer && m.role === 'dancer' && (
                    <button
                      onClick={() => setConfirm({ type: 'remove-member', userId: m.user_id, name: m.user?.full_name ?? m.user_id })}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                      title="Remove from team"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isChoreographer && (
            <form onSubmit={handleAddMember} className="mt-3 flex gap-2">
              <input
                type="email"
                required
                value={memberEmail}
                onChange={e => { setMemberEmail(e.target.value); setMemberSuccess('') }}
                placeholder="Add dancer by email…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={memberLoading}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {memberLoading ? '…' : 'Add'}
              </button>
            </form>
          )}
          {memberError && <p className="text-sm text-red-600 mt-2">{memberError}</p>}
          {memberSuccess && <p className="text-sm text-green-600 mt-2">{memberSuccess}</p>}
        </section>

        {/* Subgroups */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Subgroups</h2>
            {isChoreographer && !showSubgroupForm && (
              <button
                onClick={() => setShowSubgroupForm(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                + New subgroup
              </button>
            )}
          </div>

          {showSubgroupForm && (
            <form onSubmit={handleCreateSubgroup} className="bg-white border border-brand-200 rounded-xl p-4 mb-3 flex gap-2">
              <input
                type="text"
                required
                value={newSubgroupName}
                onChange={e => setNewSubgroupName(e.target.value)}
                placeholder="Subgroup name"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {subgroupError && <p className="text-sm text-red-600">{subgroupError}</p>}
              <button type="button" onClick={() => setShowSubgroupForm(false)} className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={subgroupLoading} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
                {subgroupLoading ? '…' : 'Create'}
              </button>
            </form>
          )}

          {team.subgroups.length === 0 && !showSubgroupForm ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-400">
              No subgroups yet.
            </div>
          ) : (
            <div className="space-y-2">
              {team.subgroups.map(sg => {
                const detail = subgroupDetails[sg.subgroup_id]
                const isExpanded = expandedSubgroup === sg.subgroup_id
                const alreadyInSubgroup = new Set(detail?.members.map(m => m.user_id) ?? [])
                const availableDancers = dancers.filter(d => !alreadyInSubgroup.has(d.user_id))
                const isEditing = editingSubgroupId === sg.subgroup_id

                return (
                  <div key={sg.subgroup_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                      {isEditing ? (
                        <form
                          onSubmit={e => { e.preventDefault(); handleRenameSubgroup(sg.subgroup_id) }}
                          className="flex items-center gap-2 flex-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={editingSubgroupName}
                            onChange={e => setEditingSubgroupName(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button type="submit" disabled={editingSubgroupLoading} className="text-xs bg-brand-600 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
                            {editingSubgroupLoading ? '…' : 'Save'}
                          </button>
                          <button type="button" onClick={() => setEditingSubgroupId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => handleExpandSubgroup(sg.subgroup_id)}
                          className="flex-1 flex items-center justify-between text-left"
                        >
                          <span className="text-sm font-medium text-gray-900">{sg.name}</span>
                          <span className="text-xs text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      )}
                      {isChoreographer && !isEditing && (
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={e => { e.stopPropagation(); setEditingSubgroupId(sg.subgroup_id); setEditingSubgroupName(sg.name) }}
                            className="text-xs text-gray-400 hover:text-gray-700"
                            title="Rename"
                          >
                            Edit
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirm({ type: 'delete-subgroup', subgroupId: sg.subgroup_id, name: sg.name }) }}
                            className="text-xs text-red-400 hover:text-red-600"
                            title="Delete subgroup"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                        {!detail ? (
                          <p className="text-sm text-gray-400">Loading…</p>
                        ) : detail.members.length === 0 ? (
                          <p className="text-sm text-gray-400">No members yet.</p>
                        ) : (
                          detail.members.map(m => (
                            <div key={m.user_id} className="flex items-center justify-between text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                <span>{m.user?.full_name ?? m.user_id}</span>
                                <span className="text-xs text-gray-400">{m.user?.email}</span>
                              </div>
                              {isChoreographer && (
                                <button
                                  onClick={() => handleRemoveSubgroupMember(sg.subgroup_id, m.user_id)}
                                  className="text-xs text-red-400 hover:text-red-600"
                                  title="Remove from subgroup"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))
                        )}

                        {isChoreographer && availableDancers.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            <select
                              value={addingToSubgroup[sg.subgroup_id] ?? ''}
                              onChange={e => setAddingToSubgroup(prev => ({ ...prev, [sg.subgroup_id]: e.target.value }))}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="">Add a dancer…</option>
                              {availableDancers.map(d => (
                                <option key={d.user_id} value={d.user_id}>
                                  {d.user?.full_name} ({d.user?.email})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddSubgroupMember(sg.subgroup_id)}
                              disabled={!addingToSubgroup[sg.subgroup_id] || sgMemberLoading[sg.subgroup_id]}
                              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                            >
                              {sgMemberLoading[sg.subgroup_id] ? '…' : 'Add'}
                            </button>
                          </div>
                        )}
                        {sgMemberError[sg.subgroup_id] && (
                          <p className="text-sm text-red-600">{sgMemberError[sg.subgroup_id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Routines */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Routines</h2>
            {isChoreographer && !showRoutineForm && (
              <button
                onClick={() => setShowRoutineForm(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
              >
                + New routine
              </button>
            )}
          </div>

          {showRoutineForm && (
            <form onSubmit={handleCreateRoutine} className="bg-white border border-brand-200 rounded-xl p-4 mb-3 flex gap-2">
              <input
                type="text"
                required
                value={routineTitle}
                onChange={e => setRoutineTitle(e.target.value)}
                placeholder="Routine title"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {routineError && <p className="text-sm text-red-600">{routineError}</p>}
              <button type="button" onClick={() => setShowRoutineForm(false)} className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={routineLoading} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium">
                {routineLoading ? 'Creating…' : 'Create'}
              </button>
            </form>
          )}

          {team.routines.length === 0 && !showRoutineForm ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-400">
              No routines yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {team.routines.map(r => (
                <button
                  key={r.routine_id}
                  onClick={() => navigate(`/routines/${r.routine_id}`)}
                  className="bg-white border border-gray-200 hover:border-brand-300 rounded-xl p-5 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{r.title}</span>
                    {!isChoreographer && r.has_unwatched_video && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">New video</span>
                    )}
                    {r.unread_comment_count > 0 && (
                      <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-medium">
                        {r.unread_comment_count} new
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Archived routines — visible to all members */}
          {team.archived_routines.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchivedRoutines(v => !v)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {showArchivedRoutines ? '▲' : '▼'} Archived routines ({team.archived_routines.length})
              </button>
              {showArchivedRoutines && (
                <div className="grid gap-2 mt-2">
                  {team.archived_routines.map(r => (
                    <div
                      key={r.routine_id}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between opacity-60"
                    >
                      <span className="text-sm font-medium text-gray-700">{r.title}</span>
                      <div className="flex gap-2">
                        {isChoreographer && (
                          <button
                            onClick={() => handleUnarchiveRoutine(r.routine_id)}
                            className="text-xs border border-gray-300 hover:bg-white text-gray-600 px-2 py-1 rounded font-medium"
                          >
                            Unarchive
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/routines/${r.routine_id}`)}
                          className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            {confirm.type === 'remove-member' && (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Remove {confirm.name}?</h2>
                <p className="text-sm text-gray-500 mb-5">They will be removed from the team. Their existing feedback will remain.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={() => handleRemoveMember(confirm.userId)} disabled={acting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                    {acting ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </>
            )}
            {confirm.type === 'delete-subgroup' && (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Delete "{confirm.name}"?</h2>
                <p className="text-sm text-gray-500 mb-5">This subgroup and all its members will be permanently deleted.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={() => handleDeleteSubgroup(confirm.subgroupId)} disabled={acting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                    {acting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
            {confirm.type === 'archive-team' && (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Archive this team?</h2>
                <p className="text-sm text-gray-500 mb-5">The team will be moved to the archived section of your organization. You can unarchive it later.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleArchiveTeam} disabled={acting} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                    {acting ? 'Archiving…' : 'Archive'}
                  </button>
                </div>
              </>
            )}
            {confirm.type === 'delete-team' && (
              <>
                <h2 className="text-base font-semibold text-gray-900 mb-2">Delete this team?</h2>
                <p className="text-sm text-gray-500 mb-5">All routines, videos, and feedback for this team will be permanently deleted. This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button onClick={handleDeleteTeam} disabled={acting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                    {acting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
