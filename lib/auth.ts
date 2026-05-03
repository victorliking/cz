import { prisma } from "@/lib/prisma"

/**
 * Simple auth for v1: reads `?as=user_<id>` from URL search params.
 * Returns the user object or null.
 */
export async function getSession(searchParams: { as?: string }) {
  const userId = searchParams.as
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { buyerProfile: true },
  })

  return user
}
