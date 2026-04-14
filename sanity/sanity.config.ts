import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'

// Helper function to check if user is an editor
const isEditor = (user: any): boolean => {
  return user?.roles?.some((role: any) => ['editor', 'admin'].includes(role.name))
}

export default defineConfig({
  name: 'default',
  title: 'CityBeat',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || '',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || 'production',
  basePath: '/studio',
  plugins: [
    structureTool({
      structure: (S: any) =>
        S.list()
          .title('Content')
          .items([
            S.documentTypeListItem('brief')
              .title('Briefs')
              .child(
                S.documentList()
                  .title('Briefs')
                  .filter('_type == "brief"')
                  .defaultOrdering([{ field: '_createdAt', direction: 'desc' }])
              ),
            S.divider(),
            S.documentTypeListItem('article').title('Articles'),
            S.documentTypeListItem('category').title('Categories'),
            S.documentTypeListItem('ad').title('Advertisements'),
            S.documentTypeListItem('translation').title('Translations'),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    // Control which document actions are available based on user role and document status
    actions: (input: any, { schemaType, currentUser, value }: any) => {
      // Only apply special handling to briefs
      if (schemaType !== 'brief') {
        return input
      }

      const status = value?.status
      const userIsEditor = isEditor(currentUser)

      // Filter actions based on workflow status
      const filteredActions = input.filter((action: any) => {
        const actionId = action.action

        // Only editors can publish or unpublish
        if ((actionId === 'publish' || actionId === 'unpublish') && !userIsEditor) {
          return false
        }

        // Can only publish if status is 'approved'
        if (actionId === 'publish' && status !== 'approved') {
          return false
        }

        // Everyone can save
        if (actionId === 'save') {
          return true
        }

        return true
      })

      // Add custom approval action for editors when brief is pending review
      if (userIsEditor && status === 'pending_review') {
        filteredActions.push({
          label: 'Approve & Publish',
          icon: CheckIcon,
          action: (prev: any) => {
            const now = new Date().toISOString()
            const userName = currentUser?.name || 'Editor'
            return {
              ...prev,
              set: {
                status: 'approved',
                publishedAt: now,
                'approvalInfo.reviewedBy': userName,
                'approvalInfo.reviewedAt': now,
              },
            }
          },
          shortcut: 'mod+alt+p',
        })

        filteredActions.push({
          label: 'Reject',
          icon: CloseIcon,
          tone: 'critical',
          action: (prev: any) => {
            const rejectionReason = prompt(
              'Please provide feedback for the writer:',
              'This brief needs revision.'
            )

            if (rejectionReason === null) return prev

            const now = new Date().toISOString()
            const userName = currentUser?.name || 'Editor'

            return {
              ...prev,
              set: {
                status: 'rejected',
                'approvalInfo.reviewedBy': userName,
                'approvalInfo.reviewedAt': now,
                'approvalInfo.approvalNotes': rejectionReason,
              },
            }
          },
        })
      }

      return filteredActions
    },
  },
})

// Simple icon components for custom actions
const CheckIcon = () => '✓'
const CloseIcon = () => '✕'
