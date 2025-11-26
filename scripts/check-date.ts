import { getKSTStartOfDay } from '../lib/utils/date'

const today = getKSTStartOfDay()
console.log('KST 오늘 00:00 (UTC 표현):', today.toISOString())
console.log('IMAP since에 전달되는 날짜:', today.toDateString())
