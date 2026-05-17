import { useState } from 'react'
import type { FormEvent } from 'react'
import api from '../lib/api'

interface Member {
  user_id: string
  role: string
  user: { full_name: string; email: string } | null
}

interface Subgroup {
  subgroup_id: string
  name: string
}

interface Props {
  videoId: string
  teamId: string
  timestamp: number
  members: Member[]
  subgroups: Subgroup[]
  onSubmit: (comment: unknown) => void
  onClose: () => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export default function AddFeedbackModal({ videoId, teamId, timestamp, members, subgroups, onSubmit, onClose }: Props) {
  const [body, setBody] = useState('')
  const [targetType, setTargetType] = useState<'team' | 'subgroup' | 'individual'>('team')
  const [targetId, setTargetId] = useState(teamId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dancers = members.filter(m => m.role === 'dancer')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/comments', {
        video_id: videoId,
        body,
        video_timestamp_seconds: timestamp,
        target_type: targetType,
        target_id: targetId,
      })
      onSubmit(res.data)
      onClose()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Failed to add feedback')
    } finally {
      setLoading(false)
    }
  }

  function handleTargetTypeChange(t: 'team' | 'subgroup' | 'individual') {
    setTargetType(t)
    setTargetId(t === 'team' ? teamId : '')
  }

  const canSubmit = body.trim() && (targetType === 'team' || targetId)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Add feedback</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">At</span>
            <span className="text-sm font-medium text-brand-600 font-mono">{fmt(timestamp)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
            <textarea
              required
              autoFocus
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="Describe the feedback…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">For</label>
            <div className="flex gap-2">
              {(['team', 'subgroup', 'individual'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTargetTypeChange(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    targetType === t
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-brand-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {targetType === 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dancer</label>
              <select
                required
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select a dancer…</option>
                {dancers.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.full_name} ({m.user?.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === 'subgroup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subgroup</label>
              <select
                required
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select a subgroup…</option>
                {subgroups.map(sg => (
                  <option key={sg.subgroup_id} value={sg.subgroup_id}>{sg.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
            >
              {loading ? 'Saving…' : 'Save feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
