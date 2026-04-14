import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars

export default function AttendanceHistory({ records }) {
  return (
    <motion.div
      className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10"></div>

      <h3 className="text-2xl font-bold text-white mb-6">
        Attendance History
      </h3>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">No records yet. Mark your first attendance!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-slate-300 font-semibold">#</th>
                <th className="px-4 py-3 text-slate-300 font-semibold">Type</th>
                <th className="px-4 py-3 text-slate-300 font-semibold">Latitude</th>
                <th className="px-4 py-3 text-slate-300 font-semibold">Longitude</th>
                <th className="px-4 py-3 text-slate-300 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <motion.tr
                  key={r.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <td className="px-4 py-3 text-slate-300">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.type === 'in'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {r.type === 'in' ? 'Check In' : 'Check Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{parseFloat(r.latitude).toFixed(5)}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono">{parseFloat(r.longitude).toFixed(5)}</td>
                  <td className="px-4 py-3 text-white">{new Date(r.timestamp).toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}
