# Canva Connect API Integration

## Overview

The ONEST Creative Pipeline now integrates with Canva Connect API to automatically upload generated ad variations directly to your Canva account. This enables seamless workflow from AI-generated variations to editable Canva designs.

## Current Status

✅ **OAuth Authentication** - Working  
✅ **Asset Upload** - Working  
✅ **Design Creation** - Working  
⏳ **Canva Review** - Pending (works in development mode)

## How It Works

### 1. Connect Your Canva Account

- Navigate to Settings page
- Click "Connect Canva" button
- Authorise the integration in Canva OAuth portal
- Your Canva account is now connected

### 2. Generate Variations

- Use "Iterate Winners" to generate ad variations
- The system creates multiple variations based on your winning ad

### 3. Upload to Canva

- Generated variations can be uploaded to your Canva account
- Each variation becomes an editable Canva design
- Direct edit links provided for each uploaded design

## Technical Implementation

### OAuth Flow (PKCE)

```typescript
// 1. Generate PKCE challenge
const { verifier, challenge } = generatePKCE();

// 2. Redirect user to Canva authorization
const authUrl = getCanvaAuthUrl(redirectUri, state, challenge);

// 3. Exchange code for tokens
const tokens = await exchangeCodeForToken(code, redirectUri, verifier);

// 4. Store tokens securely in database
await db.updateUserCanvaTokens(openId, accessToken, refreshToken, expiresAt);
```

### Asset Upload (Asynchronous)

```typescript
// 1. Download image from URL
const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());

// 2. Upload to Canva (returns job ID)
const uploadJob = await uploadAssetToCanva(accessToken, imageUrl, assetName);

// 3. Poll job status until complete
const completedJob = await pollAssetUploadJob(accessToken, uploadJob.job.id);

// 4. Extract asset ID
const assetId = completedJob.job.asset.id;
```

### Design Creation

```typescript
// Create custom-sized design with uploaded asset
const design = await createDesignFromAsset(
  accessToken,
  assetId,
  title,
  width,
  height
);

// Returns edit URL and view URL
const editUrl = design.design.urls.edit_url;
```

## API Endpoints Used

### OAuth
- **Authorization:** `https://www.canva.com/api/oauth/authorize`
- **Token Exchange:** `https://api.canva.com/rest/v1/oauth/token`

### Assets
- **Upload:** `POST https://api.canva.com/rest/v1/asset-uploads`
- **Job Status:** `GET https://api.canva.com/rest/v1/asset-uploads/{job_id}`

### Designs
- **Create:** `POST https://api.canva.com/rest/v1/designs`

## Required Scopes

The integration requests the following Canva permissions:

- `design:permission:read` - Read design permissions
- `asset:read` - Read asset metadata
- `asset:write` - Upload, modify and delete assets
- `design:content:read` - Read design content
- `design:content:write` - Create designs
- `folder:permission:read` - Read folder permissions
- `comment:write` - Post comments on designs
- `design:permission:write` - Change design permissions
- `folder:write` - Upload, modify and delete folders
- `profile:read` - Read user profile
- `folder:read` - Read folders
- `brandtemplate:content:read` - Read Brand Templates content
- `comment:read` - Read comments
- `brandtemplate:meta:read` - Read Brand Templates metadata

## Development vs Production

### Development Mode (Current)

- ✅ Works with your Canva account immediately
- ✅ Full API functionality available
- ✅ No review required for testing
- ❌ Other users cannot connect their accounts

### Production Mode (After Review)

- ✅ Any user can connect their Canva account
- ✅ Public distribution enabled
- ✅ Listed in Canva integration marketplace (optional)
- ⏳ Requires Canva review and approval

## Submitting for Review

Before submitting the integration for Canva review:

1. **Test thoroughly** - Verify all workflows work correctly
2. **Prepare documentation** - Integration description, use cases, screenshots
3. **Privacy policy** - Required for OAuth integrations
4. **Terms of service** - Required for OAuth integrations
5. **Submit via Canva Developer Portal** - https://www.canva.com/developers/apps

## Troubleshooting

### "Canva not connected" error
- Navigate to Settings and click "Connect Canva"
- Complete OAuth authorization flow

### "Token expired" error
- Tokens are automatically refreshed
- If refresh fails, disconnect and reconnect Canva

### "Upload failed" error
- Check image URL is accessible
- Verify image format is supported (PNG, JPG, WebP)
- Check image size is under 50MB

## Files Modified

- `server/services/canva.ts` - Core Canva API integration
- `server/routers/canva.ts` - tRPC procedures for Canva operations
- `server/db.ts` - Database helpers for token storage
- `drizzle/schema.ts` - User table with Canva token fields
- `client/src/pages/Settings.tsx` - Settings UI with Canva connection

## Security Considerations

- ✅ OAuth tokens stored securely in database
- ✅ PKCE flow prevents authorization code interception
- ✅ Tokens automatically refreshed before expiry
- ✅ Access tokens never exposed to frontend
- ✅ All API calls server-side only

## Rate Limits

- **Asset Upload:** 30 requests/minute per user
- **Design Creation:** 20 requests/minute per user
- **Other endpoints:** Varies by endpoint

## Next Steps

1. ✅ Test upload workflow with real variations
2. ⏳ Submit integration for Canva review
3. ⏳ Add batch upload functionality
4. ⏳ Add folder organization for uploaded designs
5. ⏳ Add design template selection

---

**Last Updated:** 26 February 2026  
**Integration Status:** Development Mode  
**Canva Developer Portal:** https://www.canva.com/developers/apps
