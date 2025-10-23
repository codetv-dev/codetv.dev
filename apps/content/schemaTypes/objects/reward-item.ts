import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'rewardItem',
  title: 'Reward Item',
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
      name: 'image',
      title: 'Image',
      type: 'cloudinary.asset',
      options: {hotspot: true},
      validation: (Rule) => Rule.required().error('Image is required'),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'description',
      media: 'image',
    },
    prepare(selection) {
      const {title, subtitle} = selection
      return {
        title,
        subtitle: subtitle ? `${subtitle.substring(0, 60)}...` : '',
      }
    },
  },
})
