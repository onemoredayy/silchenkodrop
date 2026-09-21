import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const POST = handlers.POST;

// Steam использует OpenID 2.0 и не присылает OAuth-параметр "code".
// Новый Auth.js без него не идёт дальше, поэтому для callback
// Steam добавляем параметр-пустышку. Настоящая проверка
// выполняется в пакете запросом check_authentication в Steam.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const isSteamCallback =
    url.pathname.endsWith("/callback/steam") &&
    url.searchParams.has("openid.mode") &&
    !url.searchParams.has("code");

  if (isSteamCallback) {
    url.searchParams.set("code", "steam-openid");
    return handlers.GET(new NextRequest(url, req));
  }
  return handlers.GET(req);
}
