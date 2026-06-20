export default function ActionTable({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="action-table-container">
      <div className="section-header">
        <span className="section-icon">✅</span>
        <h2>Action Items</h2>
        <span className="badge">{items.length}</span>
      </div>
      <div className="table-wrapper">
        <table className="action-table" id="action-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Task</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="action-row">
                <td>
                  <span className="owner-badge">{item.owner}</span>
                </td>
                <td className="task-cell">{item.task}</td>
                <td>
                  <span className={`deadline-badge ${item.deadline === "Not specified" ? "no-deadline" : ""}`}>
                    {item.deadline}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
