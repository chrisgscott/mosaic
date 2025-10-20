# n8n Configuration for Mosaic Search

## What n8n needs to send:

### Headers (all required):
1. `x-api-key: test-api-key-12345`
2. `Content-Type: application/json`

### Body (JSON):
```json
{
  "query": "test query",
  "user_id": "YOUR_USER_ID_HERE"
}
```

## n8n HTTP Request Node Setup:

1. **Method**: POST
2. **URL**: `https://cqtxfjcpgaudugkqjpdc.supabase.co/functions/v1/search`
3. **Authentication**: None (we use custom header)
4. **Headers**: Add this as "Header Parameters":
   - Name: `x-api-key`, Value: `test-api-key-12345`
5. **Body**: JSON
   ```json
   {
     "query": "{{$json.query}}",
     "user_id": "{{$json.user_id}}"
   }
   ```

## Common Issues:

### Issue: 401 Unauthorized
**Cause**: Missing or incorrect `x-api-key` header
**Fix**: Make sure the `x-api-key` header is set to exactly `test-api-key-12345`

### Issue: CORS errors
**Cause**: Preflight request failing
**Fix**: Function already handles OPTIONS requests, should work from n8n

## Testing with curl:

```bash
curl -X POST "https://cqtxfjcpgaudugkqjpdc.supabase.co/functions/v1/search" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d '{"query": "test", "user_id": "00000000-0000-0000-0000-000000000000"}'
```
