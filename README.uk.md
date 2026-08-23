# @warpgogol/werkstatt-shared

Українська | [English](README.md)

Спільна інфраструктура, незалежна від стеку, витягнута з `werkstatt-site` (RFC-0868). Володіє доменами checks, integration, ontology, passport, share та surface, які споживають рушій Werkstatt та site-плагін.

---

## Що робить цей пакет

Це **бібліотека спільної інфраструктури**, яку використовують рушій [Werkstatt](https://www.npmjs.com/package/@warpgogol/werkstatt) та плагін `werkstatt-site`. Вона надає:

- **Checks** — валідатори контенту, SEO-валідатори, логіка surface expand/bake
- **Integration** — адаптери CRM, funnel, hub, sharding, QStash
- **Ontology** — каталоги, enum-и, типи Sternsystem owner
- **Passport** — DHT-підписування, підписування ідентичності, валідація схем
- **Share** — генерація slug-ів, семантична екстракція, канонізація URL, фільтрація маршрутів, middleware, захист доступу
- **Surface** — хелпери surface expand/bake та мітки

Цей пакет не використовується самостійно — його споживають рушій та site-плагін як залежність.

---

## Встановлення

```sh
pnpm add @warpgogol/werkstatt-shared
```

Цей пакет встановлюється автоматично при встановленні `@warpgogol/werkstatt` або `@warpgogol/werkstatt-site`.

---

## Як це вписується в екосистему Werkstatt

| Пакет | Роль |
| --- | --- |
| `@warpgogol/forge` | Шар управління — навички, RFC/ADR робочі процеси, CLI, скаффолд проєктів |
| `@warpgogol/werkstatt` | Рушій runtime — місії, релізи, розгортання, сертифікація, Bordbuch |
| `@warpgogol/werkstatt-shared` | **Цей пакет** — спільна інфраструктура (checks, integration, ontology, passport, share) |
| `@warpgogol/werkstatt-site` | Astro site-плагін — споживає цей пакет для checks, integration, ontology, passport, share |

Рушій та site-плагін імпортують з цього пакунка. Він НЕ ПОВИНЕН імпортувати з `werkstatt-site` — це контролюється `werkstatt.shared.validate`.

---

## Канонічні утиліти

### Генерація slug (RFC-0915, DNA-88)

| Експорт | Призначення |
| --- | --- |
| `slugUrl(text, lang?)` | Локалізований URL-slug (німецькі умлаути, українська транслітерація, за замовчуванням) |
| `slugId(text)` | Семантичний slug ID блоку |
| `HeadingSlugger` | Станковий дедуплікатор якорів заголовків |

```ts
import { slugUrl } from "@warpgogol/werkstatt-shared/share/slug";

const url = slugUrl("Über uns", "de"); // "ueber-uns"
```

### Семантична екстракція (RFC-0901)

| Експорт | Призначення |
| --- | --- |
| `splitSentences(text, locale?)` | Локалізоване виявлення меж речень (`de`, `uk`, `en`) |

### Канонічний URL сутності (RFC-0910)

| Експорт | Призначення |
| --- | --- |
| `canonicalRootUrl(baseUrl)` | Непрефіксований кореневий URL для JSON-LD ідентичності сутності |

### Фільтрація плейсхолдер-маршрутів (RFC-0917)

| Експорт | Призначення |
| --- | --- |
| `hasPlaceholderRoutes(routes)` | Виявлення Astro динамічних шаблонів маршрутів (`[slug]`, `[version]`) |

---

## Архітектура

| Директорія | Призначення |
| --- | --- |
| `src/index.ts` | Головний barrel-експорт |
| `src/checks/` | Валідатори контенту, SEO-валідатори, surface expand/bake |
| `src/integration/` | Адаптери CRM, funnel, hub, sharding, QStash |
| `src/ontology/` | Каталоги, enum-и, типи Sternsystem owner |
| `src/passport/` | DHT-підписування, підписування ідентичності, валідація схем |
| `src/share/` | Slug, семантика, канонізація URL, маршрути, middleware, захист доступу |
| `src/surface/` | Хелпери surface expand/bake та мітки |
| `src/content/` | Типи SystemManifest та схема контенту |

---

## Межі

- Цей пакет НЕ ПОВИНЕН імпортувати з `@warpgogol/werkstatt-site` — контролюється `werkstatt.shared.validate`.
- Цей пакет МОЖЕ імпортувати з `@warpgogol/werkstatt` (рушій) та зовнішніх пакунків.
- Axiom-залежності (`@syrokomskyi/axiom-*`) — `optionalDependencies`. Споживачі без axiom повинні використовувати type-only імпорти або охороняти runtime-доступ.

---

## Публікація в npm

Цей пакет публікується в реєстр npm як `@warpgogol/werkstatt-shared`. Публікація автоматизована через GitHub Actions CI.

### Як це працює

1. Вихідний код знаходиться в монорепозиторії [warpgogol/werkstatt](https://github.com/syrokomskyi/werkstatt) у `packages/werkstatt-shared/`.
2. [`@warpgogol/repo-extract`](https://github.com/syrokomskyi/repo-extract) витягує пакет у автономний репозиторій [syrokomskyi/werkstatt-shared](https://github.com/syrokomskyi/werkstatt-shared), вирівнюючи його до кореня репозиторію та видаляючи залежності робочого простору.
3. Згенерований GitHub Actions CI-воркфлоу запускається при кожному пуші в `main`: lint → typecheck → build → test → `npm publish --provenance --access public`.
4. Секрет `NPM_TOKEN` має бути встановлений у [налаштуваннях репозиторію](https://github.com/syrokomskyi/werkstatt-shared/settings/secrets/actions).

### Запуск нового релізу

З кореня монорепозиторію werkstatt:

```sh
# 1. Підняти версію в packages/werkstatt-shared/package.json
# 2. Запустити екстракцію (витягує + комітить + пушить в github.com:syrokomskyi/werkstatt-shared.git)
pnpm exec repo-extract --config packages/werkstatt-shared/extract.config.yaml --verbose

# 3. CI підхоплює пуш і публікує в npm автоматично
```

Після завершення CI перевірте нову версію на [npmjs.com/package/@warpgogol/werkstatt-shared](https://www.npmjs.com/package/@warpgogol/werkstatt-shared).

---

## Ліцензія

Apache-2.0
