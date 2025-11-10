/**
 * Next.js Instrumentation
 * 서버 시작 시 자동으로 실행되는 초기화 코드
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 서버 사이드에서만 실행
    const { initializeSchedulers } = await import('./lib/scheduler/init')
    await initializeSchedulers()
  }
}
