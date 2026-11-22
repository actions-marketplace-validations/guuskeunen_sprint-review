# Benchmark: anthropic claude-sonnet-5-5

Average **98/100** over 3 cases.

| Case | Score | Themes covered | Plumbing in front | Under the hood | Forbidden | Dropped | Corrected | Warnings | Words/point |
|---|---|---|---|---|---|---|---|---|---|
| bike-shop | **95** | 5/5 | 0 | 2/2 | 0 | 0 | 4 | 2 | 10.1 |
| billing-saas | **100** | 5/5 | 0 | 2/2 | 0 | 0 | 5 | 0 | 7.8 |
| cli-library | **100** | 5/5 | 0 | 2/2 | 0 | 0 | 3 | 0 | 9.4 |

Score: coverage of the expected themes 50, no plumbing on the front slides 15, plumbing under the hood 10, nothing forbidden 15, few warnings from the second reader 10.

After three prompt changes (close-ups for screenshots, one message per title, the commit log fitted to the input). Before: 100/100 on 2026-11-21. Bike-shop ran three times: 95, 98, 98. Usually one line the second reader stumbles on is left, and points are about 1.3 words longer (9.6 against 8.3). Every theme is still covered, with nothing in front that belongs under the hood and nothing forbidden.
