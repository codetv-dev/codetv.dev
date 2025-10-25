import {ListIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const rules = defineType({
  name: 'rules',
  title: 'Rules',
  type: 'document',
  icon: ListIcon,
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
      name: 'weight',
      title: 'Weight',
      type: 'number',
      description: 'Used to determine the order of rules (lower numbers appear first)',
      validation: (Rule) => Rule.required().integer().min(0),
      initialValue: 0,
    }),
    defineField({
      name: 'setAsDefault',
      title: 'Set as Default',
      type: 'boolean',
      description: 'Check this to use this rule as a default for all new hackathons created',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
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
