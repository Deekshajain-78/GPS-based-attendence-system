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
    <motion.div className="selfie-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="selfie-modal"
        initial={{ scale: 0.85, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 40 }}>

        <div className="selfie-header">
          <span>📸 Take a Selfie</span>
          <button className="selfie-close" onClick={() => { stopCamera(); onCancel() }}>✕</button>
        </div>

        {camError ? (
          <div className="selfie-error">{camError}</div>
        ) : (
          <>
            <div className="selfie-preview">
              {!captured ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="selfie-video" />
                  <div className="face-guide" />
                  <AnimatePresence>
                    {countdown !== null && (
                      <motion.div className="countdown"
                        key={countdown}
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}>
                        {countdown}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <img src={captured} alt="selfie" className="selfie-video" />
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="selfie-actions">
              {!captured ? (
                <motion.button className="btn-snap" onClick={startCountdown}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  disabled={countdown !== null}>
                  {countdown !== null ? `📸 ${countdown}` : '📸 Capture'}
                </motion.button>
              ) : (
                <>
                  <motion.button className="btn-retake" onClick={retake}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    🔄 Retake
                  </motion.button>
                  <motion.button className="btn-confirm" onClick={confirm}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    ✅ Use This Photo
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
