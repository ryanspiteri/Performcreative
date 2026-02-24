import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BrowseCreatives from "./pages/BrowseCreatives";
import ManualTrigger from "./pages/ManualTrigger";
import Results from "./pages/Results";
import Settings from "./pages/Settings";
import StaticPipeline from "./pages/StaticPipeline";
import ProductRenders from "./pages/ProductRenders";
import ProductInfoHub from "./pages/ProductInfoHub";
import Backgrounds from "./pages/Backgrounds";
import IterateWinners from "./pages/IterateWinners";
import TemplateTester from "./pages/TemplateTester";
import UgcUpload from "./pages/UgcUpload";
import UgcDashboard from "./pages/UgcDashboard";
import HeadlineBank from "./pages/HeadlineBank";
import AppLayout from "./components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={BrowseCreatives} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/browse" component={BrowseCreatives} />
        <Route path="/renders" component={ProductRenders} />
        <Route path="/backgrounds" component={Backgrounds} />
        <Route path="/iterate" component={IterateWinners} />
        <Route path="/template-tester" component={TemplateTester} />
        <Route path="/ugc" component={UgcUpload} />
        <Route path="/ugc/:id" component={UgcDashboard} />
        <Route path="/headlines" component={HeadlineBank} />
        <Route path="/product-info" component={ProductInfoHub} />
        <Route path="/trigger" component={ManualTrigger} />
        <Route path="/static" component={StaticPipeline} />
        <Route path="/results/:id" component={Results} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return <Login />;
  return <AuthenticatedRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
