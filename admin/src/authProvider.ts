import { AuthProvider } from "@refinedev/core";
import { supabaseClient } from "./utility/supabaseClient";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: {
            name: "LoginError",
            message: error.message,
          },
        };
      }

      if (data?.user) {
        // Check if user is admin
        console.log("🔍 Fetching user data for:", data.user.id);

        const { data: userData, error: userError } = await supabaseClient
          .from("users")
          .select("role, company_id, full_name")
          .eq("id", data.user.id)
          .single();

        console.log("📊 User data response:", { userData, userError });

        if (userError || !userData) {
          console.error("❌ User data fetch failed:", userError);
          await supabaseClient.auth.signOut();
          return {
            success: false,
            error: {
              name: "LoginError",
              message: userError
                ? `❌ Database error: ${userError.message}`
                : "❌ User data not found. Contact administrator.",
            },
          };
        }

        // Check role
        if (!["super_admin", "company_admin"].includes(userData.role)) {
          await supabaseClient.auth.signOut();
          return {
            success: false,
            error: {
              name: "LoginError",
              message: "❌ You don't have permission to access this panel.",
            },
          };
        }

        console.log("✅ Login successful:", userData);

        return {
          success: true,
          redirectTo: "/",
        };
      }

      return {
        success: false,
        error: {
          name: "LoginError",
          message: "Login failed",
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error?.message || "Unknown error",
        },
      };
    }
  },

  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      return {
        success: false,
        error: {
          name: "LogoutError",
          message: error.message,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    try {
      const { data } = await supabaseClient.auth.getSession();
      const { session } = data;

      if (!session) {
        return {
          authenticated: false,
          redirectTo: "/login",
          logout: true,
        };
      }

      return {
        authenticated: true,
      };
    } catch (error: any) {
      return {
        authenticated: false,
        redirectTo: "/login",
        logout: true,
        error: {
          name: "SessionError",
          message: error?.message || "Session check failed",
        },
      };
    }
  },

  getPermissions: async () => {
    const { data } = await supabaseClient.auth.getUser();

    if (data?.user) {
      const { data: userData } = await supabaseClient
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      return userData?.role;
    }

    return null;
  },

  getIdentity: async () => {
    const { data } = await supabaseClient.auth.getUser();

    if (data?.user) {
      const { data: userData } = await supabaseClient
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", data.user.id)
        .single();

      return {
        ...data.user,
        name: userData?.full_name || data.user.email,
        avatar: userData?.company?.logo_url,
        role: userData?.role,
        company: userData?.company,
        company_id: userData?.company_id,
      };
    }

    return null;
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.status === 403) {
      return {
        logout: true,
        redirectTo: "/login",
        error,
      };
    }

    return { error };
  },
};