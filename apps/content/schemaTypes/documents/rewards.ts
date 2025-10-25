import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const rewards = defineType({
  name: 'rewards',
  title: 'Rewards',
  type: 'document',
  icon: StarIcon,
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
      name: 'image',
      title: 'Image',
      type: 'cloudinary.asset',
      options: {hotspot: true},
      validation: (Rule) => Rule.required().error('Image is required'),
    }),
    defineField({
      name: 'weight',
      title: 'Weight',
      type: 'number',
      description: 'Used to determine the order of rewards (lower numbers appear first)',
      validation: (Rule) => Rule.required().integer().min(0),
      initialValue: 0,
    }),
    defineField({
      name: 'setAsDefault',
      title: 'Set as Default',
      type: 'boolean',
      description: 'Check this to use this reward as a default for all new hackathons created',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
      media: 'image',
      defaultSetting: 'setAsDefault',
    },
    prepare(selection) {
      const {title, subtitle, defaultSetting} = selection
      const defaultStatus = defaultSetting ? '(Default)' : ''
      return {
        title: `${defaultStatus} ${title}`,
        subtitle: subtitle ? `${subtitle.substring(0, 60)}...` : '',
      }
    },
  },
})
