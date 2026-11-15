# PLAN-IT

A coming-soon site and early-access waitlist for the IIT Patna student travel project.

## Project layout

- `public/` contains the responsive landing page, brand assets and signup form.
- `api/waitlist.js` is the Vercel Function for signup and the aggregate count.
- The waitlist uses the private Vercel Blob store `plan-it-iitp-waitlist`, connected to the production environment of `bitrunners/plan-it-iitp`.

To preview the static page locally, run `python3 -m http.server 3000 --bind 127.0.0.1 --directory public`. For a working signup in another Vercel environment, connect a separate private Blob store to that environment before deploying or running `vercel dev`.

## Managing the waitlist

In the Vercel project dashboard, open **Storage → plan-it-iitp-waitlist**. The private JSON records under `waitlist/` contain the email, first selected interest, and signup timestamp. The public GET endpoint returns only the number of records. Each normalized email gets one record, so repeat signups preserve the original choice and count.

To locate a specific record for a deletion request, trim and lowercase the email, compute its SHA-256 hex digest, and find `waitlist/<digest>.json` in the private store. Access to the store is managed in Vercel. This site records consent for launch updates. The team handles outreach separately.

## Content and imagery

The 23-response statistic comes from the supplied problem-identification report, which ties the percentages to respondent counts. The value proposition canvas lists a different survey sample size. The lean canvas sets Rajgir and Gaya as the first pilots. Later destinations and product features are presented as planned.

The hero photo was generated with the built-in image tool for this site. The brief was a portrait editorial photograph of four Indian college friends with daypacks overlooking Himalayan foothills at golden hour, in warm orange and dusky teal, with space for site overlays.
