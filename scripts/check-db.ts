
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Connecting to database...')
    await prisma.$connect()
    console.log('Connected successfully!')
    const count = await prisma.company.count()
    console.log(`Company count: ${count}`)
  } catch (e) {
    console.error('Connection failed:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
