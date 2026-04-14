import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import SelfieCapture from './SelfieCapture'
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
  const [meetingRequests, setMeetingRequests] = useState([])
  const [referralRequests, setReferralRequests] = useState([])
  const [taskRequests, setTaskRequests] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [filterUser, setFilterUser] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' })
  const [meetingForm, setMeetingForm] = useState({ title: '', description: '', scheduled_date: '', scheduled_time: '', user_id: '', meeting_link: '' })
  const [meetingStatus, setMeetingStatus] = useState('idle')
  const [meetingError, setMeetingError] = useState('')
  const [meetingSuccess, setMeetingSuccess] = useState('')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [profileSelfie, setProfileSelfie] = useState(null)
  const [referralEdit, setReferralEdit] = useState({})

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, r, u, t, l, m, f] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/all-attendance').then(r => r.json()),
        fetch('/api/admin/users').then(r => r.json()),
        fetch('/api/admin/tasks').then(r => r.json()),
        fetch('/api/admin/leaves').then(r => r.json()),
        fetch('/api/admin/meetings').then(r => r.json()),
        fetch('/api/admin/referrals').then(r => r.json()),
      ])
      setStats(s); setRecords(r); setUsers(u); setTaskRequests(t); setLeaveRequests(l); setMeetingRequests(m); setReferralRequests(f)
    } finally { setLoading(false) }
  }

  const filtered = records.filter(r => {
    const matchUser = filterUser ? r.user_id === parseInt(filterUser) : true
    const matchDate = filterDate ? r.timestamp.startsWith(filterDate) : true
    return matchUser && matchDate
  })

  const handleUserFormChange = (e) => setUserForm({ ...userForm, [e.target.name]: e.target.value })
  const handleMeetingFormChange = (e) => setMeetingForm({ ...meetingForm, [e.target.name]: e.target.value })

  const handleCreateMeeting = async (e) => {
    e.preventDefault()
    setMeetingError(''); setMeetingSuccess(''); setMeetingStatus('loading')
    try {
      if (!meetingForm.title || !meetingForm.scheduled_date || !meetingForm.scheduled_time) {
        throw new Error('Title, scheduled date and time are required')
      }
      const scheduled_for = `${meetingForm.scheduled_date}T${meetingForm.scheduled_time}`
      const body = {
        created_by: 1,
        title: meetingForm.title,
        description: meetingForm.description,
        scheduled_for,
        user_id: meetingForm.user_id ? parseInt(meetingForm.user_id) : null,
        meeting_link: meetingForm.meeting_link || null
      }
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to schedule meeting')
      setMeetingSuccess('Meeting scheduled successfully!')
      setMeetingForm({ title: '', description: '', scheduled_for: '', user_id: '', meeting_link: '' })
      fetchAll()
    } catch (err) {
      setMeetingError(err.message)
    } finally {
      setMeetingStatus('idle')
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setUserError(''); setUserSuccess(''); setUserLoading(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userForm, selfie: profileSelfie }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to create user')
      setUserSuccess('User created successfully!')
      setUserForm({ name: '', email: '', password: '' })
      setProfileSelfie(null)
      fetchAll() // Refresh the users list
    } catch (err) {
      setUserError(err.message)
    } finally {
      setUserLoading(false)
    }
  }

  const handleReferralUpdate = async (referralId) => {
    try {
      const current = referralRequests.find(r => r.id === referralId)
      const edit = referralEdit[referralId] || {}
      const body = {
        status: edit.status || current.status,
        bonus_awarded: edit.bonus_awarded !== undefined ? edit.bonus_awarded : !!current.bonus_awarded,
      }
      const res = await fetch(`/api/admin/referrals/${referralId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to update referral')
      setReferralEdit(prev => ({ ...prev, [referralId]: {} }))
      fetchAll()
    } catch (err) {
      alert(err.message || 'Failed to update referral')
    }
  }

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
    <div className="admin-page min-h-screen bg-[#0f172a] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b]/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col p-6 gap-2 relative">
        <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6 px-2 flex items-center gap-2">
          AttendTrack
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'overview', label: 'Dashboard' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'users', label: 'Users' },
            { id: 'performance', label: 'Performance' },
            { id: 'tasks', label: 'Tasks' },
            { id: 'leaves', label: 'Leaves' },
            { id: 'meetings', label: 'Meetings' },
            { id: 'referrals', label: 'Referrals' },
            { id: 'create-user', label: 'Create User' }
          ].map(({ id, label }) => (
            <motion.button
              key={id}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                tab === id
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
          className="w-full text-left px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 mt-auto flex items-center gap-3"
          onClick={onLogout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Logout
        </motion.button>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Header */}
        <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">
              Welcome back, <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Admin</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium">{new Date().toDateString()}</p>
          </div>

          <motion.button
            className="admin-btn-secondary"
            onClick={fetchAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Refresh Data
          </motion.button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-300 text-lg">Loading data...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCardNew
                    label="Total Users"
                    value={stats?.total_users}
                    bg="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20"
                  />
                  <StatCardNew
                    label="Total Records"
                    value={stats?.total_records}
                    bg="bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/20"
                  />
                  <StatCardNew
                    label="Present Today"
                    value={stats?.present_today}
                    bg="bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/20"
                  />
                  <StatCardNew
                    label="Late Today"
                    value={stats?.late_today}
                    bg="bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="admin-card">
                    <h3 className="text-lg font-semibold mb-6 text-white uppercase tracking-wider">
                      Daily Check-ins
                    </h3>
                    {barData && <Bar data={barData} options={CHART_OPTS} />}
                  </div>
                  <div className="admin-card">
                    <h3 className="text-lg font-semibold mb-6 text-white uppercase tracking-wider">
                      Attendance Distribution
                    </h3>
                    {pieData && <Pie data={pieData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20 } } } }} />}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── ATTENDANCE ── */}
            {tab === 'attendance' && (
              <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Attendance Records
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mb-8 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    <div className="flex-1 flex gap-4">
                      <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="admin-select max-w-[220px]">
                        <option value="">All Users</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="admin-input max-w-[200px]" />
                      <button className="admin-btn-secondary !py-2" onClick={() => { setFilterUser(''); setFilterDate('') }}>Clear Filters</button>
                    </div>
                    <button className="admin-btn-primary !w-auto" onClick={exportCSV}>
                      Export CSV
                    </button>
                  </div>

                  <p className="text-sm text-slate-400 mb-4 font-medium">{filtered.length} records found</p>
                  
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th className="w-16">#</th>
                          <th>User Information</th>
                          <th>Type</th>
                          <th>Location</th>
                          <th>Timestamp</th>
                          <th>Verification</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, i) => (
                          <tr key={r.id}>
                            <td className="font-mono text-slate-500">{i + 1}</td>
                            <td>
                              <div className="flex flex-col">
                                <div className="font-bold text-slate-100">{r.name}</div>
                                <div className="text-xs text-slate-500">{r.email}</div>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${r.type === 'in' ? 'success' : 'danger'}`}>
                                {r.type === 'in' ? 'Check In' : 'Check Out'}
                              </span>
                            </td>
                            <td>
                              <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-sm font-medium">
                                {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                              </a>
                            </td>
                            <td className="text-sm text-slate-400">
                              {new Date(r.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                            <td>
                              <div className="flex items-center gap-3">
                                <span className={r.face_match ? 'text-green-400' : 'text-red-400'} title="Face Verification">
                                  {r.face_match ? 'Matched' : 'Failed'}
                                </span>
                                <span className={r.fake_gps_detected ? 'text-amber-400' : 'text-green-400'} title="GPS Verification">
                                  {r.fake_gps_detected ? 'Suspicious' : 'Verified'}
                                </span>
                              </div>
                            </td>
                            <td>
                              {r.fake_gps_detected ? (
                                <span className="status-badge danger">Action Required</span>
                              ) : (
                                <span className="status-badge success">Approved</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filtered.length === 0 && <div className="p-16 text-center text-slate-500 font-medium">No attendance records matching your criteria.</div>}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Registered Users
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {users.map((u, i) => {
                      const count = records.filter(r => r.user_id === u.id && r.type === 'in').length
                      return (
                        <motion.div 
                          key={u.id} 
                          className="p-8 bg-slate-800/40 border border-slate-700/50 rounded-3xl text-center flex flex-col items-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          whileHover={{ y: -6, borderColor: '#38bdf8', backgroundColor: 'rgba(30, 41, 59, 0.6)' }}
                        >
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-3xl mb-6 shadow-xl shadow-cyan-500/10">
                            {u.name[0].toUpperCase()}
                          </div>
                          <div className="font-bold text-xl text-slate-100 mb-1">{u.name}</div>
                          <div className="text-sm text-slate-500 mb-6 truncate w-full px-2">{u.email}</div>
                          
                          <div className="w-full pt-6 border-t border-slate-700/50 flex flex-col gap-3">
                            <div className="flex justify-between items-center px-2">
                              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Attendance</span>
                              <span className="text-sm font-bold text-cyan-400">{count} Days</span>
                            </div>
                            <div className="flex justify-between items-center px-2">
                              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Performance</span>
                              <span className="text-sm font-bold text-amber-400">{u.performance_points || 0} Pts</span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'tasks' && (
              <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Task Overview
                  </h3>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th className="w-16">#</th>
                          <th>User Details</th>
                          <th>Task Description</th>
                          <th>Submission Date</th>
                          <th>Execution Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskRequests.map((t, i) => (
                          <tr key={t.id}>
                            <td className="font-mono text-slate-500">{i + 1}</td>
                            <td>
                              <div className="flex flex-col">
                                <div className="font-bold text-slate-100">{t.name}</div>
                                <div className="text-xs text-slate-500">{t.email}</div>
                              </div>
                            </td>
                            <td>
                              <div className="font-medium text-slate-200">{t.title}</div>
                            </td>
                            <td className="text-sm text-slate-400">{t.date}</td>
                            <td>
                              <span className={`status-badge ${t.status === 'completed' ? 'success' : 'warning'}`}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {taskRequests.length === 0 && <div className="p-16 text-center text-slate-500 font-medium italic">No tasks assigned yet.</div>}
                  </div>
                </div>
              </motion.div>
            )}
            {tab === 'performance' && (
              <motion.div key="performance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Performance Management
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-12">
                    <section>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                        <div className="w-8 h-[2px] bg-amber-400"></div>
                        Manual Score Adjustment
                      </h4>
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>User Identification</th>
                              <th>Current Performance Score</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((u) => (
                              <tr key={u.id}>
                                <td>
                                  <div className="flex flex-col">
                                    <div className="font-bold text-slate-100">{u.name}</div>
                                    <div className="text-xs text-slate-500">{u.email}</div>
                                  </div>
                                </td>
                                <td>
                                  <div className="font-mono text-xl font-bold text-amber-400">
                                    {u.performance_points || 0}
                                  </div>
                                </td>
                                <td>
                                  <div className="flex items-center justify-end gap-3">
                                    <input
                                      type="number"
                                      min="0"
                                      defaultValue="0"
                                      className="admin-input !w-24 text-center font-bold"
                                      id={`manual-points-${u.id}`}
                                    />
                                    <button className="admin-btn-primary !w-auto px-8" onClick={() => {
                                      const addPoints = parseInt(document.getElementById(`manual-points-${u.id}`).value) || 0;
                                      const newTotal = (u.performance_points || 0) + addPoints;
                                      fetch(`/api/admin/users/${u.id}/performance`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ performance_points: newTotal })
                                      }).then(() => {
                                        document.getElementById(`manual-points-${u.id}`).value = '0';
                                        fetchAll();
                                      });
                                    }}>Update Score</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                        <div className="w-8 h-[2px] bg-cyan-400"></div>
                        Project Milestone Rewards
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {users.map((user) => {
                          const userTasks = taskRequests.filter(t => t.user_id === user.id && t.status === 'completed');
                          return (
                            <div key={user.id} className="p-8 bg-slate-800/30 rounded-3xl border border-slate-700/50">
                              <div className="flex justify-between items-center mb-6">
                                <div className="font-bold text-lg text-slate-100">{user.name}</div>
                                <div className="font-mono text-amber-400 font-bold">
                                  {user.performance_points || 0} PTS
                                </div>
                              </div>
                              {userTasks.length > 0 ? (
                                <div className="space-y-4">
                                  {userTasks.map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-700/30">
                                      <div className="flex-1 min-w-0 mr-4">
                                        <div className="text-sm font-bold text-slate-200 truncate">{task.title}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{task.date}</div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="number"
                                          min="0"
                                          defaultValue="10"
                                          className="admin-input !py-1.5 !px-2 w-16 text-center font-bold"
                                          id={`points-${task.id}`}
                                        />
                                        <button className="px-4 py-1.5 bg-cyan-500 text-white text-xs font-bold rounded-lg hover:bg-cyan-400 transition-colors" onClick={() => {
                                          const points = parseInt(document.getElementById(`points-${task.id}`).value) || 0;
                                          const newTotal = (user.performance_points || 0) + points;
                                          fetch(`/api/admin/users/${user.id}/performance`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ performance_points: newTotal })
                                          }).then(() => fetchAll());
                                        }}>
                                          Award
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-6 text-xs text-slate-600 font-bold uppercase tracking-widest bg-slate-900/20 rounded-2xl border border-dashed border-slate-800">
                                  No Completed Milestones
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'leaves' && (
              <motion.div key="leaves" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Leave Requests
                  </h3>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th className="text-left w-[30%]">Employee Details</th>
                          <th className="text-left w-[25%]">Request Period</th>
                          <th className="text-left w-[25%]">Justification</th>
                          <th className="text-left w-[10%]">Status</th>
                          <th className="text-right w-[10%]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveRequests.map((l) => (
                          <tr key={l.id}>
                            <td className="text-left">
                              <div className="flex flex-col">
                                <div className="font-bold text-slate-100">{l.name}</div>
                                <div className="text-xs text-slate-500">{l.email}</div>
                              </div>
                            </td>
                            <td className="text-left">
                              <div className="text-sm font-bold text-slate-200">
                                {l.start_date} <span className="text-slate-500 mx-2">to</span> {l.end_date}
                              </div>
                            </td>
                            <td className="text-left">
                              <div className="text-xs text-slate-400 max-w-[220px] line-clamp-2 leading-relaxed" title={l.reason}>
                                {l.reason}
                              </div>
                            </td>
                            <td className="text-left">
                              <span className={`status-badge ${l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'} !text-[10px] uppercase tracking-widest`}>
                                {l.status}
                              </span>
                            </td>
                            <td className="text-right">
                              {l.status === 'pending' && (
                                <div className="flex justify-end gap-3">
                                  <button className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest" onClick={async () => { await fetch(`/api/admin/leaves/${l.id}/approve`, {method:'POST'}); fetchAll(); }}>
                                    Approve
                                  </button>
                                  <button className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest" onClick={async () => { await fetch(`/api/admin/leaves/${l.id}/reject`, {method:'POST'}); fetchAll(); }}>
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {leaveRequests.length === 0 && (
                      <div className="p-20 text-center">
                        <p className="text-slate-600 uppercase tracking-[0.2em] font-bold text-xs">No pending leave authorizations</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'meetings' && (
              <motion.div key="meetings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-4">
                    <div className="admin-card h-full">
                      <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                        Schedule Meeting
                      </h3>
                      <form onSubmit={handleCreateMeeting} className="space-y-6">
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Meeting Title</label>
                          <input className="admin-input" name="title" value={meetingForm.title} onChange={handleMeetingFormChange} required placeholder="e.g. Weekly Strategy Sync" />
                        </div>
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Agenda / Description</label>
                          <textarea className="admin-input min-h-[120px]" name="description" value={meetingForm.description} onChange={handleMeetingFormChange} placeholder="Outline the key points to discuss..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="admin-form-group">
                            <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Date</label>
                            <input type="date" className="admin-input" name="scheduled_date" value={meetingForm.scheduled_date} onChange={handleMeetingFormChange} required />
                          </div>
                          <div className="admin-form-group">
                            <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Time</label>
                            <input type="time" className="admin-input" name="scheduled_time" value={meetingForm.scheduled_time} onChange={handleMeetingFormChange} required />
                          </div>
                        </div>
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Target Participant</label>
                          <select className="admin-select" name="user_id" value={meetingForm.user_id} onChange={handleMeetingFormChange}>
                            <option value="">All Team Members</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Platform Link</label>
                          <input className="admin-input" name="meeting_link" value={meetingForm.meeting_link} onChange={handleMeetingFormChange} placeholder="Zoom / Google Meet Link" />
                        </div>
                        
                        {meetingError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">{meetingError}</div>}
                        {meetingSuccess && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold">{meetingSuccess}</div>}
                        
                        <button className="admin-btn-primary py-4 uppercase tracking-[0.2em] font-bold" type="submit" disabled={meetingStatus === 'loading'}>
                          {meetingStatus === 'loading' ? 'Processing...' : 'Schedule Meeting'}
                        </button>
                      </form>
                    </div>
                  </div>
                  
                  <div className="lg:col-span-8">
                    <div className="admin-card h-full">
                      <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                        Upcoming Meetings
                      </h3>
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th className="w-[35%]">Meeting Information</th>
                              <th className="w-[25%]">Scheduled Time</th>
                              <th className="w-[25%]">Participants</th>
                              <th className="w-[15%]">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {meetingRequests.map((m) => (
                              <tr key={m.id}>
                                <td>
                                  <div className="font-bold text-slate-100">{m.title}</div>
                                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-2 leading-relaxed italic">{m.description || 'No agenda provided'}</div>
                                  {m.meeting_link && (
                                    <a href={m.meeting_link} target="_blank" rel="noreferrer" className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest hover:underline mt-3 block">
                                      Launch Meeting
                                    </a>
                                  )}
                                </td>
                                <td>
                                  <div className="text-slate-200 font-bold text-sm">
                                    {new Date(m.scheduled_for).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">
                                    {new Date(m.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>
                                <td>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                                      {(m.user_id ? users.find(u => u.id === m.user_id)?.name[0] : 'T') || 'T'}
                                    </div>
                                    <span className="text-sm font-medium text-slate-200">
                                      {m.user_id ? users.find(u => u.id === m.user_id)?.name : 'All Team Members'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`status-badge ${m.status === 'scheduled' ? 'info' : 'success'} uppercase tracking-widest !text-[10px]`}>
                                    {m.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {meetingRequests.length === 0 && (
                          <div className="p-20 text-center">
                            <p className="text-slate-600 uppercase tracking-[0.2em] font-bold text-xs">Zero meetings on the horizon</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {tab === 'referrals' && (
              <motion.div key="referrals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="admin-card">
                  <h3 className="text-2xl font-bold mb-8 text-white uppercase tracking-wider">
                    Referral Tracking
                  </h3>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th className="text-left">Referrer</th>
                          <th className="text-left">Candidate Email</th>
                          <th className="text-left">Status Update</th>
                          <th className="text-left">Bonus Award</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referralRequests.map((r) => {
                          const edit = referralEdit[r.id] || {}
                          const isAwarded = edit.bonus_awarded !== undefined ? edit.bonus_awarded : !!r.bonus_awarded
                          return (
                            <tr key={r.id}>
                              <td className="text-left">
                                <div className="font-bold text-slate-100">{r.referrer_name}</div>
                              </td>
                              <td className="text-left">
                                <div className="text-sm text-slate-400">{r.candidate_email}</div>
                              </td>
                              <td className="text-left">
                                <select
                                  className="admin-select !py-1 !px-2 max-w-[140px] text-xs font-bold uppercase tracking-widest"
                                  value={edit.status || r.status}
                                  onChange={(e) => setReferralEdit(prev => ({ ...prev, [r.id]: { ...prev[r.id], status: e.target.value } }))}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="hired">Hired</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="done">Done</option>
                                </select>
                              </td>
                              <td className="text-left">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    isAwarded
                                      ? 'bg-cyan-500 border-cyan-500 shadow-lg shadow-cyan-500/20'
                                      : 'bg-slate-800 border-slate-700 group-hover:border-slate-500'
                                  }`}>
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={isAwarded}
                                      onChange={(e) => setReferralEdit(prev => ({ ...prev, [r.id]: { ...prev[r.id], bonus_awarded: e.target.checked } }))}
                                    />
                                    {isAwarded && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                  </div>
                                  <span className={`text-[10px] uppercase tracking-widest font-bold ${isAwarded ? 'text-cyan-400' : 'text-slate-500'}`}>
                                    {isAwarded ? 'Awarded' : 'Pending'}
                                  </span>
                                </label>
                              </td>
                              <td className="text-right">
                                <button className="admin-btn-primary !w-auto px-6 !py-2 text-[10px] uppercase tracking-widest font-bold" onClick={() => handleReferralUpdate(r.id)}>Save Update</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {referralRequests.length === 0 && (
                      <div className="p-20 text-center">
                        <p className="text-slate-600 uppercase tracking-[0.2em] font-bold text-xs">No active referrals in pipeline</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CREATE USER ── */}
            {tab === 'create-user' && (
              <motion.div key="create-user" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="max-w-2xl mx-auto">
                  <div className="admin-card">
                    <h3 className="text-2xl font-bold mb-10 text-white uppercase tracking-wider text-center">
                      Register Team Member
                    </h3>
                    <form onSubmit={handleCreateUser} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Full Legal Name</label>
                          <input className="admin-input" type="text" name="name" placeholder="John Doe" value={userForm.name} onChange={handleUserFormChange} required />
                        </div>
                        <div className="admin-form-group">
                          <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Official Email Address</label>
                          <input className="admin-input" type="email" name="email" placeholder="john@company.com" value={userForm.email} onChange={handleUserFormChange} required />
                        </div>
                      </div>
                      <div className="admin-form-group">
                        <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Secure Access Password</label>
                        <input className="admin-input" type="password" name="password" placeholder="••••••••••••" value={userForm.password} onChange={handleUserFormChange} required />
                      </div>
                      <div className="admin-form-group">
                        <label className="admin-label uppercase tracking-widest text-[10px] font-bold">Identity Verification Photo</label>
                        {profileSelfie ? (
                          <div className="flex flex-col items-center gap-6 p-8 bg-slate-800/50 rounded-3xl border border-slate-700">
                            <img src={profileSelfie} alt="profile" className="w-32 h-32 rounded-full object-cover border-4 border-cyan-500 shadow-2xl shadow-cyan-500/20" />
                            <div className="text-center">
                              <p className="text-xs text-green-400 font-bold uppercase tracking-widest mb-2">Biometric Data Captured</p>
                              <button type="button" className="text-[10px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest font-bold transition-colors" onClick={() => setShowCamera(true)}>Recapture Identity</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" className="w-full border-2 border-dashed border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-cyan-500/50 rounded-3xl py-16 transition-all group" onClick={() => setShowCamera(true)}>
                            <p className="text-slate-500 uppercase tracking-[0.2em] font-bold text-xs group-hover:text-cyan-400">Initialize Identity Capture</p>
                          </button>
                        )}
                      </div>
                      
                      {userError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center">{userError}</div>}
                      {userSuccess && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-xs font-bold text-center">{userSuccess}</div>}
                      
                      <button type="submit" className="admin-btn-primary py-5 text-sm uppercase tracking-[0.3em] font-bold" disabled={userLoading || !profileSelfie}>
                        {userLoading ? 'Processing Authorization...' : 'Finalize Registration'}
                      </button>
                      {!profileSelfie && <p className="text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">Identity verification is mandatory for security protocols</p>}
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}

        <AnimatePresence>
          {showCamera && (
            <SelfieCapture
              onCapture={(img) => { setProfileSelfie(img); setShowCamera(false) }}
              onCancel={() => setShowCamera(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

function StatCardNew({ label, value, bg }) {
  return (
    <motion.div
      className="stat-card-new"
      whileHover={{ y: -4, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col">
        <span className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">{label}</span>
        <span className="text-3xl font-bold text-white leading-tight">{value ?? '0'}</span>
      </div>
      {/* Decorative background glow */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 ${bg}`}></div>
    </motion.div>
  )
}
