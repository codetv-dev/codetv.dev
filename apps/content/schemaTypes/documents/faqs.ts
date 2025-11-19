import {HelpCircleIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const faq = defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'document',
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      validation: (Rule) => Rule.required().min(10).max(200),
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'text',
      validation: (Rule) => Rule.required().min(20).max(1000),
    }),
    defineField({
      name: 'weight',
      title: 'Weight',
      type: 'number',
      description: 'Used to determine the order of FAQs (lower numbers appear first)',
      validation: (Rule) => Rule.required().integer().min(0),
      initialValue: 0,
    }),
    defineField({
      name: 'setAsDefault',
      title: 'Set as Default',
      type: 'boolean',
      description: 'Check this to use this FAQ as a default for all new hackathons created',
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: 'question',
      subtitle: 'answer',
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
