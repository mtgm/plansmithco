import { Refine, Authenticated } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import {
  AuthPage,
  ErrorComponent,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/antd";
import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router-v6";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import { App as AntdApp, ConfigProvider } from "antd";
import "@refinedev/antd/dist/reset.css";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

// Import our files
import { supabaseClient } from "./utility/supabaseClient";
import { authProvider } from "./authProvider";
import { DashboardPage } from "./pages/dashboard";
import { ProductList, ProductCreate, ProductEdit } from "./pages/products";
import { CategoryManager } from "./pages/categories";
import { SetList, SetCreate, SetEdit } from "./pages/sets";

// Icons
import {
  DashboardOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  QrcodeOutlined,
  TeamOutlined,
  BlockOutlined,
} from "@ant-design/icons";

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#FFD700", // Gold - Brand color
              colorBgContainer: "#ffffff",
              borderRadius: 6,
            },
          }}
        >
          <AntdApp>
            <Refine
              dataProvider={dataProvider(supabaseClient)}
              liveProvider={liveProvider(supabaseClient)}
              authProvider={authProvider}
              routerProvider={routerBindings}
              notificationProvider={useNotificationProvider}
              resources={[
                {
                  name: "dashboard",
                  list: "/",
                  meta: {
                    label: "Dashboard",
                    icon: <DashboardOutlined />,
                  },
                },
                {
                  name: "products",
                  list: "/products",
                  create: "/products/create",
                  edit: "/products/edit/:id",
                  show: "/products/show/:id",
                  meta: {
                    label: "Products",
                    icon: <ShoppingOutlined />,
                    canDelete: true,
                  },
                },
                {
                  name: "categories",
                  list: "/categories",
                  create: "/categories/create",
                  edit: "/categories/edit/:id",
                  meta: {
                    label: "Categories",
                    icon: <AppstoreOutlined />,
                    canDelete: true,
                  },
                },
                {
                  name: "sets",
                  list: "/sets",
                  create: "/sets/create",
                  edit: "/sets/edit/:id",
                  meta: {
                    label: "Sets",
                    icon: <BlockOutlined />,
                  },
                },
                {
                  name: "qr_codes",
                  list: "/qr-codes",
                  meta: {
                    label: "QR Codes",
                    icon: <QrcodeOutlined />,
                  },
                },
                {
                  name: "companies",
                  list: "/companies",
                  edit: "/companies/edit/:id",
                  meta: {
                    label: "Companies",
                    icon: <TeamOutlined />,
                  },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "plansmithco-admin",
              }}
            >
              <Routes>
                {/* Protected Routes */}
                <Route
                  element={
                    <Authenticated
                      key="authenticated-layout"
                      fallback={<CatchAllNavigate to="/login" />}
                    >
                      <ThemedLayout>
                        <Outlet />
                      </ThemedLayout>
                    </Authenticated>
                  }
                >
                  {/* Dashboard */}
                  <Route
                    index
                    element={<DashboardPage />}
                  />

                  {/* Products */}
                  <Route path="/products">
                    <Route
                      index
                      element={<ProductList />}
                    />
                    <Route
                      path="create"
                      element={<ProductCreate />}
                    />
                    <Route
                      path="edit/:id"
                      element={<ProductEdit />}
                    />

                    <Route
                      path="show/:id"
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>👁️ Show Product</h1>
                        </div>
                      }
                    />
                  </Route>

                  {/* Categories */}
                  <Route path="/categories">
                    <Route
                      index
                      element={<CategoryManager />}
                    />
                    <Route
                      path="create"
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>➕ Create Category</h1>
                        </div>
                      }
                    />
                    <Route
                      path="edit/:id"
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>✏️ Edit Category</h1>
                        </div>
                      }
                    />
                  </Route>

                  {/* Sets */}
                  <Route path="/sets">
                    <Route index element={<SetList />} />
                    <Route path="create" element={<SetCreate />} />
                    <Route path="edit/:id" element={<SetEdit />} />
                  </Route>

                  {/* QR Codes */}
                  <Route path="/qr-codes">
                    <Route
                      index
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>📱 QR Codes</h1>
                        </div>
                      }
                    />
                  </Route>

                  {/* Companies */}
                  <Route path="/companies">
                    <Route
                      index
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>🏢 Companies</h1>
                        </div>
                      }
                    />
                    <Route
                      path="edit/:id"
                      element={
                        <div style={{ padding: 24 }}>
                          <h1>✏️ Edit Company</h1>
                        </div>
                      }
                    />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<ErrorComponent />} />
                </Route>

                {/* Public Routes (Login) */}
                <Route
                  element={
                    <Authenticated
                      key="authenticated-auth"
                      fallback={<Outlet />}
                    >
                      <NavigateToResource resource="dashboard" />
                    </Authenticated>
                  }
                >
                  <Route
                    path="/login"
                    element={
                      <AuthPage
                        type="login"
                        title={
                          <div
                            style={{
                              color: "#FFD700",
                              fontSize: "32px",
                              fontWeight: "bold",
                              marginBottom: "24px",
                              textAlign: "center",
                            }}
                          >
                            🎨 PlanSmithCo
                          </div>
                        }
                        formProps={{
                          initialValues: {
                            email: "admin@plansmithco.com",
                            password: "",
                          },
                        }}
                      />
                    }
                  />
                </Route>
              </Routes>

              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </AntdApp>
        </ConfigProvider>
      </RefineKbarProvider>
    </BrowserRouter >
  );
}

export default App;