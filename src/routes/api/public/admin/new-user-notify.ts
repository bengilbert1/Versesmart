import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'

import { z } from 'zod'
import { NewUserSignupEmail } from '@/lib/email-templates/new-user-signup'

const ADMIN_RECIPIENT = 'gilbertbg@gmail.com'
const SITE_NAME = 'VerseSmart'
const SENDER_DOMAIN = 'notify.versesmart.org'
const FROM_DOMAIN = 'versesmart.org'

const PayloadSchema = z.object({
  user_id: z.string().min(1).max(128),
  email: z.string().email().max(320).nullable().optional(),
  provider: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  created_at: z.string().min(1).max(64),
})

export const Route = createFileRoute('/api/public/admin/new-user-notify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL

        if (!serviceRoleKey || !supabaseUrl) {
          console.error('new-user-notify: missing server env')
          return new Response('Server misconfigured', { status: 500 })
        }

        // Authorize via the same service-role bearer used by the queue worker.
        // The DB trigger fetches this from vault and sends it as Authorization: Bearer <key>.
        const auth = request.headers.get('authorization') ?? ''
        if (!auth.startsWith('Bearer ')) {
          return new Response('Unauthorized', { status: 401 })
        }
        const token = auth.slice('Bearer '.length).trim()
        if (token !== serviceRoleKey) {
          return new Response('Forbidden', { status: 403 })
        }

        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return new Response('Invalid JSON', { status: 400 })
        }

        const parsed = PayloadSchema.safeParse(raw)
        if (!parsed.success) {
          return new Response('Invalid payload', { status: 400 })
        }
        const { user_id, email, provider, created_at } = parsed.data

        const element = React.createElement(NewUserSignupEmail, {
          userId: user_id,
          email: email ?? null,
          provider,
          createdAt: created_at,
        })
        const html = await render(element)
        const text = await render(element, { plainText: true })

        const supabase = createClient(supabaseUrl, serviceRoleKey)
        const messageId = crypto.randomUUID()
        const templateName = 'admin-new-user-signup'

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: ADMIN_RECIPIENT,
          status: 'pending',
        })

        const subject = `New ${SITE_NAME} signup: ${email ?? user_id}`

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: ADMIN_RECIPIENT,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: templateName,
            idempotency_key: `admin-new-user-${user_id}`,
            queued_at: new Date().toISOString(),
          },
        })

        if (enqueueError) {
          console.error('new-user-notify: enqueue failed', { error: enqueueError })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: templateName,
            recipient_email: ADMIN_RECIPIENT,
            status: 'failed',
            error_message: 'Failed to enqueue admin notification',
          })
          return new Response('Failed to enqueue', { status: 500 })
        }

        return Response.json({ success: true, queued: true })
      },
    },
  },
})
