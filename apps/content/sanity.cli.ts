import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'vnkupgyb',
    dataset: 'develop',
  },
  typegen: {
    path: '../../libs/sanity/src/index.ts',
    schema: 'schema.json',
    generates: '../../libs/types/src/sanity.ts',
  },
})
