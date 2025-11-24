
import { DeliveryCalculator } from '../lib/utils/delivery-calculator'

// Mock Data
const mockRule1Cutoff = {
  region: 'Region1',
  cutoffTime: '14:00',
  beforeCutoffDays: 1,
  afterCutoffDays: 2,
  beforeCutoffDeliveryTime: '오전',
  afterCutoffDeliveryTime: '오후',
  workingDays: ['1', '2', '3', '4', '5'],
  customClosedDates: [],
  excludeHolidays: true,
  isActive: true,
  tenantId: 'test-tenant',
  cutoffCount: 1,
  id: 'rule-1'
}

const mockRule2Cutoff = {
  region: 'Region2',
  cutoffTime: '10:00',
  beforeCutoffDays: 1, // Before 10:00 -> +1 day
  afterCutoffDays: 2,  // 10:00 ~ 15:00 -> +2 days
  beforeCutoffDeliveryTime: '오전',
  afterCutoffDeliveryTime: '오후',
  
  cutoffCount: 2,
  secondCutoffTime: '15:00',
  afterSecondCutoffDays: 3, // After 15:00 -> +3 days
  afterSecondCutoffDeliveryTime: '저녁',
  
  workingDays: ['1', '2', '3', '4', '5'],
  customClosedDates: [],
  excludeHolidays: true,
  isActive: true,
  tenantId: 'test-tenant',
  id: 'rule-2'
}

async function runTest() {
  console.log('🚀 Starting Multi-Cutoff Verification')
  
  const calculator = new DeliveryCalculator()
  
  // Mock getDeliveryRule
  // @ts-ignore
  calculator.getDeliveryRule = async (region) => {
    if (region === 'Region1') return mockRule1Cutoff
    if (region === 'Region2') return mockRule2Cutoff
    return null
  }
  
  // Mock isHoliday
  // @ts-ignore
  calculator.isHoliday = async () => false

  // Test 1: 1 Cutoff Rule (Regression Test)
  console.log('\n📋 Test 1: 1 Cutoff Rule (Regression)')
  const date1 = new Date('2023-11-20T09:00:00+09:00') // Mon 09:00 (Before 14:00)
  const res1 = await calculator.calculateDeliveryDate({
    region: 'Region1',
    orderDateTime: date1,
    tenantId: 'test-tenant'
  })
  console.log(`   Before Cutoff: ${res1.businessDaysUsed} days (Expected: 1) -> ${res1.businessDaysUsed === 1 ? '✅' : '❌'}`)

  const date2 = new Date('2023-11-20T15:00:00+09:00') // Mon 15:00 (After 14:00)
  const res2 = await calculator.calculateDeliveryDate({
    region: 'Region1',
    orderDateTime: date2,
    tenantId: 'test-tenant'
  })
  console.log(`   After Cutoff: ${res2.businessDaysUsed} days (Expected: 2) -> ${res2.businessDaysUsed === 2 ? '✅' : '❌'}`)


  // Test 2: 2 Cutoff Rule (New Feature)
  console.log('\n📋 Test 2: 2 Cutoff Rule (10:00 / 15:00)')
  
  // Case A: Before 1st Cutoff (09:00)
  const dateA = new Date('2023-11-20T09:00:00+09:00')
  const resA = await calculator.calculateDeliveryDate({
    region: 'Region2',
    orderDateTime: dateA,
    tenantId: 'test-tenant'
  })
  console.log(`   Before 1st (09:00): ${resA.businessDaysUsed} days (Expected: 1) -> ${resA.businessDaysUsed === 1 ? '✅' : '❌'}`)

  // Case B: Between 1st and 2nd (12:00)
  const dateB = new Date('2023-11-20T12:00:00+09:00')
  const resB = await calculator.calculateDeliveryDate({
    region: 'Region2',
    orderDateTime: dateB,
    tenantId: 'test-tenant'
  })
  console.log(`   Between (12:00): ${resB.businessDaysUsed} days (Expected: 2) -> ${resB.businessDaysUsed === 2 ? '✅' : '❌'}`)

  // Case C: After 2nd Cutoff (16:00)
  const dateC = new Date('2023-11-20T16:00:00+09:00')
  const resC = await calculator.calculateDeliveryDate({
    region: 'Region2',
    orderDateTime: dateC,
    tenantId: 'test-tenant'
  })
  console.log(`   After 2nd (16:00): ${resC.businessDaysUsed} days (Expected: 3) -> ${resC.businessDaysUsed === 3 ? '✅' : '❌'}`)
  console.log(`   Delivery Time: ${resC.deliveryTime} (Expected: 저녁) -> ${resC.deliveryTime === '저녁' ? '✅' : '❌'}`)
}

runTest().catch(console.error)
