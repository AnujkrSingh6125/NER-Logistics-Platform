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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ner-logistics-platform-gamma.vercel.app';
const PREVIEW_IMAGE = '/convoy.jpg';
const LOGO_IMAGE = '/logo.png';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AshtaMarg | Tactical Logistics & Hazard Management',
    template: '%s | AshtaMarg',
  },
  description:
    'Mission-critical AI-driven offline-first logistics and disaster response platform for the 8 North-Eastern States of India.',
  applicationName: 'AshtaMarg',
  keywords: [
    'AshtaMarg',
    'NER-LOGIX',
    'North East India Logistics',
    'Tactical Routing',
    'Disaster Management',
    'Corridor Telemetry',
    'Hazard Avoidance',
    'Fleet Management',
    'Assam Logistics',
    'Arunachal Pradesh',
    'Meghalaya Corridors',
    'Manipur Transit',
    'Mizoram Highway',
    'Nagaland Safety',
    'Tripura Relief',
    'Sikkim Logistics',
  ],
  authors: [{ name: 'AshtaMarg Command & Logistics Fleet' }],
  creator: 'AshtaMarg Operations',
  publisher: 'AshtaMarg Operations',

  // Browser Icons & Favicons
  icons: {
    icon: [
      { url: LOGO_IMAGE, type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: [LOGO_IMAGE],
    apple: [LOGO_IMAGE],
  },

  // Open Graph / WhatsApp / Facebook / LinkedIn
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
    siteName: 'AshtaMarg Tactical Platform',
    title: 'AshtaMarg | Tactical Logistics & Hazard Management',
    description:
      'Mission-critical AI-driven offline-first logistics and disaster response platform for the 8 North-Eastern States of India.',
    images: [
      {
        url: PREVIEW_IMAGE,
        width: 1200,
        height: 630,
        alt: 'AshtaMarg Tactical Fleet & Hazard Operations',
      },
    ],
  },

  // Twitter / X Cards
  twitter: {
    card: 'summary_large_image',
    title: 'AshtaMarg | Tactical Logistics & Hazard Management',
    description:
      'Mission-critical AI-driven offline-first logistics and disaster response platform for the 8 North-Eastern States of India.',
    images: [PREVIEW_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
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
