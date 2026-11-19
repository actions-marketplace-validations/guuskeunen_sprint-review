# Extras

- `marketplace-action/`: the contents of the `guuskeunen/sprint-review-action` repository, which lists the GitHub Action on Marketplace. Marketplace doesn't allow workflow files in an action's repository, and this one has CI, so the listing lives in a tiny separate repository that calls `guuskeunen/sprint-review@v0`. Copy these three files into it, tag `v0` and `v0.1.0`, and publish the release to Marketplace.
