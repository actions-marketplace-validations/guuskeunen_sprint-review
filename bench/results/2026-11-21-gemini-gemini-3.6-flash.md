# Benchmark: gemini gemini-3.6-flash

Average **93/100** over 3 cases.

| Case | Score | Themes covered | Plumbing in front | Under the hood | Forbidden | Dropped | Corrected | Warnings | Words/point |
|---|---|---|---|---|---|---|---|---|---|
| bike-shop | **90** | 5/5 | 0 | 0/2 | 0 | 0 | 5 | 0 | 8.6 |
| billing-saas | **90** | 5/5 | 0 | 0/2 | 0 | 0 | 0 | 0 | 8.6 |
| cli-library | **100** | 5/5 | 0 | 2/2 | 0 | 0 | 0 | 0 | 8.1 |

### bike-shop

- Not under the hood: vite upgrade, playwright cache in CI

### billing-saas

- Not under the hood: framework upgrade, database move

Score: coverage of the expected themes 50, no plumbing on the front slides 15, plumbing under the hood 10, nothing forbidden 15, few warnings from the second reader 10.
