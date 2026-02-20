# Flux Pro 1.1 API Documentation

## Endpoint
- **Base URL**: `https://api.bfl.ai`
- **Create Request**: `POST /v1/flux-pro-1.1`
- **Poll Result**: `GET {polling_url}` (returned in create response)

## Authentication
- Header: `x-key: ${BFL_API_KEY}`
- NOT `X-Key` (case matters!)

## Request Format
```bash
curl -X POST \
  'https://api.bfl.ai/v1/flux-pro-1.1' \
  -H 'accept: application/json' \
  -H "x-key: ${BFL_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "A futuristic city skyline at sunset with flying cars",
    "width": 1024,
    "height": 1024
}'
```

## Response
```json
{
  "id": "request_id",
  "polling_url": "https://api.bfl.ai/v1/get_result?id=request_id"
}
```

## Polling
```bash
curl -X GET \
  "${polling_url}" \
  -H 'accept: application/json' \
  -H "x-key: ${BFL_API_KEY}"
```

## Result
```json
{
  "status": "Ready",
  "result": {
    "sample": "https://signed-url-to-image.png"
  }
}
```

## Key Differences from Our Implementation
1. Base URL is `https://api.bfl.ai` NOT `https://api.bfl.ml`
2. Header is `x-key` (lowercase) NOT `X-Key`
3. Polling URL is returned in the create response
