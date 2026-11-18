/** Database schema holding every Mr. IndiaNZ table and function (isolated from other sites sharing the project). */
export const DB_SCHEMA = "mrindianz";

export const BUCKETS = {
  applications: "mrindianz-applications", // private
  public: "mrindianz-public",
} as const;

export function supabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
