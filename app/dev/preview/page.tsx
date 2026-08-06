import { getTemplate } from '@/lib/templates/registry'
import { notFound } from 'next/navigation'

/**
 * Dev-only eyeball page: renders a template at true size with sample values.
 * /dev/preview?template=sambalpur-lab — compare against the reference PDF.
 */
const SAMPLE = {
  labName: 'CN LAB',
  semester: '4th Semester',
  name: 'DEBASHISH PRADHAN',
  rollNo: '24BTCSE04',
  section: 'A',
  branch: 'CSE',
}

export default async function DevPreview({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; empty?: string }>
}) {
  const params = await searchParams
  const resolved = getTemplate(params.template ?? 'sambalpur-lab')
  if (!resolved) notFound()

  const { Component, meta } = resolved
  return (
    <main style={{ background: '#666', minHeight: '100vh', padding: '2rem', display: 'grid', placeItems: 'center' }}>
      <div style={{ boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
        <Component brand={meta.brand} fields={meta.fields} values={params.empty ? {} : SAMPLE} />
      </div>
    </main>
  )
}
