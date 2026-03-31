import type { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "./supabase-client";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error };
    }

    // Admin kontrolü — sadece admin_users tablosunda olanlar girebilir
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (user) {
      const { data: adminUser, error: adminError } = await supabaseClient
        .from("admin_users")
        .select("id, role_name, is_active")
        .eq("id", user.id)
        .eq("role_name", "company_admin")  // sadece company_admin girebilir
        .single();

      if (adminError || !adminUser || !adminUser.is_active) {
        await supabaseClient.auth.signOut();
        return {
          success: false,
          error: {
            name: "Yetkisiz Erişim",
            message: "Bu hesabın admin erişimi yok.",
          },
        };
      }
    }

    return { success: true, redirectTo: "/dashboard" };
  },

  logout: async () => {
    await supabaseClient.auth.signOut();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },

  getIdentity: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: adminUser } = await supabaseClient
      .from("admin_users")
      .select("full_name, role_name")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      name: adminUser?.full_name ?? user.email,
      role: adminUser?.role_name,
      email: user.email,
    };
  },

  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true };
    }
    return { error };
  },
};

export default authProvider;