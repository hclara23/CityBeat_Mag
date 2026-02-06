export default {
  name: 'brief',
  title: 'Brief',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
      },
    },
    {
      name: 'content',
      title: 'Content',
      type: 'text',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'contentEN',
      title: 'Content (English)',
      type: 'text',
    },
    {
      name: 'contentES',
      title: 'Content (Spanish)',
      type: 'text',
    },
    {
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          { title: 'News', value: 'news' },
          { title: 'Culture', value: 'culture' },
          { title: 'Events', value: 'events' },
          { title: 'Business', value: 'business' },
        ],
      },
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Pending Review', value: 'pending_review' },
          { title: 'Approved', value: 'approved' },
          { title: 'Rejected', value: 'rejected' },
          { title: 'Published', value: 'published' },
        ],
      },
      initialValue: 'draft',
      description: 'Workflow: Draft → Pending Review → (Approved or Rejected) → Published',
    },
    {
      name: 'approvalInfo',
      title: 'Approval Information',
      type: 'object',
      fields: [
        {
          name: 'reviewedBy',
          title: 'Reviewed By (Editor)',
          type: 'string',
          description: 'Name or ID of the editor who reviewed this brief',
        },
        {
          name: 'reviewedAt',
          title: 'Review Date',
          type: 'datetime',
          description: 'When the brief was reviewed',
        },
        {
          name: 'approvalNotes',
          title: 'Approval Notes',
          type: 'text',
          description: 'Notes from the editor (approval or rejection reason)',
        },
      ],
      hidden: ({ document }: any) => document?.status === 'draft' || !document?.status,
      description: 'Populated when an editor reviews the brief',
    },
    {
      name: 'source',
      title: 'Source',
      type: 'string',
    },
  ],
  preview: {
    select: {
      title: 'title',
      status: 'status',
      subtitle: 'category',
    },
    prepare(selection: any) {
      const { title, status, subtitle } = selection
      const statusLabels: Record<string, string> = {
        draft: '✏️ Draft',
        pending_review: '⏳ Pending Review',
        approved: '✅ Approved',
        rejected: '❌ Rejected',
        published: '🚀 Published',
      }
      return {
        title,
        subtitle: `${subtitle} • ${statusLabels[status] || status}`,
      }
    },
  },
}
