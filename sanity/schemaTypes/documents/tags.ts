import {defineField, defineType} from 'sanity'
import {TagIcon} from '@sanity/icons'

export const episodeTag = defineType({
  name: 'episodeTag',
  type: 'document',
  title: 'Episode Tag',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'label',
      type: 'string',
      description: 'Display name for this tag',
      validation: (Rule) => Rule.required().error('Tag label is required'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {
        source: 'label',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
    }),
    defineField({
      name: 'description',
      type: 'text',
      validation: (Rule) => Rule.max(200).warning('Keep descriptions under 200 characters'),
    }),
  ],
  preview: {
    select: {
      title: 'label',
      description: 'description',
    },
    prepare({title, description}) {
      return {
        title: title || 'Untitled Tag',
        subtitle: description || 'No description',
        media: TagIcon,
      }
    },
  },
})
