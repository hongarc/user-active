### Run script sync data to google sheet

[![Daily Cron Job](https://github.com/hongarc/user-active/actions/workflows/daily_cronjob.yaml/badge.svg?event=schedule)](https://github.com/hongarc/user-active/actions/workflows/daily_cronjob.yaml)

- Set env for GOOGLE_SHEET_EMAIL
- Set env for GOOGLE_SHEET_ID
- Contact teammates to get service account file and paste it into sheet/service-account.json

### Update env

- HEADER:

```bash
gh secret set HEADER < ./header.json
```

- DATA_DOG_TOKEN

```bash
gh secret set DATA_DOG_TOKEN
```

### Run script

```bash
npm start
```
