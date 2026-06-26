import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface NewUserSignupEmailProps {
  userId: string
  email: string | null
  provider: string
  createdAt: string
}

export const NewUserSignupEmail = ({
  userId,
  email,
  provider,
  createdAt,
}: NewUserSignupEmailProps) => {
  const when = new Date(createdAt)
  const human = isNaN(when.getTime())
    ? createdAt
    : when.toUTCString()

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New VerseSmart signup: {email ?? userId}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New VerseSmart signup</Heading>
          <Text style={text}>A new account was just created.</Text>

          <Section style={card}>
            <Row label="Email" value={email ?? '(not provided)'} />
            <Row label="User ID" value={userId} mono />
            <Row label="Signup method" value={provider} />
            <Row label="Timestamp (UTC)" value={human} />
            <Row label="ISO" value={createdAt} mono />
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Automated notification from VerseSmart.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <Text style={row}>
    <span style={rowLabel}>{label}: </span>
    <span style={mono ? rowValueMono : rowValue}>{value}</span>
  </Text>
)

export default NewUserSignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 16px',
}
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const card = {
  backgroundColor: '#f6f7f9',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 20px',
}
const row = { fontSize: '14px', color: '#1a1a1a', margin: '0 0 8px', lineHeight: '1.5' }
const rowLabel = { color: '#666', fontWeight: 600 as const }
const rowValue = { color: '#1a1a1a' }
const rowValueMono = {
  color: '#1a1a1a',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '13px',
}
const hr = { borderColor: '#e6e8eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: 0 }
