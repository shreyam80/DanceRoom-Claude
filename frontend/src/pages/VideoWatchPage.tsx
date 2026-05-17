import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface Comment {
  comment_id: string
  body: string
  video_timestamp_seconds: number
  target_type: string
  target_label: string
  status: 'open' | 'resolved'
  acknowledged_at: string | null
}

interface Video {
  video_id: string
  file_url: string
  version_number: number
  routine: { routine_id: string; title: string } | null
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export default function VideoWatchPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [activeComment, setActiveComment] = useState<Comment | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)

  // Tracks acknowledged comment IDs in memory so scrubbing back never re-triggers them
  const acknowledgedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!videoId) return
    Promise.all([
      api.get(`/videos/${videoId}`),
      api.get(`/videos/${videoId}/comments/my`),
    ])
      .then(([vRes, cRes]) => {
        setVideo(vRes.data)
        const loaded: Comment[] = cRes.data
        setComments(loaded)
        // Pre-populate already-acknowledged set so we don't re-trigger on load
        loaded.forEach(c => {
          if (c.acknowledged_at) acknowledgedIds.current.add(c.comment_id)
        })
      })
      .catch(() => setError('Video not found'))
      .finally(() => setLoading(false))
  }, [videoId])

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const time = e.currentTarget.currentTime
    setCurrentTime(time)

    // Find the first unacknowledged comment within 0.5s of current position
    const hit = comments.find(
      c =>
        !acknowledgedIds.current.has(c.comment_id) &&
        Math.abs(time - c.video_timestamp_seconds) < 0.5
    )
    if (hit && !activeComment) {
      e.currentTarget.pause()
      setActiveComment(hit)
    }
  }

  async function handleAcknowledge() {
    if (!activeComment) return
    setAcknowledging(true)
    try {
      await api.post(`/comments/${activeComment.comment_id}/acknowledge`)
      acknowledgedIds.current.add(activeComment.comment_id)
      setComments(prev =>
        prev.map(c =>
          c.comment_id === activeComment.comment_id
            ? { ...c, acknowledged_at: new Date().toISOString() }
            : c
        )
      )
      setActiveComment(null)
      videoRef.current?.play()
    } finally {
      setAcknowledging(false)
    }
  }

  function handleDismiss() {
    // Mark in-memory only — skip without acknowledging (e.g. to re-read later)
    if (activeComment) acknowledgedIds.current.add(activeComment.comment_id)
    setActiveComment(null)
    videoRef.current?.play()
  }

  function seekTo(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }
  if (error || !video) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-red-400">{error || 'Not found'}</p></div>
  }

  const unacknowledgedCount = comments.filter(c => !c.acknowledged_at).length

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-300 font-medium">
            {video.routine?.title ?? 'Untitled'} — v{video.version_number}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{profile?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white">Sign out</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: video + timeline */}
        <div className="flex-1 flex flex-col p-6 gap-4 min-w-0 overflow-y-auto">
          <video
            ref={videoRef}
            src={video.file_url}
            controls
            className="w-full rounded-lg bg-black"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
          />

          <div className="bg-gray-800 rounded-xl p-4">
            <div
              className="relative h-5 bg-gray-700 rounded-full cursor-pointer select-none"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                if (duration) seekTo(((e.clientX - rect.left) / rect.width) * duration)
              }}
            >
              {duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none rounded-full"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              )}
              {duration > 0 && comments.map(c => (
                <button
                  key={c.comment_id}
                  title={`${fmt(c.video_timestamp_seconds)}: ${c.body}`}
                  onClick={e => { e.stopPropagation(); seekTo(c.video_timestamp_seconds) }}
                  className={`absolute top-0.5 w-4 h-4 -ml-2 rounded-full border-2 border-gray-800 transition-colors ${
                    c.acknowledged_at ? 'bg-green-600' : 'bg-brand-500'
                  }`}
                  style={{ left: `${(c.video_timestamp_seconds / duration) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400 font-mono">{fmt(currentTime)}</span>
              <span className="text-xs text-gray-500">
                {unacknowledgedCount > 0
                  ? `${unacknowledgedCount} feedback item${unacknowledgedCount !== 1 ? 's' : ''} pending`
                  : 'All feedback acknowledged'}
              </span>
              <span className="text-xs text-gray-400 font-mono">{fmt(duration)}</span>
            </div>
          </div>
        </div>

        {/* Right: comment list */}
        <div className="w-80 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-white">Your feedback</h2>
            <p className="text-xs text-gray-500 mt-0.5">Video pauses at each item for you to acknowledge.</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-700">
            {comments.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 text-sm">No feedback for you on this video.</p>
              </div>
            ) : (
              comments.map(c => {
                const acked = !!c.acknowledged_at
                return (
                  <div key={c.comment_id} className={`p-4 ${acked ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => seekTo(c.video_timestamp_seconds)}
                        className="text-xs font-mono text-brand-400 hover:text-brand-300"
                      >
                        {fmt(c.video_timestamp_seconds)}
                      </button>
                      {acked ? (
                        <span className="text-xs text-green-500">✓ acknowledged</span>
                      ) : (
                        <span className="text-xs text-yellow-500">pending</span>
                      )}
                    </div>
                    <p className={`text-sm leading-snug ${acked ? 'text-gray-500' : 'text-gray-100'}`}>
                      {c.body}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Auto-pause modal */}
      {activeComment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-brand-400">{fmt(activeComment.video_timestamp_seconds)}</span>
                <span className="text-xs text-gray-500">— feedback for you</span>
              </div>
              <h2 className="font-semibold text-white">Feedback</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-100 leading-relaxed">{activeComment.body}</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 border border-gray-600 text-gray-300 hover:text-white py-2 rounded-lg text-sm font-medium hover:border-gray-400 transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {acknowledging ? 'Saving…' : 'Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
