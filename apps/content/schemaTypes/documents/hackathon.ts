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
      name: 'hero_image',
      type: 'cloudinary.asset',
      title: 'Hero Image',
      description: 'Large hero image displayed at the top of the hackathon page',
      options: {hotspot: true},
      group: 'content',
    }),
    defineField({
      name: 'hero_title',
      type: 'string',
      title: 'Hero Title',
      description:
        'Optional custom title for the hero section (defaults to hackathon title if not provided)',
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
      name: 'submissionForm',
      type: 'url',
      title: 'Submission Form',
      description: 'URL to the submission form for this hackathon',
      validation: (Rule) =>
        Rule.required()
          .uri({scheme: ['http', 'https']})
          .error('Submission form must be a valid URL'),
      group: 'content',
    }),
    defineField({
      name: 'rewards',
      type: 'array',
      title: 'Rewards',
      description: 'Rewards collection for this hackathon',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'rewards'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      initialValue: async (_props: any, {getClient}: any) => {
        const client = getClient({apiVersion: '2024-01-01'})
        const defaultRewards = await client.fetch(
          '*[_type == "rewards" && setAsDefault == true] | order(weight asc) { _id }',
        )
        return defaultRewards.map((reward: {_id: string}) => ({
          _type: 'reference',
          _ref: reward._id,
          _key: reward._id,
        }))
      },
      group: 'content',
    }),
    defineField({
      name: 'faq',
      type: 'array',
      title: 'FAQ',
      description: 'FAQ collection for this hackathon',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'faq'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      initialValue: async (_props: any, {getClient}: any) => {
        const client = getClient({apiVersion: '2024-01-01'})
        const defaultFaqs = await client.fetch(
          '*[_type == "faq" && setAsDefault == true] | order(weight asc) { _id }',
        )
        return defaultFaqs.map((faq: {_id: string}) => ({
          _type: 'reference',
          _ref: faq._id,
          _key: faq._id,
        }))
      },
      group: 'content',
    }),
    defineField({
      name: 'sponsors',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'sponsor'}]})],
      group: 'content',
    }),
    defineField({
      name: 'rules',
      type: 'array',
      title: 'Rules',
      description: 'Rules collection for this hackathon',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'rules'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      initialValue: async (_props: any, {getClient}: any) => {
        const client = getClient({apiVersion: '2024-01-01'})
        const defaultRules = await client.fetch(
          '*[_type == "rules" && setAsDefault == true] | order(weight asc) { _id }',
        )
        return defaultRules.map((rule: {_id: string}) => ({
          _type: 'reference',
          _ref: rule._id,
          _key: rule._id,
        }))
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
  ],
  preview: {
    select: {
      title: 'title',
      pubDate: 'pubDate',
      hidden: 'hidden',
    },
    prepare({title, pubDate, hidden}) {
      const date = pubDate ? new Date(pubDate).toLocaleDateString() : 'No date'
      const status = hidden === 'hidden' ? ' (Hidden)' : ''

      return {
        title: title || 'Untitled Hackathon',
        subtitle: `${date}${status}`,
        media: RocketIcon,
      }
    },
  },
  initialValue: () => ({
    hidden: 'visible',
  }),
})
