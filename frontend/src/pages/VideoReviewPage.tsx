import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import AddFeedbackModal from '../components/AddFeedbackModal'

interface Comment {
  comment_id: string
  body: string
  video_timestamp_seconds: number
  target_type: string
  target_label: string
  status: 'open' | 'resolved'
}

interface Member {
  user_id: string
  role: string
  user: { full_name: string; email: string; user_id: string } | null
}

interface Subgroup {
  subgroup_id: string
  name: string
}

interface Video {
  video_id: string
  file_url: string
  version_number: number
  routine: { routine_id: string; title: string; team_id: string } | null
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export default function VideoReviewPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [subgroups, setSubgroups] = useState<Subgroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTimestamp, setModalTimestamp] = useState(0)
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => {
    if (!videoId) return
    api.get(`/videos/${videoId}`)
      .then(async vRes => {
        const v: Video = vRes.data
        setVideo(v)
        const teamId = v.routine?.team_id
        const [cRes, mRes, sgRes] = await Promise.all([
          api.get(`/videos/${videoId}/comments`),
          teamId ? api.get(`/teams/${teamId}/members`) : Promise.resolve({ data: [] }),
          teamId ? api.get(`/teams/${teamId}/subgroups`) : Promise.resolve({ data: [] }),
        ])
        setComments(cRes.data)
        setMembers(mRes.data)
        setSubgroups(sgRes.data)
      })
      .catch(() => setError('Video not found'))
      .finally(() => setLoading(false))
  }, [videoId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function openModal() {
    videoRef.current?.pause()
    setModalTimestamp(videoRef.current?.currentTime ?? 0)
    setModalOpen(true)
  }

  function handleCommentAdded(comment: unknown) {
    const c = comment as Comment
    setComments(prev =>
      [...prev, c].sort((a, b) => a.video_timestamp_seconds - b.video_timestamp_seconds)
    )
  }

  function seekTo(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time
  }

  async function handleResolve(commentId: string) {
    setResolving(commentId)
    try {
      await api.post(`/comments/${commentId}/resolve`)
      setComments(prev => prev.map(c =>
        c.comment_id === commentId ? { ...c, status: 'resolved' as const } : c
      ))
    } finally {
      setResolving(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }
  if (error || !video) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-red-400">{error || 'Not found'}</p></div>
  }

  const teamId = video.routine?.team_id ?? ''

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
          <div className="flex justify-center items-center bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={video.file_url}
              controls
              className="max-h-[70vh] max-w-full"
              onTimeUpdate={e => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              onLoadedMetadata={e => setDuration((e.target as HTMLVideoElement).duration)}
            />
          </div>

          <div className="bg-gray-800 rounded-xl p-4">
            {/* Timeline bar */}
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
                    c.status === 'resolved' ? 'bg-gray-500' : 'bg-brand-500'
                  }`}
                  style={{ left: `${(c.video_timestamp_seconds / duration) * 100}%` }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400 font-mono">{fmt(currentTime)}</span>
              <button
                onClick={openModal}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
              >
                + Add feedback at {fmt(currentTime)}
              </button>
              <span className="text-xs text-gray-400 font-mono">{fmt(duration)}</span>
            </div>
          </div>
        </div>

        {/* Right: feedback sidebar */}
        <div className="w-80 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Feedback</h2>
            <span className="text-xs text-gray-400">
              {comments.filter(c => c.status === 'open').length} open
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-700">
            {comments.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 text-sm">No feedback yet.</p>
                <p className="text-gray-600 text-xs mt-1">Pause the video and click "+ Add feedback".</p>
              </div>
            ) : (
              comments.map(c => (
                <div key={c.comment_id} className={`p-4 ${c.status === 'resolved' ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      onClick={() => seekTo(c.video_timestamp_seconds)}
                      className="text-xs font-mono text-brand-400 hover:text-brand-300"
                    >
                      {fmt(c.video_timestamp_seconds)}
                    </button>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      c.status === 'resolved'
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-brand-900/60 text-brand-300'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className={`text-sm leading-snug mb-1 ${
                    c.status === 'resolved' ? 'text-gray-500 line-through' : 'text-gray-100'
                  }`}>
                    {c.body}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    → {c.target_type === 'team' ? 'Whole team' : c.target_label}
                  </p>
                  {c.status === 'open' && (
                    <button
                      onClick={() => handleResolve(c.comment_id)}
                      disabled={resolving === c.comment_id}
                      className="mt-2 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-2 py-0.5 rounded disabled:opacity-50 transition-colors"
                    >
                      {resolving === c.comment_id ? 'Resolving…' : 'Resolve'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <AddFeedbackModal
          videoId={videoId!}
          teamId={teamId}
          timestamp={modalTimestamp}
          members={members}
          subgroups={subgroups}
          onSubmit={handleCommentAdded}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
