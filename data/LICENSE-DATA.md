# Data licences

The code in this repository is MIT licensed (see `LICENSE`). The data Hoist
ships is built from these sources by `pnpm data`, under their own licences.

| Data | Source | Licence | Where it ends up |
|---|---|---|---|
| Country names, aliases, translations, regions | [mledoze/countries](https://github.com/mledoze/countries) 5.1.0 | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | `src/lib/data/countries.json`, `translations.json` |
| Flags | [Wikimedia Commons](https://commons.wikimedia.org/) | Mostly public domain; each file's licence and author are in `src/lib/data/flags.json` and on its flag page | `static/flags/` |
| Capitals and largest cities | [GeoNames](https://www.geonames.org/) `cities1000` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | `src/lib/data/countries.json` |
| Country shapes | [Natural Earth](https://www.naturalearthdata.com/) 5.1.2, Admin 0 countries 1:10m | Public domain | `static/geo/` |
| Corrections | This repository, `data/overrides.json` (each with a source) | ODbL 1.0, as part of the derived database | `src/lib/data/countries.json` |

## ODbL

`src/lib/data/countries.json` and `src/lib/data/translations.json` are a
derived database of mledoze/countries and are made available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Any rights in individual contents of the database are licensed under the
[Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/).

## Attribution

- Country data: © mledoze/countries contributors, ODbL.
- Cities: GeoNames (geonames.org), CC BY 4.0.
- Flags: Wikimedia Commons contributors; see each flag's page.
- Shapes: Made with Natural Earth.
