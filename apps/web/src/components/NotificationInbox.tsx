'use client'

import { Inbox } from '@novu/nextjs'

// Novu in-app notification inbox (bell + unread badge + popover). Dormant (renders
// nothing) until NEXT_PUBLIC_NOVU_APP_ID is set and a user is signed in.
export function NotificationInbox({ subscriberId }: { subscriberId?: string | null }) {
  const appId = process.env.NEXT_PUBLIC_NOVU_APP_ID
  if (!appId || !subscriberId) return null
  return (
    <Inbox
      applicationIdentifier={appId}
      subscriberId={subscriberId}
      appearance={{ variables: { colorBackground: '#0b0f14', colorForeground: '#ffffff' } }}
    />
  )
}
