# СильченкоДроп

Кейсы CS2 для своих. Next.js 14, Prisma + SQLite, вход через Steam OpenID.

## Локально

```bash
npm install
cp .env.example .env          # вписать SESSION_SECRET
npm run db:push && npm run db:seed
npm run dev                   # http://localhost:3000
```

`db:seed` качает каталог скинов и цены, создаёт блоки кейсов и все 42 обычных кейса CS с настоящими шансами. Первый вошедший через Steam становится админом.

## На хостинге (VPS, Ubuntu)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

git clone https://github.com/onemoredayy/silchenkodrop.git && cd silchenkodrop
cp .env.example .env && sed -i "s/SESSION_SECRET=\"\"/SESSION_SECRET=\"$(openssl rand -hex 32)\"/" .env
npm ci
npm run db:push && npm run db:seed
npm run build
pm2 start npm --name silchenkodrop -- start && pm2 save && pm2 startup
```

Перед сайтом — Caddy (сам получает HTTPS-сертификат). `/etc/caddy/Caddyfile`:

```
твой-домен.ru {
    reverse_proxy localhost:3000
}
```

Адрес сайта для входа через Steam определяется по запросу, прописывать его не нужно.

### Цены со Steam Market

Обновляются сами: сайт раз в 6 часов скачивает цены всех предметов Steam одним файлом
(prices.csgotrader.app — база расширения CSGO Trader) и переводит доллары в рубли по курсу ЦБ.
Cron не нужен. Вручную: кнопка в админке или `npm run prices:update`.

Блок «Шелупонь» (наклейки, значки, нашивки и кейс со всякой всячиной) сайт создаёт сам при первом
запуске: докачивает эти предметы в каталог и собирает кейсы по ценам Steam. Цены и состав потом
правятся в админке, повторно сайт их не трогает.

Каталог — все скины CS2 в каждом качестве и StatTrak (~30 тыс. предметов, ByMykel/CSGO-API).
После крупного обновления CS: `npm run catalog:import`.

### Обновление сайта

```bash
git pull && npm ci && npm run db:push && npm run build && pm2 restart silchenkodrop
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | разработка |
| `npm run build` / `npm start` | сборка и запуск |
| `npm run db:push` | применить схему к базе |
| `npm run db:seed` | каталог, кейсы, настройки |
| `npm run db:reset` | стереть базу и наполнить заново |
| `npm run catalog:import` | обновить каталог скинов |
| `npm run prices:update` | обновить порцию цен |

## Устройство

- Вход: `lib/steam.ts`, `app/api/auth/steam/*`; сессия — подписанная кука (`lib/session.ts`).
- Выпадение считается на сервере (`lib/rng.ts`, crypto.randomInt), списание атомарное, лимит частоты открытий.
- `middleware.ts` закрывает `/admin`, `/inventory`, `/balance`, `/profile`; роль админа проверяется в каждом действии админки.
- Пополнение баланса — заглушка (`app/balance/actions.ts`), вывод скинов не сделан.
