import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { pin } = await request.json()
    const correctPin = process.env.WOOZY_PIN || '0000'
    
    if (pin === correctPin) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false }, { status: 401 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
