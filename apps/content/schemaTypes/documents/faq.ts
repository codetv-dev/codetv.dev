import {defineField, defineType} from 'sanity'

export const faq = defineType({
  name: 'faq',
  type: 'document',
  title: 'FAQ',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Name',
      description: 'Internal name for this FAQ collection',
      validation: (Rule) => Rule.required().error('Name is required'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      description: 'URL-friendly identifier for this FAQ',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
    }),
    defineField({
      name: 'items',
      title: 'FAQ Items',
      type: 'array',
      description: 'Frequently Asked Questions (auto-generated or manually added for SEO)',
      of: [{type: 'faqItem'}],
      options: {
        sortable: true,
      },
    }),
  ],
  preview: {
    select: {
      title: 'name',
      itemCount: 'items.length',
    },
    prepare({title, itemCount}) {
      return {
        title: title || 'Untitled FAQ',
        subtitle: `${itemCount || 0} items`,
      }
    },
  },
})
