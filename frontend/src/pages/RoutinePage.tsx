import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

interface Video {
  video_id: string
  version_number: number
  file_url: string
  duration_seconds: number | null
  uploaded_at: string
}

interface Routine {
  routine_id: string
  title: string
  team_id: string
  videos: Video[]
}

export default function RoutinePage() {
  const { routineId } = useParams<{ routineId: string }>()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!routineId) return
    api.get(`/routines/${routineId}`)
      .then(r => setRoutine(r.data))
      .catch(() => setError('Routine not found'))
      .finally(() => setLoading(false))
  }, [routineId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleUpload(file: File) {
    if (!profile || !routineId) return
    setUploadError('')
    setUploading(true)
    setUploadProgress('Uploading video…')

    try {
      const ext = file.name.split('.').pop() ?? 'mp4'
      const path = `${profile.user_id}/${routineId}/${Date.now()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('rehearsal-videos')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (storageError) throw new Error(storageError.message)

      setUploadProgress('Saving metadata…')

      const { data: urlData } = supabase.storage
        .from('rehearsal-videos')
        .getPublicUrl(path)

      const res = await api.post('/videos', {
        routine_id: routineId,
        storage_path: path,
        file_url: urlData.publicUrl,
        duration_seconds: null,
      })

      setRoutine(prev => prev ? { ...prev, videos: [...prev.videos, res.data] } : prev)
      setUploadProgress('')

      if (profile.role === 'choreographer') {
        navigate(`/videos/${res.data.video_id}/review`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(msg)
      setUploadProgress('')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const isChoreographer = profile?.role === 'choreographer'

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>
  }
  if (error || !routine) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-red-500">{error || 'Not found'}</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium">{routine.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{profile?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{routine.title}</h1>
          {isChoreographer && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mov"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {uploading ? uploadProgress : '+ Upload video'}
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">{uploadError}</p>
        )}

        {routine.videos.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">
              {isChoreographer ? 'No videos yet. Upload the first recording above.' : 'No videos uploaded yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {routine.videos.map(v => (
              <div
                key={v.video_id}
                className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">Version {v.version_number}</span>
                  <span className="ml-3 text-xs text-gray-400">
                    {new Date(v.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  {isChoreographer && (
                    <button
                      onClick={() => navigate(`/videos/${v.video_id}/review`)}
                      className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-medium"
                    >
                      Review
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/videos/${v.video_id}/watch`)}
                    className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
                  >
                    Watch
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
