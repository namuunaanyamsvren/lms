# Definition of Done

Feature, fix, эсвэл API behavior өөрчилсөн PR бүр энэ шалгуурыг хангаж байж
backlog дээр `[x]` болно. Хамаарахгүй мөрийг алгасахгүй; яагаад хамаарахгүйг
PR description дээр товч бичнэ.

## Required Checklist

- [ ] Backend authorization нь tenant, role, ownership, resource access-ийг шалгасан
- [ ] Request params/query/body Zod validation-тай
- [ ] Prisma migration болон rollback/restore төлөвлөгөөтэй
- [ ] API contract/OpenAPI шинэчлэгдсэн
- [ ] Frontend loading, empty, error, success, disabled төлөвтэй
- [ ] Unit, integration, authorization, tenant-isolation test нэмэгдсэн
- [ ] Монгол UI текст, date/time/number format зөв
- [ ] Desktop болон mobile responsive шалгалт хийсэн
- [ ] Keyboard navigation, focus state, label, contrast шалгасан
- [ ] Audit log/notification шаардлагатай бол үүсдэг
- [ ] Build, lint, test, migration, smoke test CI дээр амжилттай
- [ ] Нууц мэдээлэл log/error/API response-д задрахгүй

## Evidence

PR бүр шалгасан command, test нэр, screenshot эсвэл runbook холбоосоо хавсаргана.
Security, billing, tenant isolation, privacy, migration, notification, эсвэл
audit log-той холбоотой өөрчлөлт evidence-гүй merge болохгүй.

## Minimum Commands

```bash
cd backend
npm run build
npm run test
npm run openapi:validate
npm run prisma:check-drift

cd ../frontend
npm run build
npm run test
```

UI урсгал өөрчилсөн бол affected Playwright smoke test ажиллуулна.
