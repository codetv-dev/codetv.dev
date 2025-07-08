import {defineField, defineType} from 'sanity'
import {UserIcon} from '@sanity/icons'

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
  icon: UserIcon,
  groups: [
    {name: 'profile', title: 'Profile', default: true},
    {name: 'social', title: 'Social & Links'},
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
              {title: 'Free', value: 'free'},
              {title: 'Supporter', value: 'supporter'},
              {title: 'Patron', value: 'patron'},
            ],
          },
        }),
        defineField({
          name: 'status',
          type: 'string',
          options: {
            list: [
              {title: 'Active', value: 'active'},
              {title: 'Inactive', value: 'inactive'},
              {title: 'Cancelled', value: 'cancelled'},
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
  ],
  preview: {
    select: {
      name: 'name',
      photo: 'photo',
      subscription: 'subscription',
    },
    prepare({name, photo, subscription}) {
      let url
      if (photo && photo.public_id) {
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
        media: UserIcon,
      }
    },
  },
})
