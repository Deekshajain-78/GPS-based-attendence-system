import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars

export default function SelfieCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [captured, setCaptured] = useState(null)
  const [camError, setCamError] = useState('')
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCamError('Camera access denied. Please allow camera permission.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const startCountdown = () => {
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--
      if (c === 0) { clearInterval(iv); setCountdown(null); snap() }
      else setCountdown(c)
    }, 1000)
  }

  const snap = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    // resize to max 640px wide to reduce base64 size
    const maxW = 640
    const scale = Math.min(1, maxW / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    setCaptured(dataUrl)
    stopCamera()
  }

  const retake = () => {
    setCaptured(null)
    startCamera()
  }

  const confirm = () => {
    onCapture(captured)
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl"
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 40 }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">
            Take a Selfie
          </h3>
          <motion.button
            className="w-8 h-8 rounded-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            onClick={() => { stopCamera(); onCancel() }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            Cancel
          </motion.button>
        </div>

        {camError ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-300 text-sm">{camError}</p>
          </div>
        ) : (
          <>
            {/* Camera Preview */}
            <div className="relative mb-6">
              {!captured ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-2xl border border-cyan-500/50 shadow-lg"
                  />
                  {/* Face guide overlay */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/50 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-cyan-400 rounded-full opacity-50"></div>
                  </div>
                  <AnimatePresence>
                    {countdown !== null && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl"
                        key={countdown}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                      >
                        <div className="text-6xl font-bold text-white bg-cyan-500/20 rounded-full w-20 h-20 flex items-center justify-center">
                          {countdown}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <img
                  src={captured}
                  alt="selfie"
                  className="w-full rounded-2xl border border-green-500/50 shadow-lg"
                />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!captured ? (
                <motion.button
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-200 disabled:opacity-50"
                  onClick={startCountdown}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={countdown !== null}
                >
                  {countdown !== null ? countdown : 'Capture'}
                </motion.button>
              ) : (
                <>
                  <motion.button
                    className="flex-1 py-3 px-4 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white font-semibold rounded-xl transition-all duration-200"
                    onClick={retake}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Retake
                  </motion.button>
                  <motion.button
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
                    onClick={confirm}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Use This Photo
                  </motion.button>
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
