# Measuring a module's clip offset

Every module mockup renders its own copy of the QA sidebar. The platform owns the
sidebar, so each module's is pushed out of view by offsetting its iframe left by
`clipLeft` pixels. That number has to match the module's real sidebar width.

**Measure it. Never infer it from a sibling.** Four different widths are in use
across ten modules, and two screens in the *same repository* can differ — the
production repo has one screen at 212px and two at 0.

| Width | Where it comes from |
| ----- | ------------------- |
| 256 | Tailwind ports of the real app (`w-64`) |
| 250 | Hand-rolled CSS shells |
| 212 | The recipe screen's narrower rail |
| 0 | Screens with no sidebar at all — mobile mockups, wiring hubs, standalone workspaces |

## How

Open the destination URL directly (not inside the platform) at a desktop width,
and run this in the console:

```js
Array.from(document.querySelectorAll('aside, [class*="sidebar"]'))
  .filter(e => { const r = e.getBoundingClientRect();
                 return r.height > 300 && r.left < 40 && r.width < 400; })
  .map(e => ({ cls: e.className, w: Math.round(e.getBoundingClientRect().width) }));
```

An empty result means the screen has no sidebar — use `0`.

If more than one element matches, take the **outermost** one (the wrapper, not the
inner `nav`); the wrapper is what occupies the layout.

## Checking the result

Load the route in the platform and look at the left edge of the content area:

- **A sliver of the module's own sidebar is visible** → `clipLeft` is too small
- **Content is cut off on the left** → `clipLeft` is too large
- **Content starts flush against the platform sidebar** → correct

One warning from experience: the browser screenshot pipeline frequently returns a
**stale frame** right after an iframe navigates, which looks exactly like a blank
or broken module. Force a repaint before trusting a screenshot:

```js
document.body.style.opacity = '0.999';
document.body.offsetHeight;
document.body.style.opacity = '';
```

Four separate "broken" modules during the initial build were this artifact and
nothing else.

## Known limitation

Clipping shifts the module's viewport origin, so a dialog the module centres on
its own viewport lands `clipLeft / 2` pixels left of the visible centre. It is
noticeable on modules with large modals and harmless everywhere else.

The real fix is for each module to support an `?embed=1` parameter that hides its
own sidebar, which would let the platform set `clipLeft: 0` and leave the module's
own centring intact. That needs a change in each module's repository, so it is not
done here.
