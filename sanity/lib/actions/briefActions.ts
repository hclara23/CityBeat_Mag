import { DocumentActionDescription } from 'sanity'

/**
 * Custom document actions for brief approval workflow
 * Allows editors to approve or reject pending review briefs
 */

export const createBriefActions =
  (publish: DocumentActionDescription, unpublish: DocumentActionDescription | undefined) =>
  (props: any): DocumentActionDescription[] => {
    const { draft, published } = props
    const currentDoc = draft || published
    const status = currentDoc?.status

    // Default actions
    const actions: DocumentActionDescription[] = [publish]

    // Add custom approval action for editors
    if (status === 'pending_review') {
      actions.push({
        label: 'Approve Brief',
        icon: CheckIcon,
        onHandle: async () => {
          const now = new Date().toISOString()
          const userId = props.currentUser?.id || 'unknown'
          const userName = props.currentUser?.name || 'Editor'

          // Update the brief with approval info and approved status
          await props.patch([
            {
              set: {
                status: 'approved',
                'approvalInfo.reviewedBy': userName,
                'approvalInfo.reviewedAt': now,
              },
            },
          ])

          // Optionally show a toast notification
          console.log(`Brief approved by ${userName}`)
        },
        tone: 'positive',
      } as DocumentActionDescription)

      actions.push({
        label: 'Reject Brief',
        icon: CloseIcon,
        onHandle: async () => {
          const rejectionReason = prompt(
            'Please provide a reason for rejection:',
            'Content needs revision'
          )

          if (rejectionReason === null) {
            return // User cancelled
          }

          const now = new Date().toISOString()
          const userName = props.currentUser?.name || 'Editor'

          // Update the brief with rejection info
          await props.patch([
            {
              set: {
                status: 'rejected',
                'approvalInfo.reviewedBy': userName,
                'approvalInfo.reviewedAt': now,
                'approvalInfo.approvalNotes': rejectionReason,
              },
            },
          ])

          console.log(`Brief rejected by ${userName}: ${rejectionReason}`)
        },
        tone: 'critical',
      } as DocumentActionDescription)
    }

    // Allow editors to reset to pending review if rejected or approved
    if (status === 'approved' || status === 'rejected') {
      actions.push({
        label: 'Return to Draft',
        icon: ResetIcon,
        onHandle: async () => {
          await props.patch([
            {
              set: {
                status: 'draft',
                'approvalInfo.reviewedBy': null,
                'approvalInfo.reviewedAt': null,
                'approvalInfo.approvalNotes': null,
              },
            },
          ])

          console.log('Brief reset to draft')
        },
        tone: 'default',
      } as DocumentActionDescription)
    }

    // Only show publish if approved
    if (status === 'approved') {
      // Publish action is already in the array
    } else if (status !== 'published') {
      // Remove publish action if not approved
      const publishIndex = actions.findIndex(
        (action) => action.action === 'publish' || action.label?.includes('Publish')
      )
      if (publishIndex > -1) {
        actions.splice(publishIndex, 1)
      }
    }

    // Add unpublish action if already published
    if (status === 'published' && unpublish) {
      actions.push(unpublish)
    }

    return actions
  }

// Simple icon components
const CheckIcon = () => '✓'
const CloseIcon = () => '✕'
const ResetIcon = () => '↻'
