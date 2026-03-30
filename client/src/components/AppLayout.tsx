import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { LayoutDashboard, Settings, LogOut, Image, ImagePlus, FileText, Palette, RefreshCw, Video, BookText, Menu, X, BookOpen, PenTool } from "lucide-react";
import { useState } from "react";

const navItems = [
  // PIPELINE (0-3)
  { icon: Image, label: "Browse Creatives", path: "/" },
  { icon: RefreshCw, label: "Iterate Winners", path: "/iterate" },
  { icon: Video, label: "UGC Clone Engine", path: "/ugc" },
  { icon: PenTool, label: "Script Generator", path: "/scripts" },
  // ORGANIC (4-7)
  { icon: Video, label: "Organic Video", path: "/organic/video" },
  { icon: ImagePlus, label: "Visual Content", path: "/organic/visual" },
  { icon: FileText, label: "Caption Generator", path: "/organic/captions" },
  { icon: BookOpen, label: "Content Library", path: "/organic/library" },
  // ASSETS (7-9)
  { icon: BookText, label: "Headline Bank", path: "/headlines" },
  { icon: ImagePlus, label: "Product Renders", path: "/renders" },
  { icon: Palette, label: "Backgrounds", path: "/backgrounds" },
  // SYSTEM (10-12)
  { icon: FileText, label: "Product Info", path: "/product-info" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavClick = (path: string) => {
    setLocation(path);
    setSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  return (
    <div className="min-h-screen bg-[#01040A] flex">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg bg-[#0D0F12] border border-white/10 flex items-center justify-center text-white hover:bg-white/5 transition-colors"
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-56 bg-[#0D0F12] border-r border-white/5 flex flex-col shrink-0 h-screen z-40
        fixed lg:fixed
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FF3838] flex items-center justify-center text-white font-bold text-sm">
            O
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">ONEST</div>
            <div className="text-gray-500 text-xs">Creative Pipeline</div>
          </div>
        </div>

        {/* Section: Pipeline */}
        <div className="px-3 pt-4 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-3">Pipeline</p>
        </div>
        <nav className="px-3 space-y-0.5">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location === item.path || (item.path === "/" && location === "/browse");
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Section: Organic */}
        <div className="px-3 pt-5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-3">Organic</p>
        </div>
        <nav className="px-3 space-y-0.5">
          {navItems.slice(4, 8).map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Section: Assets */}
        <div className="px-3 pt-5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-3">Assets</p>
        </div>
        <nav className="px-3 space-y-0.5">
          {navItems.slice(8, 11).map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Section: System */}
        <div className="px-3 pt-5 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-3">System</p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.slice(11).map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-h-screen">
        {children}
      </main>
    </div>
  );
}
