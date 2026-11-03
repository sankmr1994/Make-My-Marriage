import { PublicWeddingWebsite } from "@/components/public-wedding-website";

export default async function WeddingWebsitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  return <PublicWeddingWebsite slug={slug} preview={preview === "1"} />;
}
