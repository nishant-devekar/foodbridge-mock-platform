# Why v7 is like this

A build without its reasoning is a build nobody can argue with. These are the
records the flow was designed from.

**They are historical.** They were copied out of `exagon-ai/foodbridge-pmf` on 16
September 2026, when v7 was opened, and they are frozen at that moment. v7 does
not read from that repository and is not updated by it.

**New reasoning goes in [`../VERSION.md`](../VERSION.md)**, in the dated change
log — that is this repository's convention and, with no release machinery here,
the only place it survives. Do not edit the records below to reflect a new
decision; they are what was decided *then*, and a decision that reversed one of
them is worth more when both are visible.

| File | What it is |
| --- | --- |
| `OPPORTUNITY-O-001.md` | the job somebody decided to design for |
| `LEARNING-L-012-L-013.md` | the learning it exists because of. A learning is one claim plus every dated occurrence underneath it; both are kept |
| `DECISIONS-D-012-to-D-019.md` | eight decisions, each with the alternatives that were rejected |
| `TIMELINE.md` | how it got built, append-only, up to the carry-over |
| `STATUS.md` | what is real, what is simulated, what is known broken on purpose — and the capability matrix: what the evidence *permits*, which is a different question from what the product has |
| `PROVENANCE.md` · `CHANGELOG.md` · `MASTER.md` | where the files came from |
| `VERSION-pmf.md` | the origin repository's version document, verbatim |

## The four rules the flow was built under

Worth reading the decisions behind these before changing a screen, because each
one was argued and each has a rejected alternative that looked reasonable:

1. **Must-have only on primary screens** (`D-018`). Every visible element explains
   the state, supports the decision, or enables the action — or it moves to a
   sheet. Eleven elements were moved and seven cut, most of them copy added in
   earlier passes to make screens feel considered.
2. **Nothing consequential starts on its own** (`D-018`). A source opens consent.
   Rejected: a tap on a logo beginning a read.
3. **Absent, never zero** (`D-012`, `D-015`). Rejected: rendering a blocked signal
   as ₹0, greyed, or estimated; and borrowing another tenant's numbers.
4. **A recommendation is never a pre-made choice** (`D-017`, `D-018`). Lists
   arrive with nothing selected.

## Inert here

`version.json` and `releases/` are **not machinery in this repository**. They are
the origin repository's lifecycle state and release manifests, and the commit
shas they name refer to `exagon-ai/foodbridge-pmf` — nothing here can rebuild from
them. They are kept as a record of what that repository published, and should not
be edited or maintained.
