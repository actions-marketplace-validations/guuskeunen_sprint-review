# Launch checklist

The plan from "it works" to "people use it". Work top to bottom.

## Before launch

### Accounts (do these now, so they're a few weeks old by launch day)
- [ ] **GitHub:** turn on two-factor authentication (Settings → Password and authentication). Required for the Marketplace.
- [ ] **npm:** sign up at npmjs.com as **guuskeunen** (the scope `@guuskeunen` has to match), turn on two-factor.
- [ ] **Hacker News:** create an account and take part normally for a few weeks: comment, upvote. A brand-new account posting its own project can look like spam.
- [ ] **Product Hunt:** create an account, fill in the profile, follow a few makers.
- [ ] **Reddit** and **dev.to:** accounts for the launch posts.

### The repository
- [ ] Settings → General → Social preview: upload `docs/assets/social-preview.png`.
- [ ] Description: *Turn a sprint's git history into a review deck anyone can follow. AI writes the words, code checks every claim.*
- [ ] Website: the live demo URL (below).
- [ ] Topics: `sprint-review`, `scrum`, `agile`, `git`, `changelog`, `release-notes`, `presentation`, `ai`, `claude`, `github-actions`, `cli`.
- [ ] Settings → Pages → Deploy from a branch → `main`, folder `/docs`. The demo is then at **https://guuskeunen.github.io/sprint-review/demo/**. Check that the README link works.
- [ ] Issue labels: `good first issue`, `help wanted`, `idea`. Open three or four `good first issue`s from the roadmap (a German label set, a French label set, a GitLab CI example).
- [ ] Turn on Discussions for questions and ideas.

### First release
- [ ] Test it on two or three real repositories, including one with screenshots. Fix what feels rough.
- [ ] `npm run build && npm test`
- [ ] `npm publish` (asks for your two-factor code).
- [ ] `git tag v0.1.0 && git tag v0 && git push --tags`
- [ ] Draft a GitHub release from `v0.1.0`, paste the changelog, tick **Publish this Action to the GitHub Marketplace**, category *Utilities* (second: *Project management*). Accept the Marketplace terms.
- [ ] Check that `npx @guuskeunen/sprint-review --help` works from a clean folder.

### Launch content
- [ ] A 60 to 90 second video: the ugly commit log, one command, the deck clicking through, the before and after wipe. Upload it to YouTube and embed it in the README.
- [ ] A blog post on Beehiiv: the "AI writes, code checks" story. It's ready from the earlier write-up.

## Launch day

Pick a Tuesday, Wednesday or Thursday. Post the Show HN in the morning US Eastern time (afternoon in the Netherlands), and stay around for the rest of the day to answer every comment.

### Show HN
**Title** (80 characters max):
> Show HN: Sprint-review – turn git history into a sprint review deck, claims checked

**Text:**
> Every sprint someone spends half a day turning commits like "refactor(planner): optimize status count queries" into slides that marketing understands. I built a CLI and GitHub Action that does it in a minute.
>
> The part I care about most: the AI only writes words. Every point has to name real commit hashes from the sprint or it's dropped in code. Word limits, ticket numbers, exclamation marks and the numbers are all handled in code, and a second model call reads only the slide text the way a non-technical colleague would and flags what's unclear. It reuses screenshots from your visual tests for before and after slides, so no customer data.
>
> Output is one self-contained HTML deck (presenter mode, prints to PDF), an editable JSON file and a check log. MIT, BYO Anthropic key, nothing hosted.
>
> Demo deck: https://guuskeunen.github.io/sprint-review/demo/
>
> I'd love feedback on the checks. What would you want it to refuse to write?

### Product Hunt
- **Name:** sprint-review
- **Tagline** (60 characters max): *Sprint review decks from git history, claims checked*
- **Description:** *One command turns your sprint's commits into a polished review deck your whole company can follow. AI writes the words, code checks every claim, and real before and after screenshots come from your own tests. Free and open source.*
- **Gallery:** the social preview, the GIF, three slides (cover, a theme with a screenshot, before and after), the check log.
- **First comment:** why you built it (half a day every sprint, the marketing colleague who finally understood), and what's next.

### Reddit
One post per subreddit, adjusted to each, with the story first and the link second. Read each subreddit's rules on self-promotion before posting.
- r/scrum, r/agile: the problem of reviews nobody outside engineering follows.
- r/ExperiencedDevs: the design, "AI writes, code checks".
- r/node, r/javascript: the CLI and the library.
- r/github: the Action.

### LinkedIn
> Every sprint, our developers spent half a day building the review deck. Now it builds itself in a minute, and our project manager said: "I finally understand what the developers did."
>
> I turned it into an open source tool: sprint-review. One command reads the sprint's commits and builds a deck anyone can follow. The AI only writes the words. Every claim has to point at a real change, or code throws it out.
>
> Free, MIT, runs in your own GitHub. Link in the comments.

### Also
- [ ] dev.to article: "Why I don't let the AI build the whole presentation".
- [ ] Pull requests to awesome lists: *awesome-actions*, *awesome-scrum*, *awesome-cli-apps*, *awesome-claude* (read each list's contributing rules).
- [ ] Post in the Anthropic and Claude communities you're in.

## After launch
- [ ] Answer every issue within a day for the first weeks.
- [ ] Ship the most-asked feature as v0.2 within two weeks, and mention the people who asked for it in the release.
- [ ] Next up from the roadmap: pull request descriptions as context, the revision pass, brand from a `.pptx`.
