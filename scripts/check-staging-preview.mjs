import { verifyStagingPreview } from './staging-preview.mjs';

const result = await verifyStagingPreview({
  url: process.env.STAGING_PREVIEW_URL,
  commit: process.env.STAGING_PREVIEW_SHA,
});
console.log(`PASS: Preview ${result.commit.slice(0, 12)} has its staging build result, serves the public catalog, and denies anonymous access to private routes.`);
