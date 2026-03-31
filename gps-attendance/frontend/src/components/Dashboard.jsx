import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import AttendanceHistory from './AttendanceHistory'
import SelfieCapture from './SelfieCapture'

export default function Dashboard({ user, onLogout }) {
  const [location, setLocation] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState([])
  const [activeTab, setTab] = useState('checkin')
  const [showCamera, setShowCamera] = useState(false)
  const [pendingType, setPendingType] = useState(null)
  const [lastSelfie, setLastSelfie] = useState(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/${user.id}`)
      const data = await res.json()
      setRecords(data)
    } catch { /* silent */ }
  }, [user.id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const getLocation = () =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true })
    )

  // Step 1: open camera
  const handleMark = (type) => {
    setPendingType(type)
    setShowCamera(true)
    setMessage('')
  }

  // Step 2: selfie captured → get location → submit
  const handleSelfieCapture = async (selfieBase64) => {
    setShowCamera(false)
    setLastSelfie(selfieBase64)
    setStatus('loading')
    setMessage('loading')
    try {
      const pos = await getLocation()
      const { latitude, longitude } = pos.coords
      setLocation({ latitude, longitude })

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          latitude,
          longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed || null,
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

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">📍 AttendTrack</div>
        <nav>
          <button className={activeTab === 'checkin' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('checkin')}>
            🏠 Dashboard
          </button>
          <button className={activeTab === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('history')}>
            📋 History
          </button>
        </nav>
        <button className="nav-item logout" onClick={onLogout}>🚪 Logout</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>Welcome back, {user.name} 👋</h2>
            <p className="date-text">{new Date().toDateString()}</p>
          </div>
          <div className="avatar">{user.name[0].toUpperCase()}</div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'checkin' && (
            <motion.div key="checkin"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>

              <div className="card gps-card">
                <div className="gps-pulse">
                  <span className="pulse-ring" />
                  <span className="pulse-dot">📍</span>
                </div>
                <h3>Mark Attendance</h3>
                <p>A selfie will be taken to verify your identity</p>

                {location && (
                  <motion.div className="location-badge"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                    🌐 {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </motion.div>
                )}

                {/* selfie preview */}
                {lastSelfie && status !== 'loading' && (
                  <motion.div className="selfie-thumb-wrap"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                    <img src={lastSelfie} alt="selfie" className="selfie-thumb" />
                    <span className={`selfie-badge ${status}`}>
                      {status === 'success' ? '✅ Verified' : '❌ Failed'}
                    </span>
                  </motion.div>
                )}

                <div className="btn-row">
                  <motion.button className="btn-checkin"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => handleMark('in')} disabled={status === 'loading'}>
                    ✅ Check In
                  </motion.button>
                  <motion.button className="btn-checkout"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => handleMark('out')} disabled={status === 'loading'}>
                    🔴 Check Out
                  </motion.button>
                </div>

                <AnimatePresence>
                  {message && (
                    <motion.div className={`status-msg ${status}`}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {status === 'loading' ? '⏳ Verifying identity & location...' : message}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="stats-row">
                <StatCard label="Total Records" value={records.length} icon="📊" />
                <StatCard label="Check-ins" value={records.filter(r => r.type === 'in').length} icon="✅" />
                <StatCard label="Check-outs" value={records.filter(r => r.type === 'out').length} icon="🔴" />
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <AttendanceHistory records={records} />
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

function StatCard({ label, value, icon }) {
  return (
    <motion.div className="stat-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </motion.div>
  )
}
