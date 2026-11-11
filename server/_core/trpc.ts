import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || !ctx.user.isActive) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول للمتابعة" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const roleProcedure = (role: "admin" | "teacher" | "student") =>
  t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (!ctx.user || !ctx.user.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول للمتابعة" });
      }
      if (ctx.user.role !== role) {
        throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية لهذا الإجراء" });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    })
  );

export const adminProcedure = roleProcedure("admin");
export const teacherProcedure = roleProcedure("teacher");
export const studentProcedure = roleProcedure("student");
