import { ImapFlow } from 'imapflow'

async function checkLatest() {
  const client = new ImapFlow({
    host: 'imap.daum.net',
    port: 993,
    secure: true,
    auth: {
      user: process.env.DAUM_MAIL_USER!,
      pass: process.env.DAUM_MAIL_PASS!,
    },
    logger: false,
  })

  await client.connect()
  console.log('IMAP 연결 성공')

  const lock = await client.getMailboxLock('INBOX')

  try {
    // 최근 3일 검색
    const since = new Date()
    since.setDate(since.getDate() - 3)

    console.log('\n=== IMAP SINCE 검색 ===')
    console.log('since:', since.toISOString())

    const searchedUids = await client.search({ since }, { uid: true })
    console.log('검색된 UID 개수:', searchedUids.length)
    console.log('검색된 UID 목록:', searchedUids.slice(-20)) // 마지막 20개만

    // 최신 10개 메일 헤더 확인
    if (searchedUids.length > 0) {
      const latestUids = searchedUids.slice(-10)
      console.log('\n=== 최신 10개 메일 ===')

      for await (const msg of client.fetch(latestUids, {
        envelope: true,
        uid: true,
        internalDate: true,
      })) {
        const from = msg.envelope?.from?.[0]?.address || 'unknown'
        const subject = msg.envelope?.subject?.substring(0, 40) || 'N/A'
        const date = msg.internalDate?.toISOString() || 'N/A'
        console.log(`UID:${msg.uid} | ${date} | ${from} | ${subject}`)
      }
    }

    // 전체 메일함의 마지막 UID 확인
    console.log('\n=== INBOX 상태 ===')
    const mailbox = client.mailbox
    console.log('총 메일 수:', mailbox?.exists)
    console.log('UIDNEXT:', mailbox?.uidNext)

  } finally {
    lock.release()
    await client.logout()
  }
}

checkLatest().catch(console.error)
