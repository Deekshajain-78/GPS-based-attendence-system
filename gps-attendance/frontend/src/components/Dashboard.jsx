import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import AttendanceHistory from './AttendanceHistory'
import SelfieCapture from './SelfieCapture'

export default function Dashboard({ user, onLogout }) {
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState([])
  const [tasks, setTasks] = useState([])
  const [leaves, setLeaves] = useState([])
  const [meetings, setMeetings] = useState([])
  const [referrals, setReferrals] = useState([])
  const [referralForm, setReferralForm] = useState({ candidate_name: '', candidate_email: '', resume_url: '' })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', date: '' })
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [taskStatus, setTaskStatus] = useState('idle')
  const [taskError, setTaskError] = useState('')
  const [leaveStatus, setLeaveStatus] = useState('')
  const [profile, setProfile] = useState({ name: user.name, email: user.email, profile_photo: user.profile_photo || null, github: '', linkedin: '', mobile_number: '' })
  const [profileStatus, setProfileStatus] = useState('')
  const [activeTab, setTab] = useState('checkin')
  const [showCamera, setShowCamera] = useState(false)
  const [photoMode, setPhotoMode] = useState('attendance')
  const [pendingType, setPendingType] = useState(null)
  const [lastSelfie, setLastSelfie] = useState(null)
  const [meetingResponseLoading, setMeetingResponseLoading] = useState(false)
  const [locationReady, setLocationReady] = useState(false)
  const [locationError, setLocationError] = useState('')

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/${user.id}`)
      const data = await res.json()
      setRecords(data)
    } catch { /* silent */ }
  }, [user.id])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${user.id}`)
      const data = await res.json()
      setTasks(data)
    } catch { /* silent */ }
  }, [user.id])

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaves/${user.id}`)
      const data = await res.json()
      setLeaves(data)
    } catch { /* silent */ }
  }, [user.id])

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${user.id}`)
      const data = await res.json()
      setMeetings(data)
    } catch { /* silent */ }
  }, [user.id])

  const fetchReferrals = useCallback(async () => {
    try {
      const res = await fetch(`/api/referrals/${user.id}`)
      const data = await res.json()
      setReferrals(data)
    } catch { /* silent */ }
  }, [user.id])

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${user.id}`)
      if (!res.ok) return
      const data = await res.json()
      setProfile({
        name: data.name,
        email: data.email,
        profile_photo: data.profile_photo || null,
        github: data.github || '',
        linkedin: data.linkedin || '',
        mobile_number: data.mobile_number || '',
        performance_points: data.performance_points || 0
      })
    } catch {
      // ignore
    }
  }, [user.id])

  useEffect(() => {
    fetchUserProfile();
    fetchHistory();
    fetchTasks();
    fetchLeaves();
    fetchMeetings();
    fetchReferrals();
  }, [fetchUserProfile, fetchHistory, fetchTasks, fetchLeaves, fetchMeetings, fetchReferrals])

  const getLocation = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
    )

  const initializeLocation = useCallback(async () => {
    try {
      setLocationError('')
      const pos = await getLocation()
      const { latitude, longitude } = pos.coords
      setLocation({ latitude, longitude })
      setLocationReady(true)
    } catch (err) {
      setLocationError('GPS access required for attendance. Please enable location services.')
      setLocationReady(false)
    }
  }, [])

  useEffect(() => {
    initializeLocation();
    fetchUserProfile();
    fetchHistory();
    fetchTasks();
    fetchLeaves();
    fetchMeetings();
    fetchReferrals();
  }, [initializeLocation, fetchUserProfile, fetchHistory, fetchTasks, fetchLeaves, fetchMeetings, fetchReferrals])

  // Step 1: location already fetched, open camera
  const handleMark = (type) => {
    setPendingType(type)
    setShowCamera(true)
    setMessage('')
  }

  // Step 2: selfie captured → action based on mode
  const handleSelfieCapture = async (selfieBase64) => {
    setShowCamera(false)
    setLastSelfie(selfieBase64)

    if (photoMode === 'profile') {
      setProfile(prev => ({ ...prev, profile_photo: selfieBase64 }))
      setProfileStatus('loading')
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_photo: selfieBase64 }),
        })
        if (!res.ok) throw new Error((await res.json()).detail || 'Profile update failed')
        const data = await res.json()
        setProfile({ name: data.name, email: data.email, profile_photo: data.profile_photo })
        setProfileStatus('success')
      } catch (err) {
        setProfileStatus('error')
      } finally {
        setTimeout(() => setProfileStatus('idle'), 1500)
      }
      return
    }

    // Attendance mode - location already fetched in handleMark
    setStatus('loading')
    setMessage('Verifying identity & location...')
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: null, // Accuracy not available from initial fetch
          speed: null,
          type: pendingType,
          selfie: selfieBase64,
          sensor_data: {} // Can be extended for accelerometer data
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setStatus('success')
      setMessage(`${pendingType === 'in' ? 'Check-in' : 'Check-out'} recorded at ${new Date().toLocaleTimeString()}`)
      fetchHistory()
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Something went wrong.')
    }
  }

  const handleGalleryUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      setProfile(prev => ({ ...prev, profile_photo: dataUrl }))
      setProfileStatus('loading')
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_photo: dataUrl }),
        })
        if (!res.ok) throw new Error((await res.json()).detail || 'Profile update failed')
        const data = await res.json()
        setProfile(prev => ({ ...prev, profile_photo: data.profile_photo || prev.profile_photo }))
        setProfileStatus('success')
      } catch {
        setProfileStatus('error')
      } finally {
        setTimeout(() => setProfileStatus('idle'), 1500)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleTaskCreate = async (e) => {
    e.preventDefault()
    setTaskStatus('loading')
    setTaskError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, status: 'pending', ...taskForm, date: taskForm.date || new Date().toISOString().slice(0,10) }),
      })
      const data = await res.json()
      if (!res.ok) {
        const message = data?.detail || data?.message || 'Failed to create task'
        setTaskError(message)
        setTaskStatus('error')
      } else {
        setTaskStatus('success')
        setTaskForm({ title: '', description: '', date: '' })
        fetchTasks()
      }
    } catch (err) {
      setTaskError(err.message || 'Error saving task')
      setTaskStatus('error')
    } finally {
      setTimeout(() => setTaskStatus('idle'), 1500)
    }
  }

  const handleLeaveRequest = async (e) => {
    e.preventDefault()
    setLeaveStatus('loading')
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...leaveForm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to request leave')
      setLeaveStatus('success')
      setLeaveForm({ start_date: '', end_date: '', reason: '' })
      fetchLeaves()
    } catch (err) {
      setLeaveStatus('error')
    } finally {
      setTimeout(() => setLeaveStatus(''), 1500)
    }
  }

  const handleMeetingResponse = async (meetingId, response) => {
    setMeetingResponseLoading(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, response }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to submit meeting response')
      await fetchMeetings()
    } catch (err) {
      alert(err.message || 'Failed to submit meeting response')
    } finally {
      setMeetingResponseLoading(false)
    }
  }

  const handleReferSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrer_id: user.id, ...referralForm }),
      })
      if (res.ok) {
        setReferralForm({ candidate_name: '', candidate_email: '', resume_url: '' })
        fetchReferrals()
      }
    } catch {
      // ignore
    }
  }

  const handleReferralResumeUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setReferralForm(prev => ({ ...prev, resume_url: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileStatus('loading')
    try {
      const body = {
        name: profile.name,
        email: profile.email,
        github: profile.github || null,
        linkedin: profile.linkedin || null,
        mobile_number: profile.mobile_number || null
      }
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to update profile')
      setProfile({ name: data.name, email: data.email, profile_photo: data.profile_photo, password: '' })
      setProfileStatus('success')
    } catch (err) {
      setProfileStatus('error')
    } finally {
      setTimeout(() => setProfileStatus(''), 1500)
    }
  }

  const handleTaskFormChange = (e) => {
    setTaskStatus('idle')
    setTaskError('')
    setTaskForm({ ...taskForm, [e.target.name]: e.target.value })
  }
  const handleLeaveFormChange = (e) => setLeaveForm({ ...leaveForm, [e.target.name]: e.target.value })
  const handleProfileChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value })

  return (
    <div className="dashboard bg-[#0f172a]">
      {/* Sidebar */}
      <aside className="sidebar bg-[#1e293b]/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col p-6 gap-2 relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-purple-500/10 rounded-r-2xl blur-2xl -z-10"></div>

        <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6 px-2">
          AttendTrack
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'checkin', label: 'Dashboard' },
            { id: 'profile', label: 'Profile' },
            { id: 'history', label: 'Attendance History' },
            { id: 'tasks', label: 'Daily Tasks' },
            { id: 'leave', label: 'Leave Requests' },
            { id: 'meetings', label: 'Meetings' },
            { id: 'performance', label: 'Performance' },
            { id: 'referrals', label: 'Referrals' }
          ].map(({ id, label }) => (
            <motion.button
              key={id}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
              onClick={() => setTab(id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {label}
            </motion.button>
          ))}
        </nav>

        <motion.button
          className="w-full text-left px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 mt-auto"
          onClick={onLogout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Logout
        </motion.button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">
              Welcome back, <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">{user.name}</span>
            </h2>
            <p className="text-slate-400">{new Date().toDateString()}</p>
          </div>

          <motion.div
            className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/25"
            whileHover={{ scale: 1.1 }}
          >
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo.startsWith('http') || profile.profile_photo.startsWith('/') ? profile.profile_photo : profile.profile_photo}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name[0].toUpperCase()
            )}
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'checkin' && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* GPS Attendance Card */}
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                {/* GPS Pulse Animation */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping animation-delay-1000"></div>
                    <div className="relative w-20 h-20 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50">
                    </div>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-center text-white mb-2">Mark Attendance</h3>
                <p className="text-slate-300 text-center mb-6">A selfie will be taken to verify your identity</p>

                {location && (
                  <motion.div
                    className="bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 mb-6 text-center"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="text-cyan-400 font-mono text-sm flex items-center justify-center">
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </div>
                  </motion.div>
                )}

                {/* Selfie Preview */}
                {lastSelfie && status !== 'loading' && (
                  <motion.div
                    className="flex justify-center mb-6"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="relative">
                      <img
                        src={lastSelfie}
                        alt="selfie"
                        className="w-20 h-20 rounded-full border-2 border-cyan-500/50 object-cover"
                      />
                      <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-xs font-bold ${
                        status === 'success'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                          : 'bg-red-500/20 text-red-400 border border-red-500/50'
                      }`}>
                        {status === 'success' ? (
                          <span className="inline-flex items-center">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {locationReady ? (
                  <div className="flex gap-4 justify-center">
                    <motion.button
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200 disabled:opacity-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleMark('in')}
                      disabled={status === 'loading'}
                    >
                      Check In
                    </motion.button>
                    <motion.button
                      className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200 disabled:opacity-50"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleMark('out')}
                      disabled={status === 'loading'}
                    >
                      Check Out
                    </motion.button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-red-400 mb-4">{locationError || 'Initializing GPS...'}</p>
                    <motion.button
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={initializeLocation}
                    >
                      Retry GPS
                    </motion.button>
                  </div>
                )}

                <AnimatePresence>
                  {message && (
                    <motion.div
                      className={`mt-6 p-4 rounded-xl text-center font-medium ${
                        status === 'loading'
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                          : status === 'success'
                          ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                          : 'bg-red-500/10 border border-red-500/20 text-red-400'
                      }`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {status === 'loading' ? 'Verifying identity & location...' : message}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Records" value={records.length} />
                <StatCard label="Check-ins" value={records.filter(r => r.type === 'in').length} />
                <StatCard label="Check-outs" value={records.filter(r => r.type === 'out').length} />
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <AttendanceHistory records={records} />
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-8">
                  My Daily Tasks
                </h3>

                <form onSubmit={handleTaskCreate} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                      <input
                        name="title"
                        value={taskForm.title}
                        onChange={handleTaskFormChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                        placeholder="Task title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                      <input
                        name="description"
                        value={taskForm.description}
                        onChange={handleTaskFormChange}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                        placeholder="Task description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                      <input
                        type="date"
                        name="date"
                        value={taskForm.date}
                        onChange={handleTaskFormChange}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <motion.button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add Task
                    </motion.button>
                  </div>
                </form>

                {(taskStatus === 'loading' || taskStatus === 'success' || (taskStatus === 'error' && taskError)) && (
                  <motion.div
                    className={`mb-6 p-4 rounded-xl text-center font-medium ${
                      taskStatus === 'loading'
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                        : taskStatus === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {taskStatus === 'loading'
                      ? 'Saving...'
                      : taskStatus === 'success'
                      ? 'Task added successfully'
                      : taskError || 'Error saving task'}
                  </motion.div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-slate-300 font-semibold">#</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Title</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Description</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Date</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Status</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t, i) => (
                        <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-slate-300">{i+1}</td>
                          <td className="px-4 py-3 text-white font-medium">{t.title}</td>
                          <td className="px-4 py-3 text-slate-400">{t.description}</td>
                          <td className="px-4 py-3 text-slate-400">{t.date}</td>
                          <td className="px-4 py-3">
                            {(() => {
                              const taskStatusValue = (t.status || 'pending').toLowerCase()
                              return (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  taskStatusValue === 'completed'
                                    ? 'bg-green-500/20 text-green-400'
                                    : taskStatusValue === 'in-progress'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {taskStatusValue === 'completed' ? 'Completed' : taskStatusValue === 'in-progress' ? 'In progress' : 'Pending'}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {((t.status || 'pending').toLowerCase() !== 'completed') ? (
                              <motion.button
                                className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={async () => {
                                  await fetch(`/api/tasks/${t.id}/complete`, { method: 'POST' })
                                  fetchTasks()
                                }}
                              >
                                Mark done
                              </motion.button>
                            ) : (
                              <span className="text-green-400 font-bold">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'leave' && (
            <motion.div
              key="leave"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-8">
                  Leave Management
                </h3>

                <form onSubmit={handleLeaveRequest} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                      <input
                        type="date"
                        name="start_date"
                        value={leaveForm.start_date}
                        onChange={handleLeaveFormChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                      <input
                        type="date"
                        name="end_date"
                        value={leaveForm.end_date}
                        onChange={handleLeaveFormChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
                      <input
                        name="reason"
                        value={leaveForm.reason}
                        onChange={handleLeaveFormChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                        placeholder="Reason for leave"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <motion.button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Request Leave
                    </motion.button>
                  </div>
                </form>

                {leaveStatus && (
                  <motion.div
                    className={`mb-6 p-4 rounded-xl text-center font-medium ${
                      leaveStatus === 'loading'
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                        : leaveStatus === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {leaveStatus === 'loading' ? 'Submitting...' : leaveStatus === 'success' ? 'Request sent successfully' : 'Error requesting leave'}
                  </motion.div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-slate-300 font-semibold">#</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Period</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Reason</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((l, i) => (
                        <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-slate-300">{i+1}</td>
                          <td className="px-4 py-3 text-white font-medium">{l.start_date} to {l.end_date}</td>
                          <td className="px-4 py-3 text-slate-400">{l.reason}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              l.status === 'approved'
                                ? 'bg-green-500/20 text-green-400'
                                : l.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'meetings' && (
            <motion.div
              key="meetings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-6">
                  Meeting Schedules
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-slate-300 font-semibold">#</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Title</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Time</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Organizer</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Status</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Link</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetings.map((m, i) => (
                        <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-slate-300">{i+1}</td>
                          <td className="px-4 py-3 text-white font-medium">{m.title}</td>
                          <td className="px-4 py-3 text-slate-400">{new Date(m.scheduled_for).toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-400">{m.organizer_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              m.status === 'confirmed'
                                ? 'bg-green-500/20 text-green-400'
                                : m.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {m.status}{m.my_response ? ` (${m.my_response})` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {m.meeting_link ? (
                              <a
                                href={m.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 underline"
                              >
                                Join Meeting
                              </a>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 space-x-2">
                            <motion.button
                              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={meetingResponseLoading || m.my_response === 'accept'}
                              onClick={() => handleMeetingResponse(m.id, 'accept')}
                            >
                              Accept
                            </motion.button>
                            <motion.button
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={meetingResponseLoading || m.my_response === 'decline'}
                              onClick={() => handleMeetingResponse(m.id, 'decline')}
                            >
                              Decline
                            </motion.button>
                            <motion.button
                              className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={meetingResponseLoading || m.my_response === 'maybe'}
                              onClick={() => handleMeetingResponse(m.id, 'maybe')}
                            >
                              Maybe
                            </motion.button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'performance' && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-8">
                  My Performance
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Performance Points */}
                  <motion.div
                    className="relative backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-8 text-center"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl -z-10"></div>

                    <div className="text-4xl font-bold text-white mb-2">{profile.performance_points || 0}</div>
                    <div className="text-slate-300 font-medium">Total Performance Points</div>
                  </motion.div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <motion.div
                      className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-2xl font-bold text-white mb-1">{tasks.filter(t => t.status === 'completed').length}</div>
                      <div className="text-slate-400 text-sm">Tasks Completed</div>
                    </motion.div>

                    <motion.div
                      className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-2xl font-bold text-white mb-1">{records.filter(r => r.type === 'in').length}</div>
                      <div className="text-slate-400 text-sm">Check-ins</div>
                    </motion.div>

                    <motion.div
                      className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center"
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-2xl font-bold text-white mb-1">{meetings.filter(m => m.my_response === 'accept').length}</div>
                      <div className="text-slate-400 text-sm">Meetings Attended</div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'referrals' && (
            <motion.div
              key="referrals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-6">
                  Referral Program
                </h3>

                <form onSubmit={handleReferSubmit} className="space-y-4 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Candidate Name</label>
                      <input
                        name="candidate_name"
                        value={referralForm.candidate_name}
                        onChange={(e)=> setReferralForm({...referralForm, candidate_name: e.target.value})}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Candidate Email</label>
                      <input
                        name="candidate_email"
                        value={referralForm.candidate_email}
                        onChange={(e)=> setReferralForm({...referralForm, candidate_email: e.target.value})}
                        required
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Resume (PDF/DOC)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleReferralResumeUpload}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500 file:text-white hover:file:bg-cyan-400 transition-all duration-200"
                      />
                    </div>
                  </div>
                  {referralForm.resume_url && (
                    <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 inline-block">
                      Resume attached
                    </div>
                  )}
                  <div className="flex justify-end">
                    <motion.button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Submit Referral
                    </motion.button>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-slate-300 font-semibold">#</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Name</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Email</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Resume</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Status</th>
                        <th className="px-4 py-3 text-slate-300 font-semibold">Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((r, i) => (
                        <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-slate-300">{i+1}</td>
                          <td className="px-4 py-3 text-white font-medium">{r.candidate_name}</td>
                          <td className="px-4 py-3 text-slate-400">{r.candidate_email}</td>
                          <td className="px-4 py-3">
                            {r.resume_url ? (
                              <a
                                href={r.resume_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 underline"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-slate-500">Not provided</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              r.status === 'hired'
                                ? 'bg-green-500/20 text-green-400'
                                : r.status === 'interviewing'
                                ? 'bg-blue-500/20 text-blue-400'
                                : r.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.bonus_awarded ? (
                              <span className="text-green-400">Yes</span>
                            ) : (
                              <span className="text-slate-500">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

                <h3 className="text-2xl font-bold text-white mb-8">
                  My Profile
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Profile Photo Section */}
                  <div className="space-y-6">
                    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl -z-10"></div>

                      <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                          <img
                            src={profile.profile_photo ? (profile.profile_photo.startsWith('/') ? profile.profile_photo : `/${profile.profile_photo}`) : '/placeholder-user.png'}
                            alt="Profile"
                            className="w-32 h-32 rounded-full border-4 border-cyan-500/50 object-cover shadow-lg shadow-cyan-500/25"
                          />
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-md -z-10"></div>
                        </div>

                        <div className="flex flex-col space-y-3 w-full">
                          <motion.button
                            type="button"
                            onClick={() => { setPhotoMode('profile'); setShowCamera(true) }}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200 text-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Change Photo (Camera)
                          </motion.button>

                          <label className="w-full">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleGalleryUpload}
                              className="hidden"
                            />
                            <div className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-xl text-slate-300 text-center cursor-pointer transition-all duration-200 text-sm">
                              Upload from Gallery
                            </div>
                          </label>
                        </div>

                        {profileStatus && (
                          <motion.div
                            className={`w-full p-3 rounded-xl text-center font-medium text-sm ${
                              profileStatus === 'loading'
                                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                                : profileStatus === 'success'
                                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                : 'bg-red-500/10 border border-red-500/20 text-red-400'
                            }`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            {profileStatus === 'loading' ? 'Saving...' : profileStatus === 'success' ? 'Profile updated' : 'Error updating'}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Profile Form */}
                  <div className="space-y-6">
                    <form onSubmit={handleProfileSave} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                          <input
                            name="name"
                            value={profile.name}
                            onChange={handleProfileChange}
                            required
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={profile.email}
                            onChange={handleProfileChange}
                            required
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">GitHub</label>
                          <input
                            name="github"
                            value={profile.github}
                            onChange={handleProfileChange}
                            placeholder="https://github.com/username"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">LinkedIn</label>
                          <input
                            name="linkedin"
                            value={profile.linkedin}
                            onChange={handleProfileChange}
                            placeholder="https://linkedin.com/in/username"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
                          <input
                            name="mobile_number"
                            value={profile.mobile_number}
                            onChange={handleProfileChange}
                            placeholder="+1 (555) 123-4567"
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-4">
                        <motion.button
                          type="submit"
                          className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Save Profile
                        </motion.button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Camera modal */}
      <AnimatePresence>
        {showCamera && (
          <SelfieCapture
            onCapture={handleSelfieCapture}
            onCancel={() => { setShowCamera(false); setPendingType(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <motion.div
      className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl transition-all duration-300"
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl -z-10"></div>

      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-slate-400 text-sm font-medium">{label}</div>
    </motion.div>
  )
}
