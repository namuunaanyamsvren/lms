## Summary

-

## Definition of Done

Feature/fix нь дараах бүх нөхцөлийг хангасан үед л backlog дээр `[x]` болно.
Хамаарахгүй мөр бүрт богино тайлбар бичнэ.

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

## Verification

- [ ] `cd backend && npm run build`
- [ ] `cd backend && npm run test`
- [ ] `cd backend && npm run openapi:validate`
- [ ] `cd backend && npm run prisma:check-drift`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test`
- [ ] Affected Playwright/mobile/accessibility smoke test

## Notes

-
