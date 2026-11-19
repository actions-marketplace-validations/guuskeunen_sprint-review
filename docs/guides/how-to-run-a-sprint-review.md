# How to run a sprint review that people want to attend

A sprint review is where the team shows what it delivered and the people it delivers for react. In Scrum it's the second-to-last event of the sprint, before the retrospective. It's often the only moment the business, sales or management see the product move. Run well, it brings feedback that changes the next sprint. Run badly, it's a list of tickets nobody outside the team understands.

## Before: an hour of prep, not a day

1. **Collect what was done.** Merged pull requests and commits since the last review, not the sprint board's plan.
2. **Group it into a few themes.** Three to six themes the audience cares about ("customers can book repairs online"), not components ("refactor booking API").
3. **Say what each theme means for them.** One sentence of effect per theme: faster, fewer mistakes, less manual work, less risk, more insight.
4. **Show it.** A screenshot or a short live demo per theme. Before and after beats any description.
5. **Put plumbing in one place.** Dependency upgrades, CI and tests matter, but they belong on one *under the hood* slide.
6. **Add the bigger picture.** Where are you on the roadmap, and what moved in usage?

Steps 1 to 6 are what [sprint-review](https://github.com/guuskeunen/sprint-review) automates: it reads the git history, writes the themes in your audience's language, checks every line against the real commits, finds the screens that changed, and builds the deck.

## During: 30 to 60 minutes

- **Open with the sprint goal** and whether you reached it.
- **Demo, don't read.** The slide is the headline; the product is the story. Keep speaker notes for what to click.
- **Ask a question per theme.** "Would this change how you book a repair?" gets more useful feedback than "Any questions?"
- **Write down feedback as it comes.** It's input for the backlog.
- **End with what's next.** One slide: what the next sprint will likely pick up.

## After

- Share the deck and a short summary in the channel where the business lives.
- Turn feedback into backlog items before the next planning.

## Common mistakes

| Mistake | Instead |
|---|---|
| Showing ticket numbers and branch names | Plain-language themes and effects |
| Demoing everything | Three to six themes; the rest under the hood |
| A status meeting | Something to react to: working software |
| Slides prepared at the last minute | Generated from git before review day ([how](https://github.com/guuskeunen/sprint-review/blob/main/docs/github-action.md)) |

## Sprint review or retrospective?

The **sprint review** looks at the *product*: what was built, with the people it's for. The **retrospective** looks at the *way of working*, with the team only, right after. Different audiences, different questions; don't merge them.
