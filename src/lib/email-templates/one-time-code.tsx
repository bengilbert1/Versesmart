import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface OneTimeCodeEmailProps {
  siteName: string
  token?: string
}

/**
 * One-time code email. Renders the 6-digit OTP as plain text so Gmail/iOS/
 * Outlook can auto-detect it and offer one-tap autofill. No links are used.
 */
export const OneTimeCodeEmail = ({ siteName, token }: OneTimeCodeEmailProps) => {
  // Normalise to exactly 6 digits — Supabase always emits a 6-digit numeric
  // OTP for the email channel, but we guard defensively so a malformed token
  // never lands in the inbox.
  const raw = (token ?? '').replace(/\D/g, '')
  const code = raw.slice(0, 6).padStart(6, '0')

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${code} is your ${siteName} one-time code`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your one-time code</Heading>
          <Text style={text}>
            Enter this 6-digit code in {siteName} to finish signing in. The
            code expires in 5 minutes.
          </Text>
          <Text style={codeStyle}>{code}</Text>
          <Text style={footer}>
            If you didn&apos;t request this code, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default OneTimeCodeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const codeStyle = {
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#000000',
  letterSpacing: '8px',
  fontFamily: 'monospace',
  margin: '20px 0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
