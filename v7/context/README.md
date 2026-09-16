# Why v7 is like this

These are **reading copies**. The ledgers in `exagon-ai/foodbridge-pmf` are the
source, and they may have gained occurrences or decisions since this was carried
over on 16 September 2026.

They are here because a build without its reasoning is a build nobody can argue
with. The decision records in particular keep **what was rejected** alongside what
was chosen — that is the half that never survives in code, and the half that
answers "why isn't it just…?".

| File | What it is |
| --- | --- |
| `OPPORTUNITY-O-001.md` | the job somebody decided to design for |
| `LEARNING-L-012-L-013.md` | the learning it exists because of. A learning is one claim plus every dated occurrence underneath it; both are kept |
| `DECISIONS-D-012-to-D-019.md` | eight decisions, with their rejected alternatives |
| `TIMELINE.md` | product history, append-only. A reversed decision keeps both entries |
| `STATUS.md` | what is real, what is simulated, what is known broken on purpose, and the capability matrix — what the evidence permits, which is a different question from what the product has |
| `PROVENANCE.md` · `CHANGELOG.md` · `MASTER.md` | where the files came from |
| `VERSION-pmf.md` | the PMF-side version document, verbatim |

## Inert here

`version.json` and `releases/` are **not machinery in this repository**. They are
PMF lifecycle state and release manifests, and the commit shas they name refer to
`exagon-ai/foodbridge-pmf` — nothing here can rebuild from them. They are kept as
evidence of what was published and when, not as something to run or edit.
