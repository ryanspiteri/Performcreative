# TODOS

## Style filtering on People Library grid
Once people have style metadata (style column added in people generator enhancement), add a filter dropdown to the People Library grid view to filter by style (UGC, professional, lifestyle, gym-selfie). Also consider filtering by productName.

**Context:** The `people` table now has `style` and `productName` columns populated during AI generation. The grid currently shows all people unfiltered. As the library grows, filtering by generation style will help users find the right reference person faster.

**Where to start:** `client/src/pages/PeopleLibrary.tsx` — add a filter bar above the grid, query the `style` field from the existing `trpc.people.list` response.
