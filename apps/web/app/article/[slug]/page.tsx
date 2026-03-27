import { redirect } from 'next/navigation'

export default async function LegacyArticlePage(props: {
  params: Promise<{ slug: string }>
}) {
  const params = await props.params;
  redirect(`/en/article/${params.slug}`)
}
