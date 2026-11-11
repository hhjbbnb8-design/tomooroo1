import { createUser, ensureSchool, getUserByUsername, deleteExpiredSessions } from "./db";
import { hashPassword } from "./auth";

type SeedAccount = {
  name: string;
  username: string;
  password: string;
  role: "admin" | "teacher" | "student";
  schoolSlug?: string;
};

const SEED_ACCOUNTS: SeedAccount[] = [
  { name: "Ahmed Admin", username: "admin", password: "Admin@1234", role: "admin" },
  {
    name: "Khalid Alharbi",
    username: "teacher",
    password: "Teacher@1234",
    role: "teacher",
    schoolSlug: "tomorrow",
  },
  {
    name: "Salman Alotaibi",
    username: "student",
    password: "Student@1234",
    role: "student",
    schoolSlug: "tomorrow",
  },
];

let seedPromise: Promise<void> | null = null;

async function runSeed() {
  const tomorrow = await ensureSchool("Tomorrow School", "tomorrow");
  const schoolBySlug: Record<string, number> = {
    tomorrow: tomorrow.id,
  };

  for (const account of SEED_ACCOUNTS) {
    const existing = await getUserByUsername(account.username);
    if (existing) continue;
    const passwordHash = await hashPassword(account.password);
    await createUser({
      name: account.name,
      username: account.username,
      passwordHash,
      role: account.role,
      schoolId: account.schoolSlug ? schoolBySlug[account.schoolSlug] : null,
      isActive: true,
    });
    console.log(`[Seed] Created ${account.role} account: ${account.username}`);
  }

  await deleteExpiredSessions();
}

/** Initializes seed data once and does not recreate manually deleted accounts. */
export function ensureSeedData() {
  if (!seedPromise) {
    seedPromise = runSeed().catch(error => {
      console.error("[Seed] Failed:", error);
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}
