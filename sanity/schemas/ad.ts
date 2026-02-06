export default {
  name: 'ad',
  title: 'Advertisement',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Campaign Title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'advertiser',
      title: 'Advertiser',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'type',
      title: 'Ad Type',
      type: 'string',
      options: {
        list: [
          { title: 'Newsletter Sponsor', value: 'newsletter' },
          { title: 'Sponsored Post', value: 'sponsored' },
          { title: 'Category Banner', value: 'banner' },
        ],
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'image',
      title: 'Ad Image/Banner',
      type: 'image',
    },
    {
      name: 'content',
      title: 'Ad Content',
      type: 'text',
    },
    {
      name: 'link',
      title: 'Landing Page URL',
      type: 'url',
    },
    {
      name: 'category',
      title: 'Target Category',
      type: 'string',
    },
    {
      name: 'startDate',
      title: 'Start Date',
      type: 'datetime',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'endDate',
      title: 'End Date',
      type: 'datetime',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'budget',
      title: 'Budget',
      type: 'number',
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Approved', value: 'approved' },
          { title: 'Active', value: 'active' },
          { title: 'Completed', value: 'completed' },
          { title: 'Rejected', value: 'rejected' },
        ],
      },
    },
  ],
}
