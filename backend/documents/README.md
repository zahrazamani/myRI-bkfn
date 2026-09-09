# Corpus files

`ingest.py` reads everything here into the Chroma vector store. One folder per
bot corpus; `noor/` holds the shared Tafsir al-Mizan database.

| Path | In git? | Bot corpus | Notes |
|---|---|---|---|
| `journey/Andisheye_islami1.pdf` | yes | journey-beliefs | Islamic Thought 1 |
| `journey/Andisheye_Islami2_eng.pdf` | yes | journey-beliefs | Islamic Thought 2 |
| `journey/Shia in Islam.pdf` | yes | journey-beliefs | Tabataba'i |
| `journey/divine_justice.pdf` | yes | journey-beliefs | Mutahhari, *'Adl-e Ilahi* |
| `journey/man_and_his_destiny.pdf` | yes | journey-beliefs | Mutahhari |
| `compass/english-islamic-laws-4th-edition.pdf` | yes | my-compass | Sistani, *Islamic Laws* 4th ed. |
| `compass/islamic-laws-sistani-en.pdf` | yes | my-compass | *A Code of Practice for Muslims in the West* |
| `superhero/jami-al-saadat-en.pdf` | yes | superhero-universe | Naraqi, *Jami' al-Sa'adat* (abridged) |
| `noor/tafsir_almizan_en.db` | **NO** (`*.db` gitignored, ~29 MB) | `tafsir` tag — read by journey-beliefs, daily-dialogue, guardians-club | SQLite: `content`, `muqadimah`, `ayah_mapping` tables. Must be placed here manually on every fresh checkout / deploy. |

## Adding a book

1. Drop the PDF in the right folder.
2. Add a clean title/author entry to `PDF_SOURCES` in `ingest.py` (otherwise the
   citation falls back to the file name).
3. `./venv/bin/python ingest.py` and restart the server.

## Tafsir al-Mizan database

Not committed because of its size. Options if you need it reproducible:
- keep a copy in object storage / a release asset and `curl` it in at deploy time, or
- `git add -f backend/documents/noor/tafsir_almizan_en.db` to commit it (~29 MB,
  well under GitHub's 100 MB limit) if you'd rather it just be there.
