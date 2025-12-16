const { ImapFlow } = require('imapflow')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // 모든 테넌트 조회
  const tenants = await prisma.tenant.findMany()
  console.log('=== 등록된 테넌트 ===')
  for (const t of tenants) {
    console.log(`- ${t.id}: ${t.name}`)
  }

  // cd-op 테넌트 찾기
  const tenant = tenants.find(t => t.id === 'cmi6xb2ma0000le04jprqgfxd')
  if (!tenant) {
    console.log('테넌트가 없습니다')
    await prisma.$disconnect()
    return
  }

  console.log('\n선택된 테넌트:', tenant.id, tenant.name)

  // 해당 테넌트의 메일 서버 설정 조회
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: { startsWith: 'mailServer.' },
      tenantId: tenant.id
    }
  })

  const config: any = {}
  for (const c of configs) {
    const [, field] = c.key.split('.')
    try { config[field] = JSON.parse(c.value) }
    catch { config[field] = c.value }
  }

  if (!config.host) {
    console.log('메일 서버 설정이 없습니다')
    console.log('설정:', configs)
    await prisma.$disconnect()
    return
  }

  console.log('\n=== IMAP 직접 연결 테스트 ===')
  console.log('Host:', config.host)
  console.log('Port:', config.port)
  console.log('Username:', config.username)

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.useSSL !== false,
    auth: { user: config.username, pass: config.password },
    logger: false,
  })

  await client.connect()
  console.log('연결 성공!')

  const lock = await client.getMailboxLock('INBOX')

  // 12월 14일부터 검색 (더 넓은 범위)
  const since = new Date('2025-12-14T00:00:00Z')
  console.log('검색 시작일 (UTC):', since.toISOString())

  let count = 0
  let kyoboMails: any[] = []

  for await (const msg of client.fetch({ since }, {
    envelope: true,
    uid: true,
    internalDate: true
  })) {
    count++
    const from = msg.envelope?.from?.[0]?.address || ''
    const subject = msg.envelope?.subject || ''

    if (from.includes('kyobo') || subject.includes('교보')) {
      kyoboMails.push({
        uid: msg.uid,
        from,
        subject: subject.substring(0, 50),
        internalDate: msg.internalDate,
        envelopeDate: msg.envelope?.date,
      })
    }
  }

  console.log('\n총 메일 수:', count)
  console.log('\n=== 교보문고 메일 (IMAP에서 직접 조회) ===')

  for (const m of kyoboMails) {
    const intDateKST = m.internalDate
      ? new Date(m.internalDate.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
      : 'N/A'
    const envDateKST = m.envelopeDate
      ? new Date(m.envelopeDate.getTime() + 9*60*60*1000).toISOString().replace('T', ' ').slice(0,19)
      : 'N/A'
    console.log('UID:', m.uid)
    console.log('발신자:', m.from)
    console.log('제목:', m.subject)
    console.log('internalDate(KST):', intDateKST)
    console.log('envelope.date(KST):', envDateKST)
    console.log('---')
  }

  lock.release()
  await client.logout()
  await prisma.$disconnect()
}

main().catch(console.error)
