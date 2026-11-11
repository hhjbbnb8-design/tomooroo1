import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireRole } from "./components/RequireRole";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import StudentAssignmentDetail from "./pages/StudentAssignmentDetail";
import StudentAssignments from "./pages/StudentAssignments";
import StudentDashboard from "./pages/StudentDashboard";
import StudentGrades from "./pages/StudentGrades";
import StudentLessons from "./pages/StudentLessons";
import TeacherAssignmentDetail from "./pages/TeacherAssignmentDetail";
import TeacherAssignments from "./pages/TeacherAssignments";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherLessonDetail from "./pages/TeacherLessonDetail";
import TeacherLessons from "./pages/TeacherLessons";
import TeacherRecordings from "./pages/TeacherRecordings";

function RoleRoute({
  roles,
  children,
}: {
  roles: ("admin" | "teacher" | "student")[];
  children: React.ReactNode;
}) {
  return <RequireRole roles={roles}>{children}</RequireRole>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />

      <Route path="/admin">
        <RoleRoute roles={["admin"]}>
          <AdminDashboard />
        </RoleRoute>
      </Route>

      <Route path="/teacher">
        <RoleRoute roles={["teacher"]}>
          <TeacherDashboard />
        </RoleRoute>
      </Route>
      <Route path="/teacher/lessons">
        <RoleRoute roles={["teacher"]}>
          <TeacherLessons />
        </RoleRoute>
      </Route>
      <Route path="/teacher/lessons/:id">
        <RoleRoute roles={["teacher"]}>
          <TeacherLessonDetail />
        </RoleRoute>
      </Route>
      <Route path="/teacher/assignments">
        <RoleRoute roles={["teacher"]}>
          <TeacherAssignments />
        </RoleRoute>
      </Route>
      <Route path="/teacher/assignments/:id">
        <RoleRoute roles={["teacher"]}>
          <TeacherAssignmentDetail />
        </RoleRoute>
      </Route>
      <Route path="/teacher/recordings">
        <RoleRoute roles={["teacher"]}>
          <TeacherRecordings />
        </RoleRoute>
      </Route>

      <Route path="/student">
        <RoleRoute roles={["student"]}>
          <StudentDashboard />
        </RoleRoute>
      </Route>
      <Route path="/student/lessons">
        <RoleRoute roles={["student"]}>
          <StudentLessons />
        </RoleRoute>
      </Route>
      <Route path="/student/assignments">
        <RoleRoute roles={["student"]}>
          <StudentAssignments />
        </RoleRoute>
      </Route>
      <Route path="/student/assignments/:id">
        <RoleRoute roles={["student"]}>
          <StudentAssignmentDetail />
        </RoleRoute>
      </Route>
      <Route path="/student/grades">
        <RoleRoute roles={["student"]}>
          <StudentGrades />
        </RoleRoute>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
