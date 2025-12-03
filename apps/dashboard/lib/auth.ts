import { Elysia } from "elysia";
import { clerkPlugin } from "elysia-clerk";

export function privateSubrouter(prefix: string) {
  return new Elysia({ prefix }).use(clerkPlugin()).resolve(({ auth, set }) => {
    const authResult = auth();
    if (!authResult.userId) {
      set.status = 401;
      throw {
        error: {
          code: "unauthorized",
          message: "Unauthorized",
        },
      };
    }
    return { userId: authResult.userId };
  });
}

