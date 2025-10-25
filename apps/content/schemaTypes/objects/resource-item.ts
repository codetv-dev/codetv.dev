import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'resourceItem',
  title: 'Resource Item',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().min(3).max(100),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      validation: (Rule) => Rule.required().min(10).max(500),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (Rule) => Rule.required().error('URL is required'),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
      url: 'url',
    },
    prepare(selection) {
      const {title, subtitle, url} = selection
      return {
        title,
        subtitle: subtitle ? `${subtitle.substring(0, 60)}...` : '',
        url: url ? new URL(url).hostname : 'No URL',
      }
    },
  },
})
