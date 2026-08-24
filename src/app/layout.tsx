import type { Metadata } from "next";
import { Fredoka, Quicksand } from "next/font/google";
import { CartProvider } from "../lib/cart/CartContext";
import { UserProvider } from "../lib/user/UserContext";
import { getCurrentUser } from "../db/queries";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vanessa's cake — Made With Love",
  description:
    "Vanessa's cake — pastel, whimsical cakes and custom cake design, baked with love.",
  icons: {
    icon: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${fredoka.variable} ${quicksand.variable}`}>
      <body>
        <UserProvider initialUser={user}>
          <CartProvider>{children}</CartProvider>
        </UserProvider>
      </body>
    </html>
  );
}
