import Sidebar from "@/components/dashboard/Sidebar";
import { ViewerProvider } from "@/components/dashboard/viewer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewerProvider>
      <div className="min-h-screen bg-bg">
        <Sidebar />
        <main className="lg:pl-[264px]">{children}</main>
      </div>
    </ViewerProvider>
  );
}
