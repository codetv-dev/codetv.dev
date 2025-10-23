import {defineField, defineType} from 'sanity'
import {PlayIcon, UserIcon, TagIcon, ImageIcon, FolderIcon, StarIcon} from '@sanity/icons'
import {person} from './documents/person'
import {episode} from './documents/episode'
import {hackathon} from './documents/hackathon'
import {faq} from './documents/faq'
import {rewards} from './documents/rewards'
import {episodeTag} from './documents/tags'
import {episodeImage} from './objects/episode-image'
import faqItem from './objects/faq-item'
import rewardItem from './objects/reward-item'
import ruleItem from './objects/rule-item'
import resourceItem from './objects/resource-item'

function slugify(str: string) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-') // remove consecutive hyphens
}

export const slugField = defineField({
  title: 'Slug',
  name: 'slug',
  type: 'slug',
  options: {
    source: 'title',
    slugify,
    // TODO collection and episode slugs can duplicate as long as they have different parents
    isUnique: () => true,
  },
  validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
})

const series = defineType({
  type: 'document',
  name: 'series',
  title: 'Series',
  icon: FolderIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'publishing', title: 'Publishing'},
  ],
  fields: [
    defineField({
      title: 'Series Title',
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Series title is required'),
      group: 'content',
    }),
    slugField,
    defineField({
      title: 'Series Description',
      name: 'description',
      type: 'text',
      description: 'Brief description of the series',
      validation: (Rule) => Rule.required().error('Series description is required'),
      group: 'content',
    }),
    defineField({
      title: 'Series Image',
      name: 'image',
      type: 'cloudinary.asset',
      options: {hotspot: true},
      group: 'content',
    }),
    defineField({
      title: 'Collections',
      name: 'collections',
      type: 'array',
      description: 'Collections that belong to this series',
      of: [
        {
          type: 'reference',
          to: [{type: 'collection'}],
        },
      ],
      group: 'content',
    }),
    defineField({
      title: 'Sponsors',
      name: 'sponsors',
      type: 'array',
      description: 'Sponsors for this series',
      of: [
        {
          type: 'reference',
          to: [{type: 'sponsor'}],
        },
      ],
      group: 'content',
    }),
    defineField({
      title: 'Featured Status',
      name: 'featured',
      type: 'string',
      description: 'Control whether this series appears on the home page',
      options: {
        list: [
          {title: 'Normal', value: 'normal'},
          {title: 'Featured', value: 'featured'},
        ],
        layout: 'radio',
      },
      initialValue: 'normal',
      group: 'publishing',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      description: 'description',
      collections: 'collections',
      featured: 'featured',
    },
    prepare({title, description, collections, featured}) {
      const collectionCount = collections?.length || 0
      const status = featured === 'featured' ? ' (Featured)' : ''

      return {
        title: title || 'Untitled Series',
        subtitle: `${collectionCount} collections${status}`,
        media: FolderIcon,
      }
    },
  },
  initialValue: () => ({
    featured: 'normal',
  }),
})

const collection = defineType({
  type: 'document',
  name: 'collection',
  title: 'Collection',
  icon: FolderIcon,
  groups: [
    {name: 'details', title: 'Details'},
    {name: 'content', title: 'Content', default: true},
  ],
  fields: [
    defineField({
      title: 'Collection Title',
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Collection title is required'),
      group: 'details',
    }),
    slugField,
    defineField({
      type: 'date',
      name: 'release_year',
      title: 'Release Year',
      description: 'When this collection was released',
      validation: (Rule) => Rule.required().error('Release year is required'),
      group: 'details',
    }),
    defineField({
      title: 'Series',
      name: 'series',
      type: 'reference',
      to: {type: 'series'},
      validation: (Rule) => Rule.required().error('Series is required'),
      group: 'content',
    }),
    defineField({
      title: 'Episodes',
      name: 'episodes',
      type: 'array',
      description: 'Episodes that belong to this collection',
      of: [
        {
          type: 'reference',
          to: [{type: 'episode'}],
        },
      ],
      group: 'content',
    }),
  ],
  preview: {
    select: {
      series_title: 'series.title',
      title: 'title',
      year: 'release_year',
      episodes: 'episodes',
    },
    prepare({series_title, title, year, episodes}) {
      const episodeCount = episodes?.length ?? 0

      return {
        title: `${series_title}: ${title}`,
        subtitle: `Released ${new Date(year).getFullYear()} · ${episodeCount} episodes`,
        media: FolderIcon,
      }
    },
  },
})

const sponsor = defineType({
  type: 'document',
  name: 'sponsor',
  title: 'Sponsor',
  fields: [
    defineField({
      title: 'Sponsor Name',
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Sponsor name is required'),
    }),
    slugField,
    defineField({
      title: 'Logo',
      name: 'logo',
      type: 'cloudinary.asset',
      options: {hotspot: true},
      validation: (Rule) => Rule.required().error('Sponsor logo is required'),
    }),
    defineField({
      title: 'Link',
      name: 'link',
      type: 'string',
      description: "URL to the sponsor's website",
      validation: (Rule) => Rule.required().error('Sponsor link is required'),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      logo: 'logo',
    },
    prepare({title, logo}) {
      let url
      if (logo && logo.public_id) {
        console.log(logo.public_id)
        url = new URL('https://res.cloudinary.com')
        url.pathname = [
          'jlengstorf',
          'image',
          logo.type,
          'b_black,ar_1,g_auto,c_auto_pad,w_100',
          'v' + logo.version,
          logo.public_id,
        ].join('/')
      } else {
        url = new URL(
          'https://res.cloudinary.com/jlengstorf/image/upload/t_thumb400/w_99/v1743473132/placeholder.jpg',
        )
      }

      return {
        title: title || 'Untitled Sponsor',
        imageUrl: url.toString(),
      }
    },
  },
})

export const schemaTypes = [
  series,
  collection,
  episode,
  hackathon,
  faq,
  rewards,
  person,
  sponsor,
  episodeTag,
  episodeImage,
  faqItem,
  rewardItem,
  ruleItem,
  resourceItem,
]
