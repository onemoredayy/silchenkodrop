// Steam OpenID 2.0 — без сторонних библиотек
const OPENID = "https://steamcommunity.com/openid/login";

export function steamLoginUrl(returnTo: string, realm: string) {
  const p = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${OPENID}?${p.toString()}`;
}

// Проверяем ответ у самого Steam и достаём SteamID64
export async function verifySteamResponse(query: URLSearchParams, expectedReturnTo: string) {
  if (query.get("openid.mode") !== "id_res") return null;
  const returnTo = query.get("openid.return_to") || "";
  if (!returnTo.startsWith(expectedReturnTo)) return null;

  const body = new URLSearchParams();
  query.forEach((v, k) => {
    if (k.startsWith("openid.")) body.set(k, v);
  });
  body.set("openid.mode", "check_authentication");

  const res = await fetch(OPENID, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!/is_valid\s*:\s*true/.test(text)) return null;

  const m = (query.get("openid.claimed_id") || "").match(
    /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/,
  );
  return m ? m[1] : null;
}

// Ник и аватар. Если есть ключ API — через API, иначе из открытого XML-профиля (ключ не нужен).
export async function fetchSteamProfile(steamId: string) {
  const key = process.env.STEAM_API_KEY;
  if (key) {
    try {
      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        response?: { players?: { personaname?: string; avatarfull?: string }[] };
      };
      const p = json.response?.players?.[0];
      if (p) return { username: p.personaname ?? null, avatar: p.avatarfull ?? null };
    } catch {}
  }
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, { cache: "no-store" });
    const xml = await res.text();
    const tag = (t: string) => {
      const m = xml.match(new RegExp(`<${t}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${t}>`));
      return m ? m[1].trim() : null;
    };
    return { username: tag("steamID"), avatar: tag("avatarFull") };
  } catch {
    return null;
  }
}
