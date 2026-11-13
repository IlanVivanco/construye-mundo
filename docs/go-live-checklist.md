# Go-live checklist

Run this before publishing new content or pushing an edit to a published page, through the `qa-page` skill: its
script checks status, robots, head tags, headings, overflow and screenshots at every breakpoint, images, console
errors, internal links, forbidden hosts and text, and accessibility. Then work through the list below. Check the
rendered page, not only the stored data.

QA settings (`.claude/settings.json` → `env`): widths 390, 1024, 1366, 1440 (adjust to the site's active
breakpoints once `discover-design-system` has run); forbidden text "Lorem ipsum". For real content also pass
`--forbid-text "[AI TEST]" --expect-robots index`; for test content `--expect-robots noindex`. Reports go to
`artifacts/qa/`.

## All content

**Copy**
- [ ] No leftover placeholder or `[AI TEST]` text in real content.
- [ ] Facts, numbers, and names are confirmed or flagged to the reviewer.
- [ ] Internal links point to live URLs (no `?p=` draft links); external links open the right page.

**SEO**
- [ ] SEO title and meta description set; Open Graph title, description, and image set.
- [ ] Robots `index, follow` for real content; `noindex, nofollow` only for test content.

**Render**
- [ ] Page returns 200 for logged-out visitors once published; drafts were reviewed through a preview link.
- [ ] Screenshots at every QA width reviewed; no overflow, missing icons, or empty sections.
- [ ] Elementor pages: the front end shows the new copy. If it shows old copy, clear the document cache.

**Hand-off**
- [ ] Reviewer gets the front URL, the edit URL, and a list of anything unconfirmed.
- [ ] Publish only with the requester's go-ahead for this item.
