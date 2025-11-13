'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'

export default function TestAdminPage() {
  const { user, loading } = useAuth()
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      // API 호출 테스트
      fetch('/api/admin/check-access')
        .then(res => res.json())
        .then(data => {
          console.log('API Response:', data)
          setApiResponse(data)
        })
        .catch(err => {
          console.error('API Error:', err)
          setError(err.message)
        })
    }
  }, [loading, user])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Access Test Page</h1>

      <div className="space-y-4">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-2">Auth State:</h2>
          <pre className="text-sm">
            {JSON.stringify({
              loading,
              userEmail: user?.email,
              userId: user?.id,
              userMetadata: user?.user_metadata
            }, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-2">API Response:</h2>
          <pre className="text-sm">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded">
            <h2 className="font-semibold mb-2 text-red-600">Error:</h2>
            <p>{error}</p>
          </div>
        )}

        <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded">
          <h2 className="font-semibold mb-2">Expected Admin Email:</h2>
          <p className="font-mono">seah0623@naver.com</p>
          <p className="text-sm mt-2">
            Current User: <span className="font-mono">{user?.email || 'Not logged in'}</span>
          </p>
          <p className="text-sm mt-1">
            Match: <span className="font-bold">{user?.email === 'seah0623@naver.com' ? 'YES ✅' : 'NO ❌'}</span>
          </p>
        </div>

        <div className="mt-6">
          <h2 className="font-semibold mb-2">Debug Links:</h2>
          <div className="space-x-4">
            <a href="/admin" className="text-blue-600 hover:underline">/admin (Will redirect if not admin)</a>
            <a href="/dashboard" className="text-blue-600 hover:underline">/dashboard</a>
          </div>
        </div>
      </div>
    </div>
  )
}