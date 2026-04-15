export default {
  name: 'article',
  title: 'Article',
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
      name: 'author',
      title: 'Author Name',
      type: 'string',
    },
    {
      name: 'authorEmail',
      title: 'Author Email',
      type: 'string',
      description: 'Contact email for the author/contributor (not shown publicly)',
    },
    {
      name: 'isContribution',
      title: 'Community Contribution',
      type: 'boolean',
      description: 'True if this was submitted via the public contribution form',
      initialValue: false,
    },
    {
      name: 'submittedAt',
      title: 'Submitted At',
      type: 'datetime',
      description: 'When the community contribution was submitted',
    },
    {
      name: 'image',
      title: 'Featured Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    },
    {
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
    },
    {
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image' },
      ],
    },
    {
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      validation: (Rule: any) => Rule.required(),
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
    },
  ],
  preview: {
    select: {
      title: 'title',
      status: 'status',
      isContribution: 'isContribution',
      subtitle: 'author',
    },
    prepare(selection: any) {
      const { title, status, isContribution, subtitle } = selection
      const statusLabels: Record<string, string> = {
        draft: '✏️ Draft',
        pending_review: '⏳ Review',
        approved: '✅ Approved',
        rejected: '❌ Rejected',
        published: '🚀 Published',
      }
      const prefix = isContribution ? '👥 ' : ''
      return {
        title: `${prefix}${title}`,
        subtitle: `${subtitle || 'Unknown'} · ${statusLabels[status] || status}`,
      }
    },
  },
}
