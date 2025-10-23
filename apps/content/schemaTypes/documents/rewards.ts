import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const rewards = defineType({
  name: 'rewards',
  type: 'document',
  title: 'Rewards',
  icon: StarIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Name',
      description: 'Internal name for this rewards collection',
      validation: (Rule) => Rule.required().error('Name is required'),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      description: 'URL-friendly identifier for this rewards collection',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
    }),
    defineField({
      name: 'items',
      title: 'Reward Items',
      type: 'array',
      description: 'Individual rewards in this collection',
      of: [{type: 'rewardItem'}],
      options: {
        sortable: true,
      },
    }),
  ],
  preview: {
    select: {
      title: 'name',
      items: 'items',
    },
    prepare({title, items}) {
      const itemCount = items?.length || 0
      return {
        title: title || 'Untitled Rewards',
        subtitle: `${itemCount} items`,
      }
    },
  },
})
