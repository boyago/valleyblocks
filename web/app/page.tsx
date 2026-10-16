import { CatalogExperience } from "@/components/catalog-experience";
import { games, categoryLabels } from "@/lib/games";
export default async function Home({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const category = categoria && Object.hasOwn(categoryLabels, categoria) ? categoria as keyof typeof categoryLabels : "todos";
  return <CatalogExperience key={category} games={games} initialCategory={category} />;
}
