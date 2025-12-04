const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// HTML 태그 제거 함수
function extractTextFromHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const email = await prisma.emailLog.findUnique({
    where: { id: 'cmir6bxpa000dow0c052ic3bq' },
    select: { body: true, bodyHtml: true, subject: true }
  });

  const subject = email?.subject || '';
  const rawBody = (email?.body || '') + (email?.bodyHtml || '');
  const cleanBody = extractTextFromHtml(rawBody);

  // 한글 키워드 (includes)
  const koreanKeywords = ['발주', '주문', '구매', '납품'];
  // 영어 키워드 (단어 경계)
  const englishKeywords = ['order', 'purchase', 'po'];

  console.log('=== 수정된 로직 테스트 ===');
  console.log('제목:', subject);
  console.log('');

  console.log('--- 한글 키워드 (includes) ---');
  koreanKeywords.forEach(keyword => {
    const inSubject = subject.includes(keyword);
    const inBody = cleanBody.includes(keyword);
    if (inSubject || inBody) {
      console.log(`  ${keyword}: 매칭됨 (제목:${inSubject}, 본문:${inBody})`);
    }
  });

  console.log('');
  console.log('--- 영어 키워드 (단어 경계 정규식) ---');
  englishKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    const inSubject = regex.test(subject);
    const inBody = regex.test(cleanBody);
    if (inSubject || inBody) {
      console.log(`  ${keyword}: 매칭됨 (제목:${inSubject}, 본문:${inBody})`);
    } else {
      console.log(`  ${keyword}: 매칭 안됨`);
    }
  });

  // border 테스트
  console.log('');
  console.log('--- border 테스트 ---');
  console.log('원본에 border 포함?:', rawBody.includes('border'));
  console.log('정규식 /\\border\\b/ 테스트:', /\border\b/i.test(rawBody));
  console.log('정규식 /\\border\\b/ cleanBody 테스트:', /\border\b/i.test(cleanBody));
}

main().catch(console.error).finally(() => prisma.$disconnect());
