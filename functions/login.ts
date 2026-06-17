import loginHandler from "../netlify/functions/login";
import { envStorage } from "../src/server/runtime-env";

interface PagesContext {
  request: Request;
  env: Record<string, string>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  return envStorage.run(context.env, () => {
    return loginHandler(context.request);
  });
};
