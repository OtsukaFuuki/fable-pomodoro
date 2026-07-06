// Server Component: params / searchParams を Client に渡さない（Next.js 15 の sync-dynamic-apis 対策）
import { HomePage } from "./home-page";

export default function Page() {
  return <HomePage />;
}
