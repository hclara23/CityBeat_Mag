export default {
  name: 'translation',
  title: 'Translation',
  type: 'document',
  fields: [
    {
      name: 'briefId',
      title: 'Brief ID',
      type: 'reference',
      to: [{ type: 'brief' }],
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'originalLanguage',
      title: 'Original Language',
      type: 'string',
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Spanish', value: 'es' },
        ],
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'targetLanguage',
      title: 'Target Language',
      type: 'string',
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Spanish', value: 'es' },
        ],
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'originalText',
      title: 'Original Text',
      type: 'text',
    },
    {
      name: 'translatedText',
      title: 'Translated Text',
      type: 'text',
    },
    {
      name: 'translationMethod',
      title: 'Translation Method',
      type: 'string',
      options: {
        list: [
          { title: 'DeepL API', value: 'deepl' },
          { title: 'Manual', value: 'manual' },
        ],
      },
    },
    {
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Pending', value: 'pending' },
          { title: 'Completed', value: 'completed' },
          { title: 'Review', value: 'review' },
        ],
      },
    },
    {
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
    },
  ],
}
