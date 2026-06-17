import { onRequest as __api_send_report_ts_onRequest } from "C:\\Projects\\Domi\\functions\\api\\send-report.ts"
import { onRequest as __api___path___ts_onRequest } from "C:\\Projects\\Domi\\functions\\api\\[[path]].ts"
import { onRequest as __t___path___ts_onRequest } from "C:\\Projects\\Domi\\functions\\t\\[[path]].ts"
import { onRequest as __callback_ts_onRequest } from "C:\\Projects\\Domi\\functions\\callback.ts"
import { onRequest as __inbound_email_ts_onRequest } from "C:\\Projects\\Domi\\functions\\inbound-email.ts"
import { onRequest as __login_ts_onRequest } from "C:\\Projects\\Domi\\functions\\login.ts"
import { onRequest as __logout_ts_onRequest } from "C:\\Projects\\Domi\\functions\\logout.ts"

export const routes = [
    {
      routePath: "/api/send-report",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_send_report_ts_onRequest],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___ts_onRequest],
    },
  {
      routePath: "/t/:path*",
      mountPath: "/t",
      method: "",
      middlewares: [],
      modules: [__t___path___ts_onRequest],
    },
  {
      routePath: "/callback",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__callback_ts_onRequest],
    },
  {
      routePath: "/inbound-email",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__inbound_email_ts_onRequest],
    },
  {
      routePath: "/login",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__login_ts_onRequest],
    },
  {
      routePath: "/logout",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__logout_ts_onRequest],
    },
  ]