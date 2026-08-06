import { App } from '@/components/App'
import { listTemplates } from '@/lib/templates/registry'

export default function Home() {
  return <App templates={listTemplates()} />
}
