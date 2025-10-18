export async function invokeSupabaseFunction<T>(
  name: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error("Supabase credentials missing (check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
  }

  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set("Authorization", `Bearer ${anonKey}`);
  headers.set("apikey", anonKey);

  const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message: string | undefined;
    try {
      const problem = await response.json();
      message = typeof problem === "object" && problem?.message ? String(problem.message) : undefined;
    } catch {
      // ignore parse failure
    }

    const error = new Error(message || `Supabase request failed with status ${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch (err) {
    throw new Error("Failed to parse Supabase response as JSON");
  }
}
