import { SemanticSearch } from "@/components/semantic-search";
import { requireAdmin } from "@/lib/auth/admin-check";

export default async function SearchPage() {
  // Check admin access
  await requireAdmin();

  return (
    <div className="container py-8">
      <SemanticSearch />
    </div>
  );
}
