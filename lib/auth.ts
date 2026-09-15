import { NextAuthOptions } from "next-auth";
import { encode as defaultEncode } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB, User, Settings } from "@/lib/mongodb";

// Session length is admin-configurable (Settings.sessionTimeoutMinutes), so the static
// NextAuth `maxAge` below is only a fallback — the real value is read fresh (with a short
// cache) inside the custom `jwt.encode` override.
let cachedTimeoutSeconds = 60 * 60;
let cachedAt = 0;

async function getSessionTimeoutSeconds() {
  if (Date.now() - cachedAt < 30_000) return cachedTimeoutSeconds;
  try {
    await connectDB();
    const settings = await Settings.findOne({ singleton: true }).select("sessionTimeoutMinutes").lean();
    cachedTimeoutSeconds = (settings?.sessionTimeoutMinutes ?? 60) * 60;
    cachedAt = Date.now();
  } catch {
    // DB unavailable — keep the last known value
  }
  return cachedTimeoutSeconds;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,      // fallback JWT lifetime; actual value comes from jwt.encode below
    updateAge: 15 * 60,   // Refresh JWT every 15 minutes if active
  },
  jwt: {
    encode: async ({ token, secret }) => {
      const maxAge = await getSessionTimeoutSeconds();
      return defaultEncode({ token, secret, maxAge });
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // No maxAge → session cookie → deleted when browser closes
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await connectDB();

        const user = await User.findOne({
          email: credentials.email.toLowerCase(),
          isActive: true,
        }).lean();

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      // Re-fetch role from DB so permission changes take effect without re-login
      if (token.id) {
        try {
          await connectDB();
          const fresh = await User.findById(token.id).select("role isActive").lean();
          if (fresh) token.role = fresh.role;
        } catch {
          // DB unavailable — keep existing token data, don't crash the request
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose id and role on the client-side session object
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
