import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NavProvider } from "@/context/NavContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "NER-LOGIX | Tactical Logistics & Hazard Management",
  description: "Mission-critical AI-driven offline-first logistics and disaster response platform for the 8 North Eastern States of India.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-100/90 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30 selection:text-blue-200">
        <AuthProvider>
          <AuthGuard>
            <NavProvider>
              <Navbar />
              <div className="flex-1 flex min-h-0">
                <Sidebar />
                <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                  {children}
                </main>
              </div>
            </NavProvider>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
