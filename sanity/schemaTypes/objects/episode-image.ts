import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons'

export const episodeImage = defineType({
  name: 'episodeImage',
  type: 'image',
  title: 'Episode Image',
  icon: ImageIcon,
  options: {
    hotspot: true,
  },
  fields: [
    defineField({
      name: 'alt',
      type: 'string',
      title: 'Alternative Text',
      description: 'Important for SEO and accessibility. Describe what the image shows.',
      validation: (Rule) => Rule.required().error('Alt text is required for accessibility'),
    }),
    defineField({
      name: 'caption',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      imageUrl: 'asset.url',
      title: 'alt',
      caption: 'caption',
    },
    prepare({imageUrl, title, caption}) {
      return {
        title: title || 'Untitled Image',
        subtitle: caption || 'No caption',
        media: ImageIcon,
        imageUrl,
      }
    },
  },
})
