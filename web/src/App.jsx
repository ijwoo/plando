import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./features/auth/pages/LoginPage.jsx";
import TodoBoardPage from "./features/todo/pages/TodoBoardPage.jsx";
import Layout from "./layouts/Layout";
import DashboardPage from "./features/dashboard/pages/DashboardPage.jsx";
import ProtectedRoute from "./features/auth/components/ProtectedRoute.jsx";
import CalendarPage from "./features/calendar/pages/CalendarPage.jsx";
import { LayoutProvider } from "./layouts/LayoutContext";
import TaskListPage from "./features/tasklist/pages/TaskListPage.jsx";
import SettingsPage from "./features/settings/pages/SettingsPage.jsx";
import RegisterPage from "./features/auth/pages/RegisterPage.jsx";
import OAuthCallbackPage from "./features/auth/pages/OAuthCallbackPage.jsx";
import InvitePage from "./features/auth/pages/InvitePage.jsx";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./features/auth/pages/VerifyEmailPage.jsx";
import { WorkspaceProvider } from "./features/workspace/context/WorkspaceContext.jsx";
import { StatusProvider } from "./features/workspace/context/StatusContext.jsx";
import { ActiveProjectProvider } from "./features/project/context/ActiveProjectContext.jsx";
import { MapUiProvider } from "./features/map/context/MapUiContext.jsx";
import MapTasksPage from "./features/map/pages/MapTaskPage.jsx";
import DmPage from "./features/dm/pages/DmPage.jsx";
import ErrorBoundary from "./shared/ui/common/ErrorBoundary.jsx";
import RecruitmentListPage from "./features/recruitment/pages/RecruitmentListPage.jsx";
import WeeklyWrapPage from "./features/wrap/pages/WeeklyWrapPage.jsx";
import WrapHistoryPage from "./features/wrap/pages/WrapHistoryPage.jsx";
import ProjectsPage from "./features/project/pages/ProjectsPage.jsx";
import MorePage from "./features/more/pages/MorePage.jsx";
import DeepLinkHandler from "./features/auth/components/DeepLinkHandler.jsx";
import useWidgetSync from "./shared/hooks/useWidgetSync.js";
import { getLastRoute } from "./shared/utils/lastRoute.js";
import { lazy, Suspense } from "react";

// 백오피스는 관리자만 쓰므로 따로 나눠 받는다 — 일반 사용자의 첫 화면 번들에 들어가지 않게.
const AdminPage = lazy(() => import("./features/admin/pages/AdminPage.jsx"));

/** iOS 위젯 전역 동기화. iOS native 외 플랫폼에서는 no-op. */
function WidgetSyncRunner() {
    useWidgetSync();
    return null;
}

function App() {
    return (
        <ErrorBoundary>
        <Router>
            <WorkspaceProvider>
                <StatusProvider>
                <ActiveProjectProvider>
                <LayoutProvider>
                <MapUiProvider>
                    <DeepLinkHandler />
                    <WidgetSyncRunner />
                    <Routes>
                        {/* "/"는 별도 라우트 없이 아래 "*" 캐치올로 떨어진다
                            → ProtectedRoute: 로그인 시 마지막 방문 화면, 비로그인 시 /login */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/oauth2/callback" element={<OAuthCallbackPage />} />
                        <Route path="/join" element={<InvitePage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        {/* 인증 메일 링크 — 비로그인 상태(다른 브라우저)에서도 열려야 하므로 ProtectedRoute 밖 */}
                        <Route path="/verify-email" element={<VerifyEmailPage />} />

                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <Suspense fallback={null}>
                                        <AdminPage />
                                    </Suspense>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <DashboardPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/tasklist"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <TaskListPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/calendar"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <CalendarPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/todos"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <TodoBoardPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/map"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <MapTasksPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/dm"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <DmPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/settings"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <SettingsPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/recruitments/"
                            element={
                                <Layout>
                                    <RecruitmentListPage />
                                </Layout>
                            }
                        />

                        <Route
                            path="/wrap"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <WeeklyWrapPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/wrap/history"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <WrapHistoryPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/more"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <MorePage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/projects"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <ProjectsPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/projects/:id"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <ProjectsPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="*"
                            element={
                                <ProtectedRoute>
                                    <Navigate to={getLastRoute()} replace />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </MapUiProvider>
                </LayoutProvider>
                </ActiveProjectProvider>
                </StatusProvider>
            </WorkspaceProvider>
        </Router>
        </ErrorBoundary>
    );
}

export default App;