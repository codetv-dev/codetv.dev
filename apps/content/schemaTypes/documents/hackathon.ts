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
      name: 'deadline',
      type: 'datetime',
      title: 'Deadline',
      description: 'When this hackathon submission deadline is',
      options: {
        timeStep: 30,
      },
      validation: (Rule) => Rule.required().error('Deadline is required'),
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
      name: 'rewards',
      type: 'reference',
      title: 'Rewards',
      description: 'Rewards collection for this hackathon',
      to: [{type: 'rewards'}],
      options: {
        disableNew: true,
        filter: '_type == "rewards"',
      },
      initialValue: async (_props: any, {getClient}: any) => {
        const client = getClient({apiVersion: '2024-01-01'})
        const rewardsId = await client.fetch(
          '*[_type == "rewards" && slug.current == $slug][0]._id',
          {
            slug: 'hackathon-rewards',
          },
        )
        if (rewardsId) {
          return {_ref: rewardsId}
        }
        return {_ref: ''}
      },
      group: 'content',
    }),
    defineField({
      name: 'faq',
      type: 'reference',
      title: 'FAQ',
      description: 'FAQ collection for this hackathon',
      to: [{type: 'faq'}],
      options: {
        disableNew: true,
        filter: '_type == "faq"',
      },
      initialValue: async (_props: any, {getClient}: any) => {
        const client = getClient({apiVersion: '2024-01-01'})
        const faqId = await client.fetch('*[_type == "faq" && slug.current == $slug][0]._id', {
          slug: 'hackathon-faq',
        })
        if (faqId) {
          return {_ref: faqId}
        }
        return {_ref: ''}
      },
      group: 'content',
    }),
    defineField({
      name: 'sponsors',
      type: 'reference',
      title: 'Sponsors',
      description: 'Sponsors for this hackathon',
      to: [{type: 'sponsor'}],
      options: {
        disableNew: true,
        filter: '_type == "sponsor"',
      },
      group: 'content',
    }),
    defineField({
      name: 'rules',
      type: 'array',
      title: 'Rules',
      description: 'Hackathon rules and guidelines',
      of: [{type: 'ruleItem'}],
      options: {
        sortable: true,
      },
      group: 'content',
    }),
    defineField({
      name: 'resources',
      type: 'array',
      title: 'Resources',
      description: 'Helpful resources for hackathon participants',
      of: [{type: 'resourceItem'}],
      options: {
        sortable: true,
      },
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
