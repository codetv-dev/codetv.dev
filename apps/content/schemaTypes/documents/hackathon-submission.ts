import {defineField, defineType} from 'sanity'
import {DocumentIcon} from '@sanity/icons'

export const hackathonSubmission = defineType({
  name: 'hackathonSubmission',
  type: 'document',
  title: 'Hackathon Submission',
  icon: DocumentIcon,
  fields: [
    defineField({
      name: 'hackathon',
      type: 'reference',
      to: [{type: 'hackathon'}],
      title: 'Hackathon',
      description: 'The hackathon this submission is for',
      validation: (Rule) => Rule.required().error('Hackathon is required'),
    }),
    defineField({
      name: 'person',
      type: 'reference',
      to: [{type: 'person'}],
      title: 'Submitter',
      description: 'The person who submitted this entry',
    }),
    defineField({
      name: 'githubRepo',
      type: 'url',
      title: 'GitHub Repository',
      description: 'Link to the source code repository',
      validation: (Rule) =>
        Rule.required()
          .uri({scheme: ['https']})
          .error('GitHub repo URL is required'),
    }),
    defineField({
      name: 'deployedUrl',
      type: 'url',
      title: 'Deployed URL',
      description: 'Link to the deployed web app',
    }),
    defineField({
      name: 'submittedAt',
      type: 'datetime',
      title: 'Submitted At',
      description: 'When this submission was received',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      fullName: 'person.name',
      hackathonTitle: 'hackathon.title',
      submittedAt: 'submittedAt',
    },
    prepare({fullName, hackathonTitle, submittedAt}) {
      const date = submittedAt ? new Date(submittedAt).toLocaleDateString() : 'No date'

      return {
        title: fullName || 'Unknown Submitter',
        subtitle: `${hackathonTitle || 'Unknown Hackathon'} - ${date}`,
        media: DocumentIcon,
      }
    },
  },
})
