import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions } from "next-auth"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      // INVARIANT: token.sub is the canonical data-owning id. All rows are
      // created via API routes with agentId = token.sub (see app/api/buyers,
      // app/api/listings). token.id is only set in the `if (user)` branch at
      // sign-in and can be missing/stale on later requests. Anchor token.id to
      // token.sub so server pages (which read token.id) never diverge from API
      // routes (which read token.sub). This keeps dashboard counts and list
      // pages in agreement.
      token.id ??= token.sub
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Resolve to the same id used by API routes / on created rows.
        session.user.id = (token.id ?? token.sub) as string
        session.user.role = token.role as "AGENT" | "BUYER"
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
