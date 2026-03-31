import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars

export default function AttendanceHistory({ records }) {
  return (
    <div className="card">
      <h3>📋 Attendance History</h3>
      {records.length === 0 ? (
        <p className="empty-msg">No records yet. Mark your first attendance!</p>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <td>{i + 1}</td>
                <td>
                  <span className={`badge ${r.type === 'in' ? 'badge-in' : 'badge-out'}`}>
                    {r.type === 'in' ? '✅ Check In' : '🔴 Check Out'}
                  </span>
                </td>
                <td>{parseFloat(r.latitude).toFixed(5)}</td>
                <td>{parseFloat(r.longitude).toFixed(5)}</td>
                <td>{new Date(r.timestamp).toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
