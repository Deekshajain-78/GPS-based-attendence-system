import { useState } from 'react'
import './App.css'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

// Admin credentials (frontend-only gate — backend has no role system)
const ADMIN_EMAIL = 'admin@attendtrack.com'
const ADMIN_PASSWORD = 'admin123'

function App() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const handleLogin = (data, email, password) => {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsAdmin(true)
    }
    setUser(data)
  }

  const handleLogout = () => { setUser(null); setIsAdmin(false) }

  return (
    <div className="app">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : isAdmin ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
