import {defineArrayMember, defineField, defineType} from 'sanity'
import {PlayIcon} from '@sanity/icons'

export const episode = defineType({
  name: 'episode',
  type: 'document',
  title: 'Episode',
  icon: PlayIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'video', title: 'Video Details'},
    {name: 'seo', title: 'SEO & Publishing'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Episode title is required'),
      group: 'content',
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      description: 'URL-friendly identifier for this episode',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
      group: 'content',
    }),
    defineField({
      name: 'short_description',
      type: 'text',
      description: 'Brief overview for previews and SEO',
      validation: (Rule) => Rule.required().error('Short description is required for SEO'),
      group: 'content',
    }),
    defineField({
      name: 'description',
      type: 'markdown',
      description: 'Detailed description of the episode content',
      validation: (Rule) => Rule.required().error('Full description is required'),
      group: 'content',
    }),
    defineField({
      name: 'publish_date',
      type: 'datetime',
      description: 'When this episode should be published',
      options: {
        timeStep: 30,
      },
      validation: (Rule) => Rule.required().error('Publish date is required'),
      group: 'content',
    }),
    defineField({
      name: 'people',
      type: 'array',
      title: 'People in This Episode',
      of: [defineArrayMember({type: 'reference', to: [{type: 'person'}]})],
      group: 'content',
    }),
    defineField({
      name: 'episodeTags',
      type: 'array',
      title: 'Tags',
      of: [defineArrayMember({type: 'reference', to: [{type: 'episodeTag'}]})],
      group: 'content',
    }),
    defineField({
      name: 'resources',
      type: 'array',
      title: 'Resources & Links',
      description: 'Links to demos, repos, and other resources mentioned',
      of: [
        {
          type: 'object',
          name: 'resource',
          fields: [
            defineField({name: 'label', type: 'string', title: 'Label'}),
            defineField({name: 'url', type: 'url', title: 'URL'}),
          ],
        },
      ],
      group: 'content',
    }),
    defineField({
      name: 'video',
      type: 'object',
      group: 'video',
      fields: [
        defineField({
          name: 'members_only',
          type: 'string',
          title: 'Access Level',
          options: {
            list: [
              {title: 'Public', value: 'public'},
              {title: 'Members Only', value: 'members'},
            ],
            layout: 'radio',
          },
          initialValue: 'public',
        }),
        defineField({
          name: 'mux_video',
          type: 'mux.video',
          title: 'Video File',
        }),
        defineField({
          name: 'youtube_id',
          type: 'string',
          title: 'YouTube ID',
          description: 'If provided, YouTube video will be displayed instead of Mux video',
        }),
        defineField({
          name: 'captions',
          type: 'file',
          title: 'Captions (SRT)',
          options: {accept: '.srt'},
        }),
        defineField({
          name: 'thumbnail',
          type: 'cloudinary.asset',
          options: {hotspot: true},
        }),
        defineField({
          name: 'thumbnail_alt',
          type: 'string',
          validation: (Rule) => Rule.warning('Alt text improves accessibility'),
        }),
        defineField({
          name: 'transcript',
          type: 'markdown',
          description: 'Full transcript of the episode',
        }),
      ],
    }),
    defineField({
      name: 'hidden',
      type: 'string',
      description: 'Control whether this episode appears on the website',
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
    defineField({
      name: 'sponsors',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'sponsor'}]})],
      group: 'seo',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      publish_date: 'publish_date',
      people: 'people',
      hidden: 'hidden',
    },
    prepare({title, publish_date, people, hidden}) {
      const date = publish_date ? new Date(publish_date).toLocaleDateString() : 'No date'
      const peopleCount = people?.length || 0
      const status = hidden === 'hidden' ? ' (Hidden)' : ''

      return {
        title: title || 'Untitled Episode',
        subtitle: `${date} · ${peopleCount} people${status}`,
        media: PlayIcon,
      }
    },
  },
  initialValue: () => ({
    hidden: 'visible',
    featured: 'normal',
    video: {
      members_only: 'public',
    },
  }),
})
