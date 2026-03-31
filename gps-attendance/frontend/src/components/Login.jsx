import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import SelfieCapture from './SelfieCapture'

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [profileSelfie, setProfileSelfie] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      // Admin bypass — no backend call needed
      if (form.email === 'admin@attendtrack.com' && form.password === 'admin123') {
        onLogin({ id: 0, name: 'Admin', email: form.email }, form.email, form.password)
        return
      }
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      onLogin(data, form.email, form.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, selfie: profileSelfie }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed')
      setSuccess('Registered successfully! You can now login.')
      setTab('login')
      setForm({ name: '', email: form.email, password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="login-icon">📍</div>
        <h1>GPS Attendance</h1>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={tab === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setTab('login'); setError(''); setSuccess('') }}
          >
            Sign In
          </button>
          <button
            className={tab === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setTab('register'); setError(''); setSuccess('') }}
          >
            Register
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'login' ? (
            <motion.form
              key="login"
              onSubmit={handleLogin}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <p className="login-sub">Sign in to mark your attendance</p>
              <div className="field">
                <label>Email</label>
                <input type="email" name="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" name="password" placeholder="••••••••"
                  value={form.password} onChange={handleChange} required />
              </div>
              {success && <p className="success-msg">{success}</p>}
              {error && <p className="error">{error}</p>}
              <motion.button type="submit" className="btn-primary"
                whileTap={{ scale: 0.97 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              onSubmit={handleRegister}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <p className="login-sub">Create your account</p>
              <div className="field">
                <label>Full Name</label>
                <input type="text" name="name" placeholder="Your name"
                  value={form.name} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" name="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" name="password" placeholder="••••••••"
                  value={form.password} onChange={handleChange} required />
              </div>
              {/* Profile selfie */}
              <div className="field">
                <label>Profile Photo (for face verification)</label>
                {profileSelfie ? (
                  <div className="profile-selfie-wrap">
                    <img src={profileSelfie} alt="profile" className="profile-selfie-preview" />
                    <button type="button" className="btn-retake-small" onClick={() => setShowCamera(true)}>🔄 Retake</button>
                  </div>
                ) : (
                  <button type="button" className="btn-camera" onClick={() => setShowCamera(true)}>
                    📸 Take Profile Photo
                  </button>
                )}
              </div>

              {error && <p className="error">{error}</p>}
              <motion.button type="submit" className="btn-primary"
                whileTap={{ scale: 0.97 }} disabled={loading || !profileSelfie}>
                {loading ? 'Registering...' : 'Register'}
              </motion.button>
              {!profileSelfie && <p style={{fontSize:'0.78rem',color:'#475569',marginTop:'0.4rem'}}>Profile photo required</p>}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showCamera && (
          <SelfieCapture
            onCapture={(img) => { setProfileSelfie(img); setShowCamera(false) }}
            onCancel={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
