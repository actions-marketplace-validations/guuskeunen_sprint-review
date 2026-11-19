# FAQ

### Does it send my code to an AI?
No. It sends commit messages and file names of the sprint, plus your product description. Never source code, diffs, screenshots or usage numbers. See [what is sent](how-it-works.md#what-is-sent-to-the-ai).

### Which AI does it use?
Anthropic's Claude, through your own API key. The model is a setting. Other providers are on the roadmap, and with the library you can plug in any model yourself ([custom model client](library.md#your-own-model-client)).

### What does it cost?
Two API calls per review, on your own Anthropic account. `--dry-run` shows the token estimate before you spend anything.

### Can it make things up?
It's built so it can't get away with it. Every point must name real commits from the sprint, or it's dropped. Numbers come from your files, never from the AI. Pictures can only be screenshots that exist. And a second AI reads the result like your audience would. A person still reads the draft before it's presented.

### My commit messages are bad. Will it still work?
Better messages give better slides, but it copes: it also reads the changed file names, and Conventional Commit prefixes help it sort tooling from product work. Pull request descriptions as extra context are next on the roadmap.

### Do I need Conventional Commits?
No. They help (a `ci:` commit is never a theme), but anything works.

### Does it work with monorepos?
Yes. Set `productPaths` to the folders that hold product code, such as `apps/web/src/`.

### Can I use it for release notes instead of sprints?
Yes: `--from v1.4.0 --to v1.5.0`. `review.md` works well as release notes.

### Which languages?
The AI writes the content in any language. Slide labels ship in English and Dutch; override them for others.

### Can I use my company's slide template?
The deck uses your color and logo today. Taking colors, fonts and logo from an existing PowerPoint, and exporting into your own template, are on the roadmap.

### Is there a hosted version?
No, on purpose. It runs where your code is, with your key, and produces a file. Nothing to sign up for, nothing to host.

### What does the deck need to open?
Any modern browser. No internet: everything is inside the one file.

### Can I edit the deck in PowerPoint or Keynote?
Not directly. Edit `review.json` and render again, or print to PDF and import that. PowerPoint export is on the roadmap.

### Is it free?
The tool is free and open source (MIT). You pay Anthropic for the API calls.
