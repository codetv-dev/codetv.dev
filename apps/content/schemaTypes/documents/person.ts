import {defineArrayMember, defineField, defineType} from 'sanity'
import {LinkIcon, RocketIcon} from '@sanity/icons'

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

const slugField = defineField({
  title: 'Slug',
  name: 'slug',
  type: 'slug',
  options: {
    source: 'name',
    slugify,
  },
  validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
})

export const person = defineType({
  name: 'person',
  type: 'document',
  title: 'Person',
  groups: [
    {name: 'profile', title: 'Profile', default: true},
    {name: 'social', title: 'Social & Links'},
    {name: 'hackathons', title: 'Hackathons'},
    {name: 'subscription', title: 'Subscription Data'},
  ],
  fields: [
    defineField({
      title: 'Display Name',
      name: 'name',
      type: 'string',
      validation: (Rule) => Rule.required().error('Name is required'),
      group: 'profile',
    }),
    slugField,
    defineField({
      title: 'Profile Photo',
      name: 'photo',
      type: 'cloudinary.asset',
      options: {hotspot: true},
      group: 'profile',
    }),
    defineField({
      title: 'Bio',
      name: 'bio',
      type: 'markdown',
      validation: (Rule) => Rule.max(750).warning('Keep bio under 750 characters'),
      group: 'profile',
    }),
    defineField({
      name: 'links',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'link',
          icon: LinkIcon,
          fields: [
            defineField({type: 'string', name: 'label', title: 'Label'}),
            defineField({type: 'url', name: 'url', title: 'URL'}),
          ],
        },
      ],
      group: 'social',
    }),
    defineField({
      name: 'subscription',
      type: 'object',
      description: 'Read-only data from Stripe',
      fields: [
        defineField({title: 'Stripe Customer ID', name: 'customer', type: 'string'}),
        defineField({
          name: 'level',
          type: 'string',
          options: {
            list: [
              {title: 'Silver Tier Supporter', value: 'Silver Tier Supporter'},
              {title: 'Gold Tier Supporter', value: 'Gold Tier Supporter'},
              {title: 'Platinum Tier Supporter', value: 'Platinum Tier Supporter'},
            ],
          },
        }),
        defineField({
          name: 'status',
          type: 'string',
          options: {
            list: [
              {title: 'Incomplete', value: 'incomplete'},
              {title: 'Incomplete (expired)', value: 'incomplete_expired'},
              {title: 'Trialing', value: 'trialing'},
              {title: 'Active', value: 'active'},
              {title: 'Past Due', value: 'past_due'},
              {title: 'Canceled', value: 'canceled'},
              {title: 'Unpaid', value: 'unpaid'},
              {title: 'Paused', value: 'paused'},
            ],
          },
        }),
        defineField({title: 'Join Date', name: 'date', type: 'datetime'}),
      ],
      group: 'subscription',
    }),
    defineField({
      title: 'Clerk User ID',
      name: 'user_id',
      type: 'string',
      description: 'Read-only data from Clerk',
      group: 'subscription',
    }),
    defineField({
      name: 'hackathons',
      type: 'array',
      title: 'Hackathon Participation',
      description: 'Hackathons this person has participated in',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'hackathon'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      group: 'hackathons',
    }),
    defineField({
      name: 'hackathonSubmissions',
      type: 'array',
      title: 'Hackathon Submissions',
      description: 'Submissions this person has made to hackathons',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{type: 'hackathonSubmission'}],
          options: {
            disableNew: true,
          },
        }),
      ],
      group: 'hackathons',
    }),
  ],
  __experimental_formPreviewTitle: false,
  preview: {
    select: {
      name: 'name',
      photo: 'photo',
      subscription: 'subscription',
    },
    prepare({name, photo, subscription}) {
      let url
      if (photo && photo.public_id) {
        console.log(photo.public_id)
        url = new URL('https://res.cloudinary.com')
        url.pathname = [
          'jlengstorf',
          'image',
          photo.type,
          't_thumb400',
          'w_99',
          'v' + photo.version,
          photo.public_id,
        ].join('/')
      } else {
        url = new URL(
          'https://res.cloudinary.com/jlengstorf/image/upload/t_thumb400/w_99/v1743473132/placeholder.jpg',
        )
      }

      const subtitle = subscription?.status === 'active' ? subscription?.level : ''

      return {
        title: name ?? 'Draft Person',
        subtitle,
        imageUrl: url.toString(),
      }
    },
  },
})
