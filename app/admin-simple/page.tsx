export default function SimpleAdminPage() {
  return (
    <html>
      <body>
        <h1>Simple Admin Test (No Layout)</h1>
        <p>This page bypasses all layouts and providers.</p>
        <p>Current time: {new Date().toISOString()}</p>
      </body>
    </html>
  )
}
