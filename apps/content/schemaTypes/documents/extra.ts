import {defineField, defineType} from 'sanity'
import {PlayIcon} from '@sanity/icons'

export const extra = defineType({
  name: 'extra',
  type: 'document',
  title: 'Extra',
  icon: PlayIcon,
  groups: [
    {name: 'details', title: 'Details', default: true},
    {name: 'video', title: 'Video Details'},
    {name: 'seo', title: 'SEO & Publishing'},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (Rule) => Rule.required().error('Episode title is required'),
      group: 'details',
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      description: 'URL-friendly identifier for this extra',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('Slug is required for URL generation'),
      group: 'details',
    }),
    defineField({
      name: 'publish_date',
      type: 'datetime',
      description: 'When this extra should be published',
      options: {
        timeStep: 30,
      },
      validation: (Rule) => Rule.required().error('Publish date is required'),
      group: 'details',
    }),
    defineField({
      name: 'short_description',
      type: 'text',
      description: 'Brief overview for previews and SEO',
      validation: (Rule) => Rule.required().error('Short description is required for SEO'),
      group: 'details',
    }),
    defineField({
      title: 'Related episode',
      name: 'related_episode',
      description: 'The episode this extra belongs to',
      type: 'reference',
      to: [{type: 'episode'}],
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
  ],
  preview: {
    select: {
      title: 'title',
      publish_date: 'publish_date',
      people: 'people',
    },
    prepare({title, publish_date, people}) {
      const date = publish_date ? new Date(publish_date).toLocaleDateString() : 'No date'
      const peopleCount = people?.length || 0

      return {
        title: title || 'Untitled Episode',
        subtitle: `${date} · ${peopleCount} people`,
        media: PlayIcon,
      }
    },
  },
  initialValue: () => ({
    video: {
      members_only: 'public',
    },
  }),
})
