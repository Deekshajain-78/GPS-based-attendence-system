import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend, Title
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

const CHART_OPTS = {
  responsive: true,
  plugins: { legend: { labels: { color: '#94a3b8' } } },
  scales: { x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }, y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } } }
}

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [records, setRecords] = useState([])
  const [users, setUsers] = useState([])
  const [filterUser, setFilterUser] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, r, u] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/all-attendance').then(r => r.json()),
        fetch('/api/admin/users').then(r => r.json()),
      ])
      setStats(s); setRecords(r); setUsers(u)
    } finally { setLoading(false) }
  }

  const filtered = records.filter(r => {
    const matchUser = filterUser ? r.user_id === parseInt(filterUser) : true
    const matchDate = filterDate ? r.timestamp.startsWith(filterDate) : true
    return matchUser && matchDate
  })

  const exportCSV = () => {
    const rows = [['Name', 'Email', 'Type', 'Latitude', 'Longitude', 'Timestamp', 'Face Match']]
    filtered.forEach(r => rows.push([r.name, r.email, r.type, r.latitude, r.longitude, r.timestamp, r.face_match ? 'Yes' : 'No']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'attendance_report.csv'
    a.click()
  }

  const barData = stats ? {
    labels: [...stats.daily_checkins].reverse().map(d => d.day),
    datasets: [{ label: 'Check-ins', data: [...stats.daily_checkins].reverse().map(d => d.count), backgroundColor: 'rgba(56,189,248,0.7)', borderRadius: 6 }]
  } : null

  const pieData = stats ? {
    labels: stats.per_user.map(u => u.name),
    datasets: [{ data: stats.per_user.map(u => u.count), backgroundColor: ['#38bdf8','#6366f1','#22c55e','#f59e0b','#ef4444','#a78bfa','#34d399'] }]
  } : null

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">🛡️ Admin</div>
        <nav>
          {['overview','attendance','users'].map(t => (
            <button key={t} className={tab === t ? 'nav-item active' : 'nav-item'} onClick={() => setTab(t)}>
              {t === 'overview' ? '📊 Overview' : t === 'attendance' ? '📋 Attendance' : '👥 Users'}
            </button>
          ))}
        </nav>
        <button className="nav-item logout" onClick={onLogout}>🚪 Logout</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>Admin Dashboard 🛡️</h2>
            <p className="date-text">{new Date().toDateString()}</p>
          </div>
          <motion.button className="btn-refresh" onClick={fetchAll} whileTap={{ scale: 0.95 }}>🔄 Refresh</motion.button>
        </header>

        {loading ? (
          <div className="admin-loading">⏳ Loading data...</div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <motion.div key="overview" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3 }}>
                <div className="stats-row">
                  <StatCard icon="👥" label="Total Users" value={stats?.total_users} color="#38bdf8" />
                  <StatCard icon="📋" label="Total Records" value={stats?.total_records} color="#6366f1" />
                  <StatCard icon="✅" label="Present Today" value={stats?.present_today} color="#22c55e" />
                  <StatCard icon="⏰" label="Late Today" value={stats?.late_today} color="#f59e0b" />
                </div>

                <div className="charts-grid">
                  <div className="card chart-card">
                    <h3>📈 Daily Check-ins (Last 7 Days)</h3>
                    {barData && <Bar data={barData} options={CHART_OPTS} />}
                  </div>
                  <div className="card chart-card">
                    <h3>🥧 Attendance by User</h3>
                    {pieData && <Pie data={pieData} options={{ responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } } }} />}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── ATTENDANCE ── */}
            {tab === 'attendance' && (
              <motion.div key="attendance" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3 }}>
                <div className="card">
                  <div className="admin-filters">
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="filter-select">
                      <option value="">All Users</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="filter-input" />
                    <button className="btn-clear" onClick={() => { setFilterUser(''); setFilterDate('') }}>✕ Clear</button>
                    <motion.button className="btn-export" onClick={exportCSV} whileTap={{ scale: 0.96 }}>📥 Export CSV</motion.button>
                  </div>
                  <p className="filter-count">{filtered.length} records</p>
                  <div className="table-wrap">
                    <table className="att-table">
                      <thead>
                        <tr><th>#</th><th>Name</th><th>Type</th><th>Location</th><th>Time</th><th>Face</th><th>GPS Status</th></tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => (
                          <motion.tr key={r.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.02 }}>
                            <td>{i + 1}</td>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar-sm">{r.name[0]}</div>
                                <div>
                                  <div>{r.name}</div>
                                  <div className="user-email">{r.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className={`badge ${r.type === 'in' ? 'badge-in' : 'badge-out'}`}>{r.type === 'in' ? '✅ In' : '🔴 Out'}</span></td>
                            <td className="loc-cell">
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer" className="map-link">
                                📍 {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                              </a>
                            </td>
                            <td>{new Date(r.timestamp).toLocaleString()}</td>
                            <td><span className={r.face_match ? 'face-ok' : 'face-fail'}>{r.face_match ? '✅' : '❌'}</span></td>
                            <td>
                              {r.fake_gps_detected ? (
                                <span className="gps-suspicious" title={r.fake_gps_reason || 'Suspicious GPS activity detected'}>⚠️</span>
                              ) : (
                                <span className="gps-ok" title="GPS verified">✅</span>
                              )}
                              {r.accuracy && <span className="accuracy-info" title={`Accuracy: ${r.accuracy.toFixed(1)}m`}>📡</span>}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                    {filtered.length === 0 && <p className="empty-msg">No records found.</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── USERS ── */}
            {tab === 'users' && (
              <motion.div key="users" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.3 }}>
                <div className="card">
                  <h3>👥 Registered Users</h3>
                  <div className="users-grid">
                    {users.map((u, i) => {
                      const count = records.filter(r => r.user_id === u.id && r.type === 'in').length
                      return (
                        <motion.div key={u.id} className="user-card"
                          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}
                          whileHover={{ y: -4 }}>
                          <div className="user-avatar">{u.name[0].toUpperCase()}</div>
                          <div className="user-name">{u.name}</div>
                          <div className="user-email">{u.email}</div>
                          <div className="user-stat">{count} check-ins</div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <motion.div className="stat-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-value" style={{ color }}>{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
    </motion.div>
  )
}
