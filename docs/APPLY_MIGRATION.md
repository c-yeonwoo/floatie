# 마이그레이션 적용

피벗 스키마: `supabase/migrations/20260714120000_mission_pivot.sql`

## 로컬 / 원격 적용

```bash
cd ~/dev-private/sumgyeol
npx supabase db push
# 또는 Lovable/Supabase 대시보드 SQL 에디터에 파일 내용 붙여넣기
```

적용 후 확인:

```sql
select count(*) from mission_presets; -- 20
select proname from pg_proc where proname = 'deliver_mission';
```

기존 유저는 `gender`/`birth_year`가 비어 있으면 매칭 대상에서 제외됩니다. 온보딩을 다시 열거나 프로필을 채워 주세요.
