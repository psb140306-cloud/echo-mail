export default function AdminTestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Admin Test Page</h1>
      <p>If you can see this, the admin route is working.</p>
      <p>Timestamp: {new Date().toISOString()}</p>
    </div>
  )
}
