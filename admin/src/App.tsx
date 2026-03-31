import { Refine, Authenticated } from "@refinedev/core";
import { BrowserRouter, Route, Routes, Navigate } from "react-router";
import routerProvider from "@refinedev/react-router";
import { liveProvider } from "@refinedev/supabase";
import authProvider from "./providers/auth";
import { dataProvider } from "./providers/data";
import { supabaseClient } from "./providers/supabase-client";
import { LoginPage } from "./pages/auth/login";
import { AdminLayout } from "./components/layout/AdminLayout";
import { DashboardPage } from "./pages/dashboard";
import { ProductCreatePage } from "./pages/products/create";
import { ProductCustomizePage } from "./pages/products/customize";
import { ColorTexturePage } from "./pages/products/color-texture";
import { ProductsPage } from "./pages/products/products";
import { CategoriesPage } from "./pages/categories/categories";
import { ProductEditPage } from "./pages/products/edit";
import { ProductPreviewPage } from "./pages/products/preview";
import { ThemeProvider } from "./providers/ThemeProvider";
import "./styles/theme.css";

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Refine
          dataProvider={dataProvider}
          liveProvider={liveProvider(supabaseClient)}
          authProvider={authProvider}
        routerProvider={routerProvider}
        options={{
          syncWithLocation: true,
          warnWhenUnsavedChanges: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/products/:id/preview" element={<ProductPreviewPage />} />
          <Route
            element={
              <Authenticated key="protected" fallback={<Navigate to="/login" />}>
                <AdminLayout />
              </Authenticated>
            }
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products/create" element={<ProductCreatePage />} />
            <Route path="/products/:id/customize" element={<ProductCustomizePage />} />
            <Route path="/products/:id/customize/color-texture" element={<ColorTexturePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/products/:id/edit" element={<ProductEditPage />} />

          </Route>
        </Routes>
      </Refine>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;