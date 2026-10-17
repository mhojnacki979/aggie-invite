# Aggie Invitational: live scores and results

Live scoring and results for the Aggie Invitational (Texas A&M Archery), served at
https://aggieinvite.eyesonscore.com from GitHub Pages. Scores come from Eyes on Score.

## Event-day steps

1. **2026 tournament exists in EOS:** set `EVENT_2026.tournamentId`, set `CURRENT_EVENT = EVENT_2026`, and push.
2. **A line won't close** (an archer stopped mid-round on Sunday): add its key to `closedLines` and push.
3. **Shoot-off decided:** add `shootOffs: { '<EOS division name>': ['<winner>', '<runner-up>'] }` and push.
4. **After awards:** run `pnpm freeze 2026`, set `EVENT_2026.live = false`, add 2026 to `ARCHIVE`, and push.
5. **A push didn't deploy:** run `gh workflow run "Deploy to GitHub Pages" --ref main`.
