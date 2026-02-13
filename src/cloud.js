import { assertSupabaseConfigured } from "./supabase.js";

const TX_COLUMNS = "id, title, amount, category, date";

function normalizeTransaction(row) {
  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    date: row.date,
  };
}

export async function getCurrentUser() {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function signUpWithEmail(email, password) {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutCurrentUser() {
  const supabase = assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchTransactionsFromCloud() {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeTransaction);
}

export async function createCloudTransaction(payload) {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select(TX_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeTransaction(data);
}

export async function updateCloudTransaction(id, payload) {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .select(TX_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeTransaction(data);
}

export async function deleteCloudTransaction(id) {
  const supabase = assertSupabaseConfigured();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function clearCloudTransactions() {
  const supabase = assertSupabaseConfigured();
  const { error } = await supabase.from("transactions").delete().not("id", "is", null);
  if (error) throw error;
}

export async function fetchCloudBudget() {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase
    .from("budgets")
    .select("budget_limit")
    .maybeSingle();

  if (error) throw error;
  if (!data) return 0;

  const parsed = Number(data.budget_limit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function saveCloudBudget(userId, budgetLimit) {
  const supabase = assertSupabaseConfigured();

  if (budgetLimit <= 0) {
    const { error } = await supabase.from("budgets").delete().eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: userId,
      budget_limit: budgetLimit,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
