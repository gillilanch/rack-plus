# Rack+ API v1

Stage 2 introduces a versioned API surface while keeping the existing frontend routes working.

## Compatibility

Existing routes remain mounted:

- `GET /health`
- `GET /api/racks`
- `GET /api/catalog/devices`
- `GET /api/device-categories`
- `GET /api/employees`

New v1 routes are mounted beside them:

- `GET /api`
- `GET /api/v1`
- `GET /api/v1/health`
- `GET /api/v1/racks`
- `GET /api/v1/racks/:id`
- `POST /api/v1/racks`
- `PUT /api/v1/racks/:id`
- `DELETE /api/v1/racks/:id`
- `GET /api/v1/catalog/devices`
- `GET /api/v1/device-categories`
- `GET /api/v1/employees`

The frontend can migrate to `/api/v1` when the API contract is stable. Until then, old `/api/...` paths continue to work.

## Error Shape

New service-layer errors return:

```json
{
  "error": "Human-readable message",
  "code": "machine_readable_code"
}
```

Legacy validation and Prisma errors still return an `error` string, so current frontend error handling remains compatible.

## Backend Direction

Routes should stay thin. Domain decisions belong in services, Prisma access belongs in repositories, and shared request/error handling belongs under `backend/src/http` and `backend/src/middleware`.
