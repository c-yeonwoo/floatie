# 마이그레이션 적용

1. `20260714120000_mission_pivot.sql`
2. `20260714200000_p0_mission_guards.sql`
3. `20260715010000_p2_chat_contact.sql`
4. `20260715020000_reports_ban_identity.sql` — 신고 검토·영구제명·휴대폰 본인인증

```bash
cd ~/dev-private/sumgyeol
npx supabase db push
```

관리자 / 운영:

```sql
update profiles set is_admin = true where id = '<your-uuid>';
-- 운영 SMS 연동 전엔 true, 스토어 배포 전 false
update app_config set value = 'false' where key = 'dev_otp_enabled';
```
