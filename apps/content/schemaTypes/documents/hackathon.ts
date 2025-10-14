import {defineArrayMember, defineField, defineType} from 'sanity'
import {RocketIcon, PlayIcon} from '@sanity/icons'

export const hackathon = defineType({
  name: 'hackathon',
  type: 'document',
  title: 'Hackathon',
  icon: RocketIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'seo', title: 'SEO & Publishing'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Hackathon title is required'),
      group: 'content',
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      description: 'URL-friendly identifier for this hackathon',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
      group: 'content',
    }),
    defineField({
      name: 'pubDate',
      type: 'datetime',
      title: 'Publish Date',
      description: 'When this hackathon announcement should be published',
      options: {
        timeStep: 30,
      },
      validation: (Rule) => Rule.required().error('Publish date is required'),
      group: 'content',
    }),
    defineField({
      name: 'description',
      type: 'text',
      description: 'Brief overview for previews and SEO',
      validation: (Rule) => Rule.required().error('Description is required for SEO'),
      group: 'content',
    }),
    defineField({
      name: 'body',
      type: 'markdown',
      description: 'Full hackathon details, rules, and content',
      validation: (Rule) => Rule.required().error('Body content is required'),
      group: 'content',
    }),
    defineField({
      name: 'episodes',
      type: 'array',
      title: 'Related Episodes',
      description: 'Episodes associated with this hackathon',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'episode'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      group: 'content',
    }),
    defineField({
      name: 'share_image',
      type: 'cloudinary.asset',
      title: 'Share Image',
      description: 'Image for social media sharing',
      options: {hotspot: true},
      validation: (Rule) => Rule.required().error('Share image is required for social media'),
      group: 'seo',
    }),
    defineField({
      name: 'hidden',
      type: 'string',
      description: 'Control whether this hackathon appears on the website',
      options: {
        list: [
          {title: 'Visible', value: 'visible'},
          {title: 'Hidden', value: 'hidden'},
        ],
        layout: 'radio',
      },
      initialValue: 'visible',
      group: 'seo',
    }),
    defineField({
      name: 'featured',
      type: 'string',
      options: {
        list: [
          {title: 'Normal', value: 'normal'},
          {title: 'Featured', value: 'featured'},
        ],
        layout: 'radio',
      },
      initialValue: 'normal',
      group: 'seo',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      pubDate: 'pubDate',
      hidden: 'hidden',
      featured: 'featured',
    },
    prepare({title, pubDate, hidden, featured}) {
      const date = pubDate ? new Date(pubDate).toLocaleDateString() : 'No date'
      const status = hidden === 'hidden' ? ' (Hidden)' : ''
      const featuredStatus = featured === 'featured' ? ' ⭐' : ''

      return {
        title: title || 'Untitled Hackathon',
        subtitle: `${date}${status}${featuredStatus}`,
        media: RocketIcon,
      }
    },
  },
  initialValue: () => ({
    hidden: 'visible',
    featured: 'normal',
  }),
})
